import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { initAgentctx } from "../../scripts/agentctx/init.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TEMPLATE_PATH = resolve(REPO_ROOT, "docs/agentctx-setup/cursor.mcp.json");
const SERVER_REL = "scripts/agentctx/mcp-server.mjs";

const tempRoots = [];
function makeProject() {
  const cwd = mkdtempSync(resolve(tmpdir(), "agentctx-cursorproof-"));
  tempRoots.push(cwd);
  initAgentctx({ cwd });
  return cwd;
}
afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop(), { recursive: true, force: true });
  }
});

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

describe("Cursor setup proof (P3-PR03)", () => {
  it("ships a valid Cursor mcp.json template naming the real server", () => {
    expect(existsSync(TEMPLATE_PATH)).toBe(true);
    const cfg = JSON.parse(readFileSync(TEMPLATE_PATH, "utf8"));
    const server = cfg.mcpServers?.agentctx;
    expect(server).toBeTruthy();
    expect(server.command).toBe("node");
    expect(server.args).toEqual([SERVER_REL]);
    expect(existsSync(resolve(REPO_ROOT, server.args.at(-1)))).toBe(true);
  });

  it("launches the server named by the Cursor template and completes the MCP handshake", async () => {
    const cfg = JSON.parse(readFileSync(TEMPLATE_PATH, "utf8"));
    const { command, args } = cfg.mcpServers.agentctx;
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
          arguments: { task: "Write the markdown schema spec for source files", scope: "schema", format: "json", cwd: project },
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
