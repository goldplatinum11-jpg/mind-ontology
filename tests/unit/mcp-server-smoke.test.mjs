import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SERVER = resolve(REPO_ROOT, "scripts/agentctx/mcp-server.mjs");

/**
 * Drive the real MCP server over stdio: write each request as a JSON-RPC line,
 * close stdin, and collect the newline-delimited responses. This is the
 * end-to-end "MCP CLI proof" — it exercises the dispatch layer that the unit
 * handler tests never touch, with no hosted SIRT, no network, and no account.
 */
function runMcp(requests) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [SERVER], {
      cwd: REPO_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", reject);
    child.on("close", () => {
      const responses = out
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l));
      resolvePromise({ responses, stderr: err });
    });
    for (const req of requests) child.stdin.write(JSON.stringify(req) + "\n");
    child.stdin.end();
  });
}

describe("MCP server stdio smoke (M11)", () => {
  it("completes the initialize handshake and advertises exactly the two thin tools", async () => {
    const { responses, stderr } = await runMcp([
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    ]);
    expect(stderr).toBe(""); // stderr stays clean in normal operation

    const init = responses.find((r) => r.id === 1);
    expect(init.result.serverInfo.name).toBe("agentctx");
    expect(init.result.protocolVersion).toBe("2024-11-05");

    const list = responses.find((r) => r.id === 2);
    const toolNames = list.result.tools.map((t) => t.name).sort();
    expect(toolNames).toEqual(["get_context", "list_constraints"]); // thin: only two
  });

  it("answers get_context and list_constraints from local .agentctx only", async () => {
    const { responses } = await runMcp([
      {
        jsonrpc: "2.0",
        id: 10,
        method: "tools/call",
        params: { name: "get_context", arguments: { task: "wire MCP setup", format: "json" } },
      },
      {
        jsonrpc: "2.0",
        id: 11,
        method: "tools/call",
        params: { name: "list_constraints", arguments: { format: "json" } },
      },
    ]);

    const ctx = responses.find((r) => r.id === 10);
    const pack = JSON.parse(ctx.result.content[0].text);
    expect(pack.task).toBe("wire MCP setup");
    expect(pack.selected.some((b) => b.file === "constraints.md")).toBe(true);

    const cons = responses.find((r) => r.id === 11);
    const parsed = JSON.parse(cons.result.content[0].text);
    expect(parsed.file).toBe("constraints.md");
    expect(parsed.blocks.length).toBeGreaterThanOrEqual(1);
  });

  it("returns proper JSON-RPC errors for bad JSON, unknown tool, and missing task", async () => {
    // Malformed JSON line is reported as -32700 with a null id.
    const bad = await new Promise((res, rej) => {
      const child = spawn(process.execPath, [SERVER], { cwd: REPO_ROOT, stdio: ["pipe", "pipe", "pipe"] });
      let out = "";
      child.stdout.on("data", (d) => (out += d.toString()));
      child.on("error", rej);
      child.on("close", () => res(out.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l))));
      child.stdin.write("{ not json\n");
      child.stdin.end();
    });
    expect(bad[0].error.code).toBe(-32700);

    const { responses } = await runMcp([
      { jsonrpc: "2.0", id: 20, method: "tools/call", params: { name: "nope", arguments: {} } },
      { jsonrpc: "2.0", id: 21, method: "tools/call", params: { name: "get_context", arguments: {} } },
    ]);
    expect(responses.find((r) => r.id === 20).error.code).toBe(-32601); // unknown tool
    expect(responses.find((r) => r.id === 21).error.code).toBe(-32602); // missing task
  });
});
