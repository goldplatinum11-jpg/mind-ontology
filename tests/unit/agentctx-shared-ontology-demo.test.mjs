import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { initAgentctx } from "../../scripts/agentctx/init.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLAUDE_TPL = resolve(REPO_ROOT, "docs/agentctx-setup/claude-code.mcp.json");
const CODEX_TPL = resolve(REPO_ROOT, "docs/agentctx-setup/codex-config.toml");

const tempRoots = [];
function sharedWorkspace() {
  const cwd = mkdtempSync(resolve(tmpdir(), "agentctx-demo-"));
  tempRoots.push(cwd);
  initAgentctx({ cwd });
  return cwd;
}
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

function claudeLaunch() {
  const cfg = JSON.parse(readFileSync(CLAUDE_TPL, "utf8")).mcpServers.agentctx;
  return { command: cfg.command, script: cfg.args.at(-1) };
}
function codexLaunch() {
  const toml = readFileSync(CODEX_TPL, "utf8");
  const command = toml.match(/command\s*=\s*"([^"]+)"/)[1];
  const script = [...toml.match(/args\s*=\s*\[([^\]]*)\]/)[1].matchAll(/"([^"]+)"/g)].at(-1)[1];
  return { command, script };
}

function openSession(child) {
  const rl = createInterface({ input: child.stdout });
  const pending = new Map();
  rl.on("line", (line) => {
    const t = line.trim();
    if (!t) return;
    let msg;
    try { msg = JSON.parse(t); } catch { return; }
    if (msg.id !== undefined && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  });
  return {
    request(req) {
      return new Promise((res, rej) => {
        const timer = setTimeout(() => rej(new Error(`timeout id=${req.id}`)), 4000);
        pending.set(req.id, (m) => { clearTimeout(timer); res(m); });
        child.stdin.write(`${JSON.stringify(req)}\n`);
      });
    },
    close() { rl.close(); },
  };
}

// Launch the server named by a client config and return get_context's selected
// blocks (deterministic fields only — generatedAt is excluded).
async function selectedVia(launch, workspace, task) {
  const child = spawn(launch.command, [resolve(REPO_ROOT, launch.script)], { cwd: REPO_ROOT, stdio: ["pipe", "pipe", "pipe"] });
  const s = openSession(child);
  try {
    await s.request({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    const r = await s.request({
      jsonrpc: "2.0", id: 2, method: "tools/call",
      params: { name: "get_context", arguments: { task, format: "json", cwd: workspace } },
    });
    const pack = JSON.parse(r.result.content[0].text);
    return pack.selected.map((b) => ({ file: b.file, title: b.title, score: b.score, reason: b.reason }));
  } finally {
    s.close(); child.stdin.end(); child.kill();
  }
}

describe("shared-ontology demo: Claude Code and Codex (P5-PR03)", () => {
  it("both client configs name the same server script", () => {
    expect(claudeLaunch().script).toBe(codexLaunch().script);
  });

  it("one ontology yields identical context to both Claude Code and Codex", async () => {
    const workspace = sharedWorkspace();
    const task = "Decide which agent role handles code review";

    const fromClaude = await selectedVia(claudeLaunch(), workspace, task);
    const fromCodex = await selectedVia(codexLaunch(), workspace, task);

    expect(fromClaude.length).toBeGreaterThanOrEqual(1);
    expect(fromClaude).toEqual(fromCodex); // same workspace + same server => same context
  });
});
