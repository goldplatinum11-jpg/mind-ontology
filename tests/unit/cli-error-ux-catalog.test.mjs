import { spawnSync } from "node:child_process";
import { appendFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

// End-to-end CLI error-UX catalog (M42).
//
// This complements `cli-error-ux.test.mjs` (which unit-tests the pure parse /
// validate functions in-process). Here we drive the *product-facing* wrapper
// — `mind-ontology <command>` — as a real subprocess for every representative
// failure mode, and assert STABLE PROPERTIES rather than brittle full-stderr
// snapshots:
//
//   1. the process exits non-zero;
//   2. the error message NAMES the problem (a regex, not a byte-for-byte copy);
//   3. where a safe next step exists, the message POINTS to it
//      (--task / --force / agentctx:init / the allowed values / --help);
//   4. ordinary user errors carry NO stack trace and never leak onto the
//      success stream.
//
// One row per failure mode keeps the catalog readable and makes "add a case"
// the obvious way to lock a new failure mode against regression. The wrapper
// uses stdio:"inherit", so the underlying engine's own message and exit code
// flow through unchanged — exactly what an operator or agent worker sees.

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = resolve(REPO_ROOT, "scripts/agentctx/cli.mjs");

const tempRoots = [];
function tmp() {
  const dir = mkdtempSync(join(tmpdir(), "mo-err-cat-"));
  tempRoots.push(dir);
  return dir;
}
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
}

// A node stack frame ("    at fn (file:line:col)" / "node:internal/...").
// Ordinary user errors must never surface one.
const STACK_TRACE = /\n\s+at\s+\S|node:internal/;

// Project-state builders. Each returns a cwd in the requested state so a row
// can declare *what kind of project* triggers its failure, not how to build it.
const PROJECTS = {
  none() {
    // A fresh dir with no .agentctx/ at all.
    return tmp();
  },
  bareAgentctx() {
    // .agentctx/ exists but is empty — the "bare directory compile" case.
    const cwd = tmp();
    mkdirSync(join(cwd, ".agentctx"));
    return cwd;
  },
  initialized() {
    const cwd = tmp();
    expect(runCli(["init", "--cwd", cwd]).status, "fixture: init should succeed").toBe(0);
    return cwd;
  },
  emptyConstraints() {
    // Initialized, then the always-required constraints.md emptied out.
    const cwd = tmp();
    expect(runCli(["init", "--cwd", cwd]).status, "fixture: init should succeed").toBe(0);
    writeFileSync(join(cwd, ".agentctx", "constraints.md"), "");
    return cwd;
  },
  initializedNoCq() {
    // Initialized, then cq.md removed — valid ontology, no competency questions.
    const cwd = tmp();
    expect(runCli(["init", "--cwd", cwd]).status, "fixture: init should succeed").toBe(0);
    rmSync(join(cwd, ".agentctx", "cq.md"));
    return cwd;
  },
  unmanagedArtifact() {
    // Initialized, plus a pre-existing hand-written AGENTS.md (no emit header).
    const cwd = tmp();
    expect(runCli(["init", "--cwd", cwd]).status, "fixture: init should succeed").toBe(0);
    writeFileSync(join(cwd, "AGENTS.md"), "# AGENTS.md\n\nHand-written instructions.\n");
    return cwd;
  },
  staleEmit() {
    // Emitted once, then a source edited so every target is stale.
    const cwd = tmp();
    expect(runCli(["init", "--cwd", cwd]).status, "fixture: init should succeed").toBe(0);
    expect(runCli(["emit", "--cwd", cwd]).status, "fixture: emit should succeed").toBe(0);
    appendFileSync(join(cwd, ".agentctx", "constraints.md"), "\n## Extra rule #safety\n\nAdded after emit.\n");
    return cwd;
  },
  existingMcpConfig() {
    // A project that already carries a hand-managed .mcp.json — setup's write
    // mode must refuse to overwrite or merge it.
    const cwd = tmp();
    writeFileSync(join(cwd, ".mcp.json"), '{ "mcpServers": { "mine": {} } }\n');
    return cwd;
  },
};

