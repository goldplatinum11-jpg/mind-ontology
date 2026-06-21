import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

// PR14 — adoption fixtures / smoke. Where adopt-command.test.mjs unit-tests the
// planner and write path against the API, this suite drives the SHIPPED
// `mind-ontology adopt` wrapper end-to-end over a matrix of real project shapes
// an operator actually adopts from: an empty repo, a bare Node repo, a repo with
// a pre-existing (valid) .agentctx/, a config-conflict repo, a malformed-source
// repo, and a repo carrying a Windows-style private path. Each fixture asserts
// the externally-visible contract — exit code, files on disk, drift-free
// verification, and no leakage — so an adoption regression surfaces here.

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = resolve(REPO_ROOT, "scripts/agentctx/cli.mjs");

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
}

const tempRoots = [];
function tmp() {
  const dir = mkdtempSync(join(tmpdir(), "mo-adopt-fix-"));
  tempRoots.push(dir);
  return dir;
}
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

// Recursive relative file listing (sorted), for "untouched"/"written" proofs.
function listFiles(root, prefix = "") {
  const out = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(join(root, entry.name), rel));
    else out.push(rel);
  }
  return out.sort();
}

// Every byte adopt itself produced (its own output + every file it created),
// concatenated, so one non-leakage assertion covers the whole run. The repo's
// own pre-existing input files (README, manifest) are excluded by `inputs` — a
// leak is the machine-local detail appearing in something adopt GENERATED, not
// in the source the operator already had.
function generatedText(cwd, adoptStdout, inputs) {
  const before = new Set(inputs);
  const parts = [adoptStdout];
  for (const rel of listFiles(cwd)) {
    if (before.has(rel)) continue;
    parts.push(readFileSync(join(cwd, rel), "utf8"));
  }
  return parts.join("\n");
}

// The four emit ids the four adopt clients map to, in emit-registry order — the
// argument the plan's own verify command names.
const ALL_EMIT_TARGETS = "agents-md,claude-md,cursor,paste-block";

// Private-infrastructure / machine-local strings, split so this test's own
// source carries no literal occurrence (same convention as the no-leakage
// audits and adopt-command.test.mjs). A Windows drive path is the machine-local
// shape init --from-repo's PRIVATE_LINE filter must strip before it can reach a
// generated draft.
const WINDOWS_PRIVATE_PATH = ["C:\\Users\\", "operator", "\\build-tools"].join("");
const PRIVATE_STRINGS = [
  WINDOWS_PRIVATE_PATH,
  ["C:\\Users\\", "qmbqb"].join(""),
  ["sirt", "-product-workspaces"].join(""),
];

// ---- Fixtures: the project shapes an operator adopts from. -----------------

// An empty repo: no package.json, no .agentctx/, no artifacts.
function emptyRepo() {
  return tmp();
}

// A bare Node repo: manifest only.
function nodeRepo() {
  const cwd = tmp();
  writeFileSync(
    join(cwd, "package.json"),
    JSON.stringify({ name: "demo", version: "1.0.0", scripts: { test: "vitest run" } }, null, 2),
  );
  return cwd;
}

// A repo that already has a minimal, schema-VALID .agentctx/ (constraints only)
// but no emitted artifacts — adopt should emit without re-scaffolding sources.
function validAgentctxRepo() {
  const cwd = nodeRepo();
  mkdirSync(join(cwd, ".agentctx"));
  writeFileSync(
    join(cwd, ".agentctx", "constraints.md"),
    "# Constraints\n\n## Run tests before pushing #safety\n\nAlways run the suite before a push.\n",
  );
  return cwd;
}

// A repo whose constraints.md is MALFORMED (present but empty — no blocks). This
// is the risk flagged in the PR12 result pack: adopt --write builds artifacts via
// buildArtifact directly, so it emits a SPARSE artifact rather than hard-erroring.
function malformedAgentctxRepo() {
  const cwd = nodeRepo();
  mkdirSync(join(cwd, ".agentctx"));
  writeFileSync(join(cwd, ".agentctx", "constraints.md"), "");
  return cwd;
}

