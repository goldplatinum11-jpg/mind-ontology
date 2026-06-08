import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { initAgentctx } from "../../scripts/agentctx/init.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TEMPLATE_PATH = resolve(REPO_ROOT, "docs/agentctx-setup/claude-code.mcp.json");

const tempRoots = [];
function makeProject() {
  const cwd = mkdtempSync(join(tmpdir(), "agentctx-ccproof-"));
  tempRoots.push(cwd);
  initAgentctx({ cwd });
  return cwd;
}
function join(...p) {
  return resolve(...p);
}
afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop(), { recursive: true, force: true });
  }
});

// Minimal newline-delimited JSON-RPC client over the server's stdio, matching
// how an MCP client (Claude Code) drives the server.
function openSession(child) {
  const rl = createInterface({ input: child.stdout });
  const pending = new Map();
  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      return;
    }
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });
  return {
    request(req) {
      return new Promise((res, rej) => {
        const timer = setTimeout(() => rej(new Error(`timeout for id=${req.id}`)), 4000);
        pending.set(req.id, (msg) => {
          clearTimeout(timer);
          res(msg);
        });
        child.stdin.write(`${JSON.stringify(req)}\n`);
      });
    },
    close() {
      rl.close();
    },
  };
}

describe("Claude Code setup proof (P3-PR01)", () => {
  it("launches the server named by the Claude Code template and completes the MCP handshake", async () => {
    // Use the exact command from the shipped Claude Code template.
    const tpl = JSON.parse(readFileSync(TEMPLATE_PATH, "utf8"));
    const { command, args } = tpl.mcpServers.agentctx;
    expect(command).toBe("node");
    const serverAbs = resolve(REPO_ROOT, args.at(-1));

    const project = makeProject();
    const child = spawn(command, [serverAbs], {
      cwd: REPO_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const session = openSession(child);

    try {
      const init = await session.request({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
      expect(init.result.serverInfo.name).toBe("agentctx");
      expect(typeof init.result.protocolVersion).toBe("string");

      const list = await session.request({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
      const toolNames = list.result.tools.map((t) => t.name);
      expect(toolNames).toContain("get_context");
      expect(toolNames).toContain("list_constraints");

      // Real get_context call against the scaffolded project (per-call cwd override).
      const ctx = await session.request({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "get_context",
          arguments: { task: "Decide which review agent role to adopt", scope: "review", format: "json", cwd: project },
        },
      });
      const pack = JSON.parse(ctx.result.content[0].text);
      expect(pack.selected.length).toBeGreaterThanOrEqual(1);
      expect(pack.selected.some((b) => b.score === "always")).toBe(true);

      const cons = await session.request({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "list_constraints", arguments: { format: "json", cwd: project } },
      });
      const parsed = JSON.parse(cons.result.content[0].text);
      expect(parsed.file).toBe("constraints.md");
      expect(parsed.blocks.length).toBeGreaterThanOrEqual(1);
    } finally {
      session.close();
      child.stdin.end();
      child.kill();
    }
  });
});
