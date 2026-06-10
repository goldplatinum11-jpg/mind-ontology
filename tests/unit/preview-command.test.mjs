import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it, vi } from "vitest";
import { parsePreviewArgv } from "../../scripts/agentctx/preview.mjs";

// Most tests spawn 2-3 CLI subprocesses; the 5s default flakes under a fully
// parallel suite run on a loaded machine.
vi.setConfig({ testTimeout: 60_000 });

// W6 — `mind-ontology preview` (W2 §5): compile plus the W5 explain data,
// rendered for a human. The text snapshot below freezes the bytes on the
// template ontology; the JSON contract is "compile --format json + explain",
// asserted structurally (generatedAt is the one legitimately varying field).

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = resolve(REPO_ROOT, "scripts/agentctx/cli.mjs");

const tempRoots = [];
afterAll(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

function templateProject() {
  const cwd = mkdtempSync(join(tmpdir(), "mo-preview-"));
  tempRoots.push(cwd);
  const r = spawnSync(process.execPath, [CLI, "init", "--cwd", cwd], { encoding: "utf8" });
  expect(r.status, "fixture: init should succeed").toBe(0);
  return cwd;
}

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
}

// ---------------------------------------------------------------------------
// Frozen text snapshots (template ontology). A diff here is a deliberate,
// reviewed UX change to the preview screen — not an accident.
// ---------------------------------------------------------------------------

const RISKY_SNAPSHOT = `Pack preview - task: "Delete the legacy auth tables" | risk: risky (auto: delete) | scopes: (none)

.agentctx/constraints.md
  * Keep the ontology portable  [constraint]
  * No secrets in ontology files  [constraint]
  * Confirm before destructive work  [constraint]
  * Prefer small scoped context packs  [constraint]

.agentctx/cq.md
  * What must the agent avoid?  [risk-forced]
  * Which writes are forbidden, and when must the agent fail closed?  [risk-forced]
`;

const SAFE_SNAPSHOT = `Pack preview - task: "Write the quarterly summary" | risk: safe (auto) | scopes: identity

.agentctx/constraints.md
  * Keep the ontology portable  [constraint]
  * No secrets in ontology files  [constraint]
  * Confirm before destructive work  [constraint]
  * Prefer small scoped context packs  [constraint]

.agentctx/identity.md
  * Operator profile  [scored 23]

.agentctx/cq.md
  * Which files am I allowed to write for this task?  [scored 5]
`;

describe("W6 — preview text snapshot on the template ontology", () => {
  it("risky task: risk signals lead the output, risk-forced blocks are flagged", () => {
    const cwd = templateProject();
    const r = runCli(["preview", "--cwd", cwd, "--task", "Delete the legacy auth tables"]);
    expect(r.status).toBe(0);
    expect(r.stderr).toBe("");
    expect(r.stdout).toBe(RISKY_SNAPSHOT);
  });

  it("safe task with a scope: scored blocks carry their score", () => {
    const cwd = templateProject();
    const r = runCli([
      "preview", "--cwd", cwd,
      "--task", "Write the quarterly summary",
      "--scope", "identity",
    ]);
    expect(r.status).toBe(0);
    expect(r.stdout).toBe(SAFE_SNAPSHOT);
  });

  it("a forced risk mode is rendered as forced, not auto-classified", () => {
    const cwd = templateProject();
    const r = runCli([
      "preview", "--cwd", cwd,
      "--task", "Write the quarterly summary",
      "--risk", "risky",
    ]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('risk: risky (--risk risky)');
  });

  it("the text rendering is deterministic (two runs, identical bytes)", () => {
    const cwd = templateProject();
    const args = ["preview", "--cwd", cwd, "--task", "Delete the legacy auth tables"];
    expect(runCli(args).stdout).toBe(runCli(args).stdout);
  });
});

// ---------------------------------------------------------------------------
// JSON contract (W2 §5): the compile --format json object extended additively
// with the explain tuple per selected block.
// ---------------------------------------------------------------------------

describe("W6 — preview --format json", () => {
  it("is the compile JSON shape plus per-block explain", () => {
    const cwd = templateProject();
    const task = "Delete the legacy auth tables";
    const preview = runCli(["preview", "--cwd", cwd, "--task", task, "--format", "json"]);
    const compile = runCli([
      "compile", "--cwd", cwd, "--task", task, "--explain", "--format", "json",
    ]);
    expect(preview.status).toBe(0);
    expect(compile.status).toBe(0);

    const p = JSON.parse(preview.stdout);
    const c = JSON.parse(compile.stdout);
    // generatedAt is wall-clock in the compile pack; everything else matches.
    delete p.generatedAt;
    delete c.generatedAt;
    expect(p).toEqual(c);
  });

  it("every selected block carries the four-key explain tuple", () => {
    const cwd = templateProject();
    const r = runCli([
      "preview", "--cwd", cwd, "--task", "Delete the legacy auth tables", "--format", "json",
    ]);
    const out = JSON.parse(r.stdout);
    expect(out.selected.length).toBeGreaterThan(0);
    for (const block of out.selected) {
      expect(Object.keys(block.explain)).toEqual(["sourceFile", "heading", "score", "reason"]);
      expect(["constraint", "scored", "risk-forced"]).toContain(block.explain.reason);
    }
  });
});

// ---------------------------------------------------------------------------
// Error UX (W2 §10 preview rows): identical to compile's, plus the Workbench
// --format vocabulary. The e2e catalog rows live in
// cli-error-ux-catalog.test.mjs; these unit-test the parser wording.
// ---------------------------------------------------------------------------

describe("W6 — preview argument errors match the W2 rows", () => {
  it("rejects a bad --risk with compile's wording", () => {
    expect(() => parsePreviewArgv(["--task", "x", "--risk", "nope"])).toThrow(
      /--risk must be "auto", "safe", or "risky", got: nope/,
    );
  });

  it("rejects a bad --format with the Workbench text|json vocabulary", () => {
    expect(() => parsePreviewArgv(["--task", "x", "--format", "markdown"])).toThrow(
      /--format must be "text" or "json", got: markdown/,
    );
  });

  it("rejects unknown flags", () => {
    expect(() => parsePreviewArgv(["--task", "x", "--bogus"])).toThrow(
      /Unknown argument: --bogus/,
    );
  });

  it("missing --task is the documented compile message, exit 1, empty stdout", () => {
    const cwd = templateProject();
    const r = runCli(["preview", "--cwd", cwd]);
    expect(r.status).toBe(1);
    expect(r.stdout).toBe("");
    expect(r.stderr).toMatch(/Missing required --task argument/);
  });

  it("--help exits 0 and documents the flag surface", () => {
    const r = runCli(["preview", "--help"]);
    expect(r.status).toBe(0);
    for (const flag of ["--task", "--scope", "--risk", "--format", "--cwd"]) {
      expect(r.stdout).toContain(flag);
    }
  });
});
