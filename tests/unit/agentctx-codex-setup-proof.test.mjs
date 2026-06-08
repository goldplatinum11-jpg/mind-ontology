import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { initAgentctx } from "../../scripts/agentctx/init.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TOML_PATH = resolve(REPO_ROOT, "docs/agentctx-setup/codex-config.toml");

const tempRoots = [];
function makeProject() {
  const cwd = mkdtempSync(resolve(tmpdir(), "agentctx-codexproof-"));
  tempRoots.push(cwd);
  initAgentctx({ cwd });
  return cwd;
}
afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop(), { recursive: true, force: true });
  }
});

// Extract command + args from the Codex [mcp_servers.agentctx] block. Minimal
// TOML reads (the project ships no TOML parser); mirrors the existing setup test.
function readCodexLaunch(toml) {
  const command = toml.match(/command\s*=\s*"([^"]+)"/)?.[1];
  const argsRaw = toml.match(/args\s*=\s*\[([^\]]*)\]/)?.[1] ?? "";
  const args = [...argsRaw.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  return { command, args };
}

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

describe("Codex setup proof (P3-PR02)", () => {
  it("launches the server named by the Codex config and completes the MCP handshake", async () => {
    const { command, args } = readCodexLaunch(readFileSync(TOML_PATH, "utf8"));
    expect(command).toBe("node");
    expect(args.at(-1)).toBe("scripts/agentctx/mcp-server.mjs");
    const serverAbs = resolve(REPO_ROOT, args.at(-1));

    const project = makeProject();
    const child = spawn(command, [serverAbs], { cwd: REPO_ROOT, stdio: ["pipe", "pipe", "pipe"] });
    const session = openSession(child);

    try {
      const init = await session.request({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
      expect(init.result.serverInfo.name).toBe("agentctx");

      const list = await session.request({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
      const names = list.result.tools.map((t) => t.name);
      expect(names).toContain("get_context");
      expect(names).toContain("list_constraints");

      const ctx = await session.request({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "get_context",
          arguments: { task: "Plan the next OSS MCP foundation PR", scope: "mcp", format: "json", cwd: project },
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
      expect(JSON.parse(cons.result.content[0].text).file).toBe("constraints.md");
    } finally {
      session.close();
      child.stdin.end();
      child.kill();
    }
  });
});
