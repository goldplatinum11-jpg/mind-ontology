import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it, vi } from "vitest";
import { parseStatusArgv } from "../../scripts/agentctx/status.mjs";
import { parseCqs } from "../../scripts/agentctx/cq-core.mjs";
import { readAgentctx } from "../../scripts/agentctx/compile.mjs";

// W7 — `mind-ontology status` (W2 §4): four sections, each sourced verbatim
// from its engine module; degradation rules for minimal ontologies; the JSON
// shape lock; and the frozen emit summary line.

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = resolve(REPO_ROOT, "scripts/agentctx/cli.mjs");

// Every test spawns 1-3 CLI subprocesses; the 5s default flakes under a
// fully parallel suite run on a loaded machine.
vi.setConfig({ testTimeout: 60_000 });

const tempRoots = [];
afterAll(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
}

function initialized() {
  const cwd = mkdtempSync(join(tmpdir(), "mo-status-"));
  tempRoots.push(cwd);
  expect(runCli(["init", "--cwd", cwd]).status, "fixture: init should succeed").toBe(0);
  return cwd;
}

function emitted() {
  const cwd = initialized();
  expect(runCli(["emit", "--cwd", cwd]).status, "fixture: emit should succeed").toBe(0);
  return cwd;
}

describe("W7 — healthy roll-up on the template ontology", () => {
  it("freshly emitted template: every section healthy, exit 0, frozen emit summary", () => {
    const cwd = emitted();
    const r = runCli(["status", "--cwd", cwd]);
    expect(r.status).toBe(0);
    expect(r.stderr).toBe("");
    expect(r.stdout).toContain("validate: OK - 0 error(s), 0 warning(s)");
    expect(r.stdout).toContain("emit: OK - 2 of 2 targets fresh");
    expect(r.stdout).toContain("OK - every section healthy");
  });

  it("unemitted template: emit section drifts, summary names it, exit 1, report on stdout", () => {
    const cwd = initialized();
    const r = runCli(["status", "--cwd", cwd]);
    expect(r.status).toBe(1);
    expect(r.stderr).toBe("");
    expect(r.stdout).toContain("emit: DRIFT - 2 of 2 targets need attention");
    expect(r.stdout).toContain("MISSING");
    expect(r.stdout).toContain("UNHEALTHY - sections needing attention: emit");
  });
});

describe("W7 — each section is sourced from its engine module", () => {
  it("sections.emit is byte-for-byte the emit --check --format json payload", () => {
    const cwd = emitted();
    const status = JSON.parse(runCli(["status", "--cwd", cwd, "--format", "json"]).stdout);
    const check = JSON.parse(runCli(["emit", "--cwd", cwd, "--check", "--format", "json"]).stdout);
    expect(status.sections.emit).toEqual(check);
  });

  it("metrics tasks are the cq.md question titles, in source order", () => {
    const cwd = emitted();
    const status = JSON.parse(runCli(["status", "--cwd", cwd, "--format", "json"]).stdout);
    const titles = parseCqs(readAgentctx(cwd)).map((cq) => cq.question);
    expect(titles.length).toBeGreaterThan(0);
    expect(status.sections.metrics.tasks.map((t) => t.task)).toEqual(titles);
  });

  it("the validate section mirrors the validate command's verdict", () => {
    const cwd = emitted();
    const status = JSON.parse(runCli(["status", "--cwd", cwd, "--format", "json"]).stdout);
    const validate = runCli(["validate", "--cwd", cwd]);
    expect(status.sections.validate.ok).toBe(validate.status === 0);
    expect(validate.stdout).toContain(
      `${status.sections.validate.errors} error(s), ${status.sections.validate.warnings} warning(s)`,
    );
  });
});

describe("W7 — JSON shape lock (W2 §4)", () => {
  it("locks the top-level and per-section key sets", () => {
    const cwd = emitted();
    const status = JSON.parse(runCli(["status", "--cwd", cwd, "--format", "json"]).stdout);
    expect(Object.keys(status)).toEqual(["ok", "sections"]);
    expect(Object.keys(status.sections)).toEqual(["validate", "metrics", "cq", "emit"]);
    expect(Object.keys(status.sections.validate)).toEqual(["ok", "errors", "warnings"]);
    expect(Object.keys(status.sections.metrics)).toEqual(["ok", "tasks"]);
    expect(Object.keys(status.sections.cq)).toEqual(["ok", "total", "answered", "unanswered"]);
    expect(Object.keys(status.sections.emit)).toEqual(["ok", "targets"]);
    for (const target of status.sections.emit.targets) {
      expect(Object.keys(target)).toEqual(["target", "path", "status", "detail"]);
    }
  });

  it("exit code is 0 iff ok is true", () => {
    const fresh = emitted();
    const stale = initialized();
    const okRun = runCli(["status", "--cwd", fresh, "--format", "json"]);
    const badRun = runCli(["status", "--cwd", stale, "--format", "json"]);
    expect(JSON.parse(okRun.stdout).ok).toBe(true);
    expect(okRun.status).toBe(0);
    expect(JSON.parse(badRun.stdout).ok).toBe(false);
    expect(badRun.status).toBe(1);
  });
});

describe("W7 — degradation rules (W2 §4)", () => {
  it("no cq.md: metrics and cq report skipped and the roll-up stays green", () => {
    const cwd = emitted();
    unlinkSync(join(cwd, ".agentctx", "cq.md"));
    // Re-emit so the emit section is fresh again (cq.md is profile-excluded
    // and sweep-exempt, but deleting it can still re-flag a digest).
    expect(runCli(["emit", "--cwd", cwd]).status).toBe(0);
    const r = runCli(["status", "--cwd", cwd, "--format", "json"]);
    const status = JSON.parse(r.stdout);
    expect(status.sections.metrics).toEqual({
      ok: true,
      skipped: true,
      reason: expect.stringContaining("cq.md"),
    });
    expect(status.sections.cq.skipped).toBe(true);
    expect(status.ok).toBe(true);
    expect(r.status).toBe(0);

    const text = runCli(["status", "--cwd", cwd]);
    expect(text.stdout).toContain("metrics: SKIPPED -");
    expect(text.stdout).toContain("cq: SKIPPED -");
  });

  it("broken ontology is a hard error: stderr, exit 1, no partial report", () => {
    const cwd = initialized();
    writeFileSync(join(cwd, ".agentctx", "constraints.md"), "");
    const r = runCli(["status", "--cwd", cwd]);
    expect(r.status).toBe(1);
    expect(r.stdout).toBe("");
    expect(r.stderr).toMatch(/Required Mind Ontology source is empty/);
  });
});

describe("W7 — argument errors", () => {
  it("rejects a bad --format with the Workbench vocabulary", () => {
    expect(() => parseStatusArgv(["--format", "xml"])).toThrow(
      /--format must be "text" or "json", got: xml/,
    );
  });

  it("rejects unknown flags", () => {
    expect(() => parseStatusArgv(["--bogus"])).toThrow(/Unknown argument: --bogus/);
  });

  it("--help exits 0 and names the four sections", () => {
    const r = runCli(["status", "--help"]);
    expect(r.status).toBe(0);
    for (const section of ["validate", "metrics", "cq", "emit"]) {
      expect(r.stdout).toContain(section);
    }
  });
});