// A repo whose README and a guidance line carry a Windows-style machine-local
// path. init --from-repo's PRIVATE_LINE filter must strip it, so it never lands
// in the scaffolded .agentctx/ or any emitted artifact.
function windowsPathRepo() {
  const cwd = nodeRepo();
  writeFileSync(
    join(cwd, "README.md"),
    [
      "# Demo Service",
      "",
      "A small demo service for adoption fixtures.",
      "",
      "## Rules",
      "",
      `- Always run the build from ${WINDOWS_PRIVATE_PATH} before a release.`,
      "- Never commit generated output.",
      "",
    ].join("\n"),
  );
  return cwd;
}

describe("adopt fixtures: empty repo", () => {
  it("--write --targets all scaffolds sources, emits every artifact, and verifies drift-free", () => {
    const cwd = emptyRepo();
    const w = runCli(["adopt", "--cwd", cwd, "--targets", "all", "--write"]);
    expect(w.status, w.stderr).toBe(0);
    expect(w.stdout).toContain("Done —");

    // Sources scaffolded from scratch + all four artifacts + both configs.
    expect(existsSync(join(cwd, ".agentctx", "constraints.md"))).toBe(true);
    for (const f of [
      "AGENTS.md",
      "CLAUDE.md",
      ".cursor/rules/mind-ontology.mdc",
      "mind-ontology-paste-block.md",
      ".mcp.json",
      ".codex/config.toml",
    ]) {
      expect(existsSync(join(cwd, f)), `${f} not written`).toBe(true);
    }

    // The plan's own verify command passes: every emitted artifact matches source.
    const check = runCli(["emit", "--check", "--target", ALL_EMIT_TARGETS, "--cwd", cwd]);
    expect(check.status, check.stdout).toBe(0);
  });
});

describe("adopt fixtures: bare Node repo", () => {
  it("--write --targets all then `emit --check --target cursor,paste-block` is drift-free", () => {
    const cwd = nodeRepo();
    const w = runCli(["adopt", "--cwd", cwd, "--targets", "all", "--write"]);
    expect(w.status, w.stderr).toBe(0);

    // The non-default emit targets adopt reached are still byte-fresh.
    const check = runCli(["emit", "--check", "--target", "cursor,paste-block", "--cwd", cwd]);
    expect(check.status, check.stdout).toBe(0);
    expect(existsSync(join(cwd, ".cursor/rules/mind-ontology.mdc"))).toBe(true);
    expect(existsSync(join(cwd, "mind-ontology-paste-block.md"))).toBe(true);
  });
});

describe("adopt fixtures: pre-existing valid .agentctx/", () => {
  it("emits artifacts without re-scaffolding the operator's sources", () => {
    const cwd = validAgentctxRepo();
    const sourcesBefore = listFiles(join(cwd, ".agentctx"));
    expect(sourcesBefore).toEqual(["constraints.md"]);
    const constraintsBefore = readFileSync(join(cwd, ".agentctx", "constraints.md"), "utf8");

    const w = runCli(["adopt", "--cwd", cwd, "--targets", "all", "--write"]);
    expect(w.status, w.stderr).toBe(0);

    // An existing .agentctx/ is never re-scanned or extended: still only the one
    // source file, byte-identical (no init --from-repo scaffold ran).
    expect(listFiles(join(cwd, ".agentctx"))).toEqual(["constraints.md"]);
    expect(readFileSync(join(cwd, ".agentctx", "constraints.md"), "utf8")).toBe(constraintsBefore);

    // Artifacts were still emitted from the sparse-but-valid sources, drift-free.
    expect(existsSync(join(cwd, "AGENTS.md"))).toBe(true);
    const check = runCli(["emit", "--check", "--target", ALL_EMIT_TARGETS, "--cwd", cwd]);
    expect(check.status, check.stdout).toBe(0);
  });
});

