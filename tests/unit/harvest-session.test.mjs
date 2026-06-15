/**
 * harvest-session.test.mjs — Regression tests for Campaign B auto-session harvesting.
 *
 * Covers: Claude Code JSONL parser, Stop hook setup/remove, harvest-session
 * stdin flow, and CLI surface for the setup command.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

import { parseClaudeSession } from "../../scripts/agentctx/harvest-claude-session.mjs";
import { addHook, hasHook, hookCommand, HOOK_MARKER, removeHook } from "../../scripts/agentctx/setup.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = resolve(REPO_ROOT, "scripts/agentctx/cli.mjs");
const HARVEST_SESSION = resolve(REPO_ROOT, "scripts/agentctx/harvest-session.mjs");

// ---------------------------------------------------------------------------
// Temp directory helpers
// ---------------------------------------------------------------------------

const tempDirs = [];
afterEach(() => {
  while (tempDirs.length) rmSync(tempDirs.pop(), { recursive: true, force: true });
});

function tempProject() {
  const dir = mkdtempSync(join(tmpdir(), "mo-session-"));
  tempDirs.push(dir);
  mkdirSync(join(dir, ".agentctx"));
  return dir;
}

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
}

function runHarvestSession(stdinJson, extraEnv = {}) {
  return spawnSync(process.execPath, [HARVEST_SESSION], {
    encoding: "utf8",
    input: JSON.stringify(stdinJson),
    env: { ...process.env, ...extraEnv },
  });
}

// ---------------------------------------------------------------------------
// Minimal JSONL fixture builder
// ---------------------------------------------------------------------------

function makeJSONL(lines) {
  return lines.map(l => JSON.stringify(l)).join("\n") + "\n";
}

function userLine(text, sessionId = "test-session-1") {
  return {
    type: "user",
    sessionId,
    uuid: "u-1",
    message: { role: "user", content: text },
    timestamp: "2026-06-15T00:00:00.000Z",
  };
}

function assistantLine(text, sessionId = "test-session-1") {
  return {
    type: "assistant",
    sessionId,
    uuid: "a-1",
    message: {
      role: "assistant",
      content: [{ type: "text", text }],
    },
  };
}

// ---------------------------------------------------------------------------
// Claude Code JSONL parser
// ---------------------------------------------------------------------------

describe("harvest-claude-session parser", () => {
  it("extracts user and assistant text turns", () => {
    const jsonl = makeJSONL([
      { type: "mode", mode: "normal", sessionId: "test-session-1" },
      userLine("We decided to use open-core distribution because OSS users need to inspect the context layer."),
      assistantLine("That makes sense. The hosted SIRT tier remains the paid offering."),
    ]);

    const tmpDir = mkdtempSync(join(tmpdir(), "mo-jl-"));
    tempDirs.push(tmpDir);
    const filePath = join(tmpDir, "test-session-1.jsonl");
    writeFileSync(filePath, jsonl);

    const { source, candidates } = parseClaudeSession(filePath);

    expect(source.type).toBe("claude-session");
    expect(source.id).toBe("claude-session:test-session-1");
    expect(candidates.length).toBeGreaterThan(0);
    const texts = candidates.map(c => c.text);
    expect(texts.some(t => t.includes("open-core"))).toBe(true);
  });

  it("skips thinking blocks and metadata lines", () => {
    const jsonl = makeJSONL([
      { type: "mode", mode: "normal" },
      { type: "permission-mode", permissionMode: "auto" },
      {
        type: "assistant",
        sessionId: "s1",
        message: {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "internal thought" },
            { type: "text", text: "We must never store secrets in .agentctx/ because it is version-controlled." },
          ],
        },
      },
    ]);

    const dir = mkdtempSync(join(tmpdir(), "mo-jl-"));
    tempDirs.push(dir);
    const filePath = join(dir, "s1.jsonl");
    writeFileSync(filePath, jsonl);

    const { candidates } = parseClaudeSession(filePath);
    const texts = candidates.map(c => c.text);
    expect(texts.some(t => t.includes("internal thought"))).toBe(false);
    expect(texts.some(t => t.includes("secrets"))).toBe(true);
  });

  it("handles user content as plain string", () => {
    const jsonl = makeJSONL([
      userLine("We decided to keep the CLI surface minimal because fewer flags means lower maintenance burden."),
    ]);
    const dir = mkdtempSync(join(tmpdir(), "mo-jl-"));
    tempDirs.push(dir);
    const filePath = join(dir, "sess.jsonl");
    writeFileSync(filePath, jsonl);

    const { candidates } = parseClaudeSession(filePath);
    expect(candidates.length).toBeGreaterThan(0);
  });

  it("falls back to filename as session ID when no sessionId in records", () => {
    const jsonl = makeJSONL([
      userLine("We decided to keep the CLI surface minimal to reduce maintenance overhead."),
    ]).replace(/"sessionId":"test-session-1"/g, "");

    const dir = mkdtempSync(join(tmpdir(), "mo-jl-"));
    tempDirs.push(dir);
    const filePath = join(dir, "abc123.jsonl");
    writeFileSync(filePath, jsonl);

    const { source } = parseClaudeSession(filePath);
    expect(source.id).toBe("claude-session:abc123");
  });
});

// ---------------------------------------------------------------------------
// Setup — addHook / removeHook / hasHook
// ---------------------------------------------------------------------------

describe("setup hook management", () => {
  it("addHook adds a Stop hook entry to empty settings", () => {
    const updated = addHook({});
    expect(hasHook(updated)).toBe(true);
    const cmd = updated.hooks.Stop[0].hooks[0].command;
    expect(cmd).toContain("harvest-session.mjs");
    expect(cmd).toContain(HOOK_MARKER);
  });

  it("addHook is idempotent — second call returns same structure", () => {
    const once = addHook({});
    const twice = addHook(once);
    expect(twice.hooks.Stop).toHaveLength(1);
  });

  it("addHook preserves existing hooks in settings", () => {
    const existing = {
      hooks: {
        Stop: [{ hooks: [{ type: "command", command: "echo other-hook" }] }],
      },
    };
    const updated = addHook(existing);
    expect(updated.hooks.Stop).toHaveLength(2);
  });

  it("removeHook removes the harvest-session entry and cleans up empty keys", () => {
    const withHook = addHook({});
    const removed = removeHook(withHook);
    expect(hasHook(removed)).toBe(false);
    expect(removed.hooks).toBeUndefined();
  });

  it("removeHook leaves unrelated hooks intact", () => {
    const existing = {
      hooks: {
        Stop: [{ hooks: [{ type: "command", command: "echo other" }] }],
      },
    };
    const withHook = addHook(existing);
    const removed = removeHook(withHook);
    expect(hasHook(removed)).toBe(false);
    expect(removed.hooks.Stop).toHaveLength(1);
    expect(removed.hooks.Stop[0].hooks[0].command).toBe("echo other");
  });
});

// ---------------------------------------------------------------------------
// Setup CLI surface
// ---------------------------------------------------------------------------

describe("setup CLI", () => {
  it("setup with no .agentctx/ exits 1 with init hint", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "mo-no-ctx-"));
    tempDirs.push(tmpDir);
    const r = runCli(["setup", "--cwd", tmpDir]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/init/);
  });

  it("setup --dry-run reports action without writing", () => {
    const projectDir = tempProject();
    const r = runCli(["setup", "--cwd", projectDir, "--dry-run"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/DRY RUN/);
    // No .claude/settings.json should be created
    expect(existsSync(join(projectDir, ".claude", "settings.json"))).toBe(false);
  });

  it("setup writes .claude/settings.json with Stop hook", () => {
    const projectDir = tempProject();
    const r = runCli(["setup", "--cwd", projectDir]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/Stop hook written/);

    const settingsPath = join(projectDir, ".claude", "settings.json");
    const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
    expect(settings.hooks?.Stop?.length).toBeGreaterThan(0);
    const cmd = settings.hooks.Stop[0].hooks[0].command;
    expect(cmd).toContain("harvest-session.mjs");
  });

  it("setup is idempotent — second run reports already present", () => {
    const projectDir = tempProject();
    runCli(["setup", "--cwd", projectDir]);
    const r2 = runCli(["setup", "--cwd", projectDir]);
    expect(r2.status).toBe(0);
    expect(r2.stdout).toMatch(/already present/);
  });

  it("setup --remove removes the hook", () => {
    const projectDir = tempProject();
    runCli(["setup", "--cwd", projectDir]);
    const r = runCli(["setup", "--cwd", projectDir, "--remove"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/removed/);

    const settingsPath = join(projectDir, ".claude", "settings.json");
    const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
    expect(settings.hooks?.Stop ?? []).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// harvest-session Stop hook entry point
// ---------------------------------------------------------------------------

describe("harvest-session stdin runner", () => {
  it("exits 0 silently when no .agentctx/ found from cwd", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "mo-no-ctx-"));
    tempDirs.push(tmpDir);
    const transcriptPath = join(tmpDir, "dummy.jsonl");
    writeFileSync(transcriptPath, "");

    const r = runHarvestSession({
      session_id: "s1",
      transcript_path: transcriptPath,
      cwd: tmpDir,
      hook_event_name: "Stop",
    });
    expect(r.status).toBe(0);
  });

  it("exits 0 silently when transcript_path does not exist", () => {
    const projectDir = tempProject();
    const r = runHarvestSession({
      session_id: "s1",
      transcript_path: join(projectDir, "nonexistent.jsonl"),
      cwd: projectDir,
      hook_event_name: "Stop",
    });
    expect(r.status).toBe(0);
  });

  it("harvests decision entries from a real session fixture and reports written count", () => {
    const projectDir = tempProject();

    const jsonl = makeJSONL([
      userLine(
        "We decided to use open-core distribution because developers must be able to inspect the context layer without paying.",
        "sess-harvest-test",
      ),
      assistantLine(
        "Agreed. The constraint is that we must never store API keys or secrets in .agentctx/ files since they are version-controlled.",
        "sess-harvest-test",
      ),
    ]);

    const transcriptPath = join(projectDir, "sess-harvest-test.jsonl");
    writeFileSync(transcriptPath, jsonl);

    const r = runHarvestSession({
      session_id: "sess-harvest-test",
      transcript_path: transcriptPath,
      cwd: projectDir,
      hook_event_name: "Stop",
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/written/);
  });

  it("exits 1 on invalid stdin JSON", () => {
    const projectDir = tempProject();
    const r = spawnSync(process.execPath, [HARVEST_SESSION], {
      encoding: "utf8",
      input: "not-json",
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/invalid JSON/);
  });
});