// The catalog. `argv` is templated with the project cwd via the {cwd} token.
// `stream` is where the human-facing message is expected: compile/init fail to
// stderr and keep stdout clean; `validate` reports issues on stdout (it is a
// report, not a thrown error) and keeps stderr clean. `nextAction` is optional:
// some engine messages name the problem but do not yet point to a fix — those
// rows assert only naming, and the gap is documented in docs/cli-errors.md as a
// candidate repair lane rather than papered over here.
const CASES = [
  {
    id: "wrapper: unknown command",
    project: "none",
    argv: ["frobnicate"],
    stream: "stderr",
    names: /Unknown command: frobnicate/,
    nextAction: /--help|compile/,
  },
  {
    id: "wrapper: unknown leading flag",
    project: "none",
    argv: ["--nope"],
    stream: "stderr",
    names: /Unknown command: --nope/,
    nextAction: /--help/,
  },
  {
    id: "compile: missing --task",
    project: "initialized",
    argv: ["compile", "--cwd", "{cwd}"],
    stream: "stderr",
    names: /Missing required --task argument/,
    nextAction: /--task/,
  },
  {
    id: "compile: bad --format",
    project: "initialized",
    argv: ["compile", "--cwd", "{cwd}", "--task", "x", "--format", "xml"],
    stream: "stderr",
    names: /--format must be "markdown" or "json"/,
    nextAction: /markdown|json/,
  },
  {
    id: "compile: bad --risk",
    project: "initialized",
    argv: ["compile", "--cwd", "{cwd}", "--task", "x", "--risk", "nope"],
    stream: "stderr",
    names: /--risk must be "auto", "safe", or "risky"/,
    nextAction: /auto|safe|risky/,
  },
  {
    id: "compile: unknown flag",
    project: "initialized",
    argv: ["compile", "--cwd", "{cwd}", "--task", "x", "--bogus"],
    stream: "stderr",
    names: /Unknown argument: --bogus/,
    nextAction: /mind-ontology compile --help/,
  },
  {
    id: "compile: missing .agentctx/",
    project: "none",
    argv: ["compile", "--cwd", "{cwd}", "--task", "Implement the OAuth refresh flow"],
    stream: "stderr",
    names: /Missing \.agentctx\//,
    nextAction: /agentctx:init/,
  },
  {
    id: "compile: bare .agentctx/ (missing constraints.md)",
    project: "bareAgentctx",
    argv: ["compile", "--cwd", "{cwd}", "--task", "Implement the OAuth refresh flow"],
    stream: "stderr",
    names: /Missing required Mind Ontology source: \.agentctx\/constraints\.md/,
    nextAction: /agentctx:init/,
  },
  {
    id: "compile: empty constraints.md",
    project: "emptyConstraints",
    argv: ["compile", "--cwd", "{cwd}", "--task", "Implement the OAuth refresh flow"],
    stream: "stderr",
    names: /Required Mind Ontology source is empty: \.agentctx\/constraints\.md/,
    nextAction: /constraint block/,
  },
  {
    id: "init: overwrite refusal without --force",
    project: "initialized",
    argv: ["init", "--cwd", "{cwd}"],
    stream: "stderr",
    names: /already exists\. Re-run with --force/,
    nextAction: /--force/,
  },
  {
    id: "init: unknown template",
    project: "none",
    argv: ["init", "--cwd", "{cwd}", "--template", "does-not-exist"],
    stream: "stderr",
    names: /Template not found: does-not-exist/,
    nextAction: /Available templates: mind-ontology.*--template <name>/,
  },
  {
    id: "init: unknown flag",
    project: "none",
    argv: ["init", "--cwd", "{cwd}", "--bogus"],
    stream: "stderr",
    names: /Unknown argument: --bogus/,
    nextAction: /mind-ontology init --help/,
  },
  {
    id: "validate: missing .agentctx/",
    project: "none",
    argv: ["validate", "--cwd", "{cwd}"],
    stream: "stdout", // validate prints a report, not a thrown error
    names: /Missing \.agentctx\/|missing-dir/,
    nextAction: /agentctx:init/,
  },
  {
    id: "validate: schema failure (empty required source)",
    project: "emptyConstraints",
    argv: ["validate", "--cwd", "{cwd}"],
    stream: "stdout",
    names: /empty-required|Required source is empty: \.agentctx\/constraints\.md/,
    // Issue lines now carry an inline remedy plus a doc pointer
    // (validate-remedy-hints-v1; closed candidate repair lane).
    nextAction: /fix: Add at least one "## <title> #<tag>" block to constraints\.md\./,
  },
  {
    id: "validate: failing report links the schema authoring doc",
    project: "emptyConstraints",
    argv: ["validate", "--cwd", "{cwd}"],
    stream: "stdout",
    names: /INVALID/,
    nextAction: /See docs\/schema-authoring\.md for the block format and per-file rules\./,
  },
  // ── W3: `mind-ontology emit` rows (W2 §10, merged into docs/cli-errors.md
  //    in the same change) ──────────────────────────────────────────────────
  {
    id: "emit: unknown target id",
    project: "initialized",
    argv: ["emit", "--cwd", "{cwd}", "--target", "bogus"],
    stream: "stderr",
    names: /--target must be one of "agents-md", "claude-md", got: bogus/,
    nextAction: /agents-md/,
  },
  {
    id: "emit: refuses an un-managed file without --force",
    project: "unmanagedArtifact",
    argv: ["emit", "--cwd", "{cwd}"],
    stream: "stderr",
    names: /Refusing to overwrite AGENTS\.md: file exists but has no emit header/,
    nextAction: /--force/,
  },
  {
    id: "emit: --full cannot combine with --check",
    project: "initialized",
    argv: ["emit", "--cwd", "{cwd}", "--full", "--check"],
    stream: "stderr",
    names: /--full cannot be combined with --check/,
    nextAction: /--check/,
  },
  {
    id: "emit: --force cannot combine with --check",
    project: "initialized",
    argv: ["emit", "--cwd", "{cwd}", "--force", "--check"],
    stream: "stderr",
    names: /--force cannot be combined with --check/,
    nextAction: /--check/,
  },
  {
    id: "emit: bad --format",
    project: "initialized",
    argv: ["emit", "--cwd", "{cwd}", "--format", "xml"],
    stream: "stderr",
    names: /--format must be "text" or "json", got: xml/,
    nextAction: /text|json/,
  },
  {
    id: "emit: unknown flag",
    project: "initialized",
    argv: ["emit", "--cwd", "{cwd}", "--bogus"],
    stream: "stderr",
    names: /Unknown argument: --bogus/,
    nextAction: /mind-ontology emit --help/,
  },
  {
    id: "emit: missing .agentctx/ (compile pass-through)",
    project: "none",
    argv: ["emit", "--cwd", "{cwd}"],
    stream: "stderr",
    names: /Missing \.agentctx\//,
    nextAction: /agentctx:init/,
  },
  // ── W9: `mind-ontology review` hard-error rows (W2 §10; the violation-report
  //    path is locked in review-command.test.mjs) ────────────────────────────
  {
    id: "review: missing --pack",
    project: "none",
    argv: ["review"],
    stream: "stderr",
    names: /Missing required --pack argument/,
    nextAction: /--pack/,
  },
  {
    id: "review: unreadable pack path",
    project: "none",
    argv: ["review", "--pack", "does/not/exist.json"],
    stream: "stderr",
    names: /Cannot read Result Pack: does\/not\/exist\.json/,
    nextAction: null,
  },
  {
    id: "review: unknown flag",
    project: "none",
    argv: ["review", "--bogus"],
    stream: "stderr",
    names: /Unknown argument: --bogus/,
    nextAction: /mind-ontology review --help/,
  },
  // ── W8: `mind-ontology cq` hard-error rows (W2 §10; the unanswered-report
  //    path and the required-only gate are locked in cq-command.test.mjs) ─────
  {
    id: "cq: missing cq.md is a hard error",
    project: "initializedNoCq",
    argv: ["cq", "--cwd", "{cwd}"],
    stream: "stderr",
    names: /Missing \.agentctx\/cq\.md/,
    nextAction: /cq schema/,
  },
  {
    id: "cq: --id out of range names the valid range",
    project: "initialized",
    argv: ["cq", "--cwd", "{cwd}", "--id", "99"],
    stream: "stderr",
    names: /--id must be between 1 and \d+, got: 99/,
    nextAction: null,
  },
  {
    id: "cq: bad --format",
    project: "initialized",
    argv: ["cq", "--cwd", "{cwd}", "--format", "xml"],
    stream: "stderr",
    names: /--format must be "text" or "json", got: xml/,
    nextAction: /text|json/,
  },
  {
    id: "cq: unknown flag",
    project: "initialized",
    argv: ["cq", "--cwd", "{cwd}", "--bogus"],
    stream: "stderr",
    names: /Unknown argument: --bogus/,
    nextAction: /mind-ontology cq --help/,
  },
  // ── W7: `mind-ontology status` hard-error rows (W2 §10; the unhealthy-report
  //    path is a multi-line stdout report, locked in status-command.test.mjs) ──
  {
    id: "status: missing .agentctx/ is a hard error (compile pass-through)",
    project: "none",
    argv: ["status", "--cwd", "{cwd}"],
    stream: "stderr",
    names: /Missing \.agentctx\//,
    nextAction: /agentctx:init/,
  },
  {
    id: "status: bad --format",
    project: "initialized",
    argv: ["status", "--cwd", "{cwd}", "--format", "xml"],
    stream: "stderr",
    names: /--format must be "text" or "json", got: xml/,
    nextAction: /text|json/,
  },
  {
    id: "status: unknown flag",
    project: "initialized",
    argv: ["status", "--cwd", "{cwd}", "--bogus"],
    stream: "stderr",
    names: /Unknown argument: --bogus/,
    nextAction: /mind-ontology status --help/,
  },
  // ── W6: `mind-ontology preview` rows (W2 §10: identical to compile's, plus
  //    the Workbench text|json --format vocabulary) ──────────────────────────
  {
    id: "preview: missing --task",
    project: "initialized",
    argv: ["preview", "--cwd", "{cwd}"],
    stream: "stderr",
    names: /Missing required --task argument/,
    nextAction: /--task/,
  },
  {
    id: "preview: bad --format uses the Workbench vocabulary",
    project: "initialized",
    argv: ["preview", "--cwd", "{cwd}", "--task", "x", "--format", "markdown"],
    stream: "stderr",
    names: /--format must be "text" or "json", got: markdown/,
    nextAction: /text|json/,
  },
  {
    id: "preview: bad --risk",
    project: "initialized",
    argv: ["preview", "--cwd", "{cwd}", "--task", "x", "--risk", "nope"],
    stream: "stderr",
    names: /--risk must be "auto", "safe", or "risky"/,
    nextAction: /auto|safe|risky/,
  },
  {
    id: "preview: unknown flag",
    project: "initialized",
    argv: ["preview", "--cwd", "{cwd}", "--task", "x", "--bogus"],
    stream: "stderr",
    names: /Unknown argument: --bogus/,
    nextAction: /mind-ontology preview --help/,
  },
  {
    id: "preview: missing .agentctx/ (compile pass-through)",
    project: "none",
    argv: ["preview", "--cwd", "{cwd}", "--task", "Implement the OAuth refresh flow"],
    stream: "stderr",
    names: /Missing \.agentctx\//,
    nextAction: /agentctx:init/,
  },
  {
    id: "emit --check: drift is a stdout report with the re-emit action",
    project: "staleEmit",
    argv: ["emit", "--cwd", "{cwd}", "--check"],
    stream: "stdout",
    names: /STALE/,
    nextAction: /run: mind-ontology emit/,
  },
  {
    id: "emit --check: broken ontology is a hard error",
    project: "emptyConstraints",
    argv: ["emit", "--cwd", "{cwd}", "--check"],
    stream: "stderr",
    names: /Required Mind Ontology source is empty/,
    nextAction: /constraint block/,
  },
  // ── Adoption Autoload V1 follow-up: `mind-ontology setup` hard-error rows.
  //    The two warning paths (server script not found, missing .agentctx/)
  //    deliberately exit 0 with a stderr warning — outside the catalog shape
  //    (non-zero exit, clean success stream) — and are locked end-to-end in
  //    setup-command.test.mjs; docs/cli-errors.md catalogs them as warnings. ──
  {
    id: "setup: missing --target names the allowed values",
    project: "none",
    argv: ["setup", "--cwd", "{cwd}", "--print"],
    stream: "stderr",
    names: /Missing required --target argument \(allowed: "claude-code", "codex"\)/,
    nextAction: /claude-code|codex/,
  },
  {
    id: "setup: unknown target names the allowed values",
    project: "none",
    argv: ["setup", "--cwd", "{cwd}", "--target", "cursor", "--print"],
    stream: "stderr",
    names: /--target must be one of "claude-code", "codex", got: cursor/,
    nextAction: /claude-code|codex/,
  },
  {
    id: "setup: bad --format uses the Workbench vocabulary",
    project: "none",
    argv: ["setup", "--cwd", "{cwd}", "--target", "codex", "--format", "xml", "--print"],
    stream: "stderr",
    names: /--format must be "text" or "json", got: xml/,
    nextAction: /text|json/,
  },
  {
    id: "setup: unknown flag",
    project: "none",
    argv: ["setup", "--cwd", "{cwd}", "--target", "codex", "--bogus", "--print"],
    stream: "stderr",
    names: /Unknown argument: --bogus/,
    nextAction: /mind-ontology setup --help/,
  },
  {
    id: "setup: write mode refuses an existing config",
    project: "existingMcpConfig",
    argv: ["setup", "--cwd", "{cwd}", "--target", "claude-code"],
    stream: "stderr",
    names: /Refusing to overwrite \.mcp\.json: file already exists/,
    nextAction: /--print/,
  },
];