describe("adopt fixtures: existing config conflict", () => {
  it("never overwrites an existing .mcp.json, reports manual_required, still emits the artifact", () => {
    const cwd = validAgentctxRepo();
    const original = '{ "mcpServers": { "mine": { "command": "node" } } }\n';
    writeFileSync(join(cwd, ".mcp.json"), original);

    const w = runCli(["adopt", "--cwd", cwd, "--targets", "claude-code", "--write", "--format", "json"]);
    expect(w.status, w.stderr).toBe(0);
    const out = JSON.parse(w.stdout);

    const mcp = out.actions.find((a) => a.kind === "config" && a.path === ".mcp.json");
    expect(mcp.status).toBe("manual_required");
    expect(out.manual_steps.some((s) => /\.mcp\.json.*already exists/.test(s))).toBe(true);

    // The operator's config is untouched, byte-for-byte...
    expect(readFileSync(join(cwd, ".mcp.json"), "utf8")).toBe(original);
    // ...while the safe target (CLAUDE.md) is still emitted.
    expect(existsSync(join(cwd, "CLAUDE.md"))).toBe(true);
  });
});

describe("adopt fixtures: malformed source (PR12 risk, now guarded)", () => {
  it("emits a sparse artifact without hard-erroring, and the named verify command catches it", () => {
    const cwd = malformedAgentctxRepo();

    // adopt --write does NOT validate sources before emit: it builds the artifact
    // directly, so a malformed (empty) constraints.md yields a sparse artifact and
    // exit 0 — this characterizes the current contract, not an aspiration.
    const w = runCli(["adopt", "--cwd", cwd, "--targets", "codex", "--write"]);
    expect(w.status, w.stderr).toBe(0);
    expect(existsSync(join(cwd, "AGENTS.md"))).toBe(true);

    // The safety net is the verify command the plan itself names: `validate`
    // surfaces the malformed source as a hard error so the operator can't mistake
    // the sparse artifact for a complete adoption.
    const validate = runCli(["validate", "--cwd", cwd]);
    expect(validate.status).toBe(1);
    expect(validate.stdout).toContain("[empty-required]");
    expect(validate.stdout).toContain(".agentctx/constraints.md");
  });
});

describe("adopt fixtures: Windows-style private path is stripped", () => {
  it("a machine-local path in the README never reaches the scaffold, the artifacts, or the output", () => {
    const cwd = windowsPathRepo();
    const inputs = listFiles(cwd); // README.md + package.json — legitimately carry the path
    const w = runCli(["adopt", "--cwd", cwd, "--targets", "all", "--write"]);
    expect(w.status, w.stderr).toBe(0);

    // The scaffolded .agentctx/ draft, every emitted artifact, and adopt's own
    // output must all be free of the machine-local path init --from-repo read —
    // even though the source README the operator already had still contains it.
    const generated = generatedText(cwd, w.stdout, inputs);
    for (const secret of PRIVATE_STRINGS) {
      expect(generated.includes(secret), `generated adoption surface leaks "${secret}"`).toBe(false);
    }
    // Non-vacuous: the scaffold really ran (and really read the README, since the
    // path lives in it) — so the absence above is the filter working, not no-read.
    expect(existsSync(join(cwd, ".agentctx", "constraints.md"))).toBe(true);
    expect(readFileSync(join(cwd, "README.md"), "utf8")).toContain(WINDOWS_PRIVATE_PATH);
  });
});

describe("adopt fixtures: read-only plan over every shape writes nothing", () => {
  it("a bare `adopt` plan never touches any fixture's filesystem", () => {
    for (const make of [emptyRepo, nodeRepo, validAgentctxRepo, malformedAgentctxRepo, windowsPathRepo]) {
      const cwd = make();
      const before = listFiles(cwd);
      const r = runCli(["adopt", "--cwd", cwd, "--targets", "all"]);
      expect(r.status, r.stderr).toBe(0);
      expect(r.stdout).toContain("Read-only plan — nothing written.");
      expect(listFiles(cwd), `plan mutated ${make.name}`).toEqual(before);
    }
  });
});