describe("CLI error-UX catalog: every documented failure mode fails closed and loud (M42)", () => {
  for (const c of CASES) {
    it(`${c.id}`, () => {
      const cwd = PROJECTS[c.project]();
      const argv = c.argv.map((a) => (a === "{cwd}" ? cwd : a));
      const r = runCli(argv);

      const message = c.stream === "stdout" ? r.stdout : r.stderr;
      const otherStream = c.stream === "stdout" ? r.stderr : r.stdout;

      // 1. fails closed: non-zero exit.
      expect(r.status, `${c.id}: expected non-zero exit`).not.toBe(0);

      // 2. names the problem.
      expect(message, `${c.id}: message should name the problem`).toMatch(c.names);

      // 3. points to a safe next step when one exists.
      if (c.nextAction) {
        expect(message, `${c.id}: message should point to a next safe action`).toMatch(c.nextAction);
      }

      // 4a. no stack trace for an ordinary user error.
      expect(STACK_TRACE.test(message), `${c.id}: message must not leak a stack trace`).toBe(false);

      // 4b. the success stream stays clean (the error never bleeds into output
      // a downstream tool/agent would parse as a result).
      expect(otherStream.trim(), `${c.id}: the non-error stream should be empty`).toBe("");

      // The message is a short, single-problem statement — not a dumped object
      // or multi-screen trace. (Loose upper bound; validate reports may carry a
      // summary line, so allow a handful of lines.)
      expect(message.split("\n").filter((l) => l.trim()).length, `${c.id}: message should be concise`).toBeLessThanOrEqual(6);
    });
  }
});

// A negative control: prove the assertions above actually discriminate. A valid
// invocation must exit 0, write the pack to stdout, and keep stderr clean — so
// a runner that "passes" everything would fail this row.
describe("CLI error-UX catalog: negative control (M42)", () => {
  it("a valid compile exits 0, writes the pack to stdout, and keeps stderr clean", () => {
    const cwd = PROJECTS.initialized();
    const r = runCli(["compile", "--cwd", cwd, "--task", "Implement the OAuth refresh flow"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("# agentctx context pack");
    expect(r.stderr.trim()).toBe("");
  });
});
