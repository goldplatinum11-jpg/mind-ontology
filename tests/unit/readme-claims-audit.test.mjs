import { spawnSync } from "node:child_process";
import { appendFileSync, cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { COMMANDS } from "../../scripts/agentctx/cli.mjs";

// W10 — README claims audit. The top-level README leads with runnable commands
// and pasted command output ("Try it in 30 seconds"). This audit holds every
// such claim to the shipped engine: cited npm scripts must exist, cited
// `mind-ontology` verbs must be real dispatcher commands, and every output
// block must be the byte-real output of running the shipped commands against
// the bundled template ontology. If the template, the frame, or the emit
// format changes, this test fails until the README's pasted output is
// refreshed — the README obeys the same freshness contract emit enforces.

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const README = readFileSync(resolve(REPO_ROOT, "README.md"), "utf8");
const PKG = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));
const CLI = resolve(REPO_ROOT, "scripts/agentctx/cli.mjs");
const TEMPLATE_AGENTCTX = resolve(REPO_ROOT, "templates/mind-ontology/.agentctx");

function runCli(args, cwd) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8" });
}

// One real project for the whole audit, mirroring the README walkthrough:
// scaffold from the template, emit, check, edit a source, check again.
const project = mkdtempSync(join(tmpdir(), "mo-readme-audit-"));
cpSync(TEMPLATE_AGENTCTX, join(project, ".agentctx"), { recursive: true });
afterAll(() => rmSync(project, { recursive: true, force: true }));

describe("README cites only commands that exist (W10)", () => {
  it("every `npm run <script>` in the README exists in package.json", () => {
    const cited = new Set();
    for (const m of README.matchAll(/npm run ([A-Za-z0-9:_-]+)/g)) cited.add(m[1]);
    expect(cited.size).toBeGreaterThan(0);
    for (const script of cited) {
      expect(PKG.scripts[script], `README cites missing npm script: ${script}`).toBeTruthy();
    }
  });

  it("every `mind-ontology <verb>` in the README is a real dispatcher command", () => {
    const verbs = new Set();
    for (const m of README.matchAll(/mind-ontology\s+([a-z][a-z-]*)\b/g)) verbs.add(m[1]);
    // Words after "mind-ontology" that are prose, not verbs, never match the
    // lowercase pattern in this README (e.g. "CLI"); the emit verb must.
    expect(verbs.has("emit")).toBe(true);
    for (const verb of verbs) {
      expect(COMMANDS[verb], `README cites unknown mind-ontology command: ${verb}`).toBeTruthy();
    }
  });

  it("README flags --target/--full/--check/--risk it mentions are real engine flags", () => {
    // Cheap cross-check: each flag the README names appears in the engine's
    // own help/usage text, so prose can't invent a flag.
    const emitHelp = runCli(["emit", "--help"]).stdout;
    for (const flag of ["--target", "--full", "--check"]) {
      expect(README).toContain(flag);
      expect(emitHelp, `engine emit --help does not document ${flag}`).toContain(flag);
    }
    expect(README).toContain("--risk auto");
  });
});

describe("README output examples are the real output of the shipped engine (W10)", () => {
  it("the emit walkthrough lines match a real emit of the template ontology", () => {
    const emit = runCli(["emit"], project);
    expect(emit.status, emit.stderr).toBe(0);
    for (const line of emit.stdout.trim().split("\n")) {
      expect(README, `README emit output is stale; real line: ${line}`).toContain(line);
    }
  });

  it("the quoted artifact header is byte-real (digests included)", () => {
    const artifact = readFileSync(join(project, "AGENTS.md"), "utf8");
    const headerEnd = artifact.indexOf("-->");
    const header = artifact.slice(0, headerEnd + "-->".length);
    expect(README, "README's quoted AGENTS.md emit header is stale").toContain(header);
  });

  it("the fresh `emit --check` block matches reality, exit 0", () => {
    const check = runCli(["emit", "--check"], project);
    expect(check.status, check.stderr).toBe(0);
    for (const line of check.stdout.trim().split("\n")) {
      expect(README, `README fresh-check output is stale; real line: ${line}`).toContain(line);
    }
  });

  it("the drift block matches reality after a source edit, exit 1", () => {
    appendFileSync(
      join(project, ".agentctx", "direction.md"),
      "\n## Current focus #direction\nShip the compile-target launch.\n",
    );
    const check = runCli(["emit", "--check"], project);
    expect(check.status).toBe(1);
    for (const line of check.stdout.trim().split("\n")) {
      expect(README, `README drift output is stale; real line: ${line}`).toContain(line);
    }
  });

  it("the claimed exit-code contract (0 fresh / 1 drift / 2 hard error) is real", () => {
    expect(README).toMatch(/0 fresh\s*·\s*1 drift.*2 hard error/);
    // 1 = drift is exercised above; 2 = hard error, e.g. an unknown target.
    const hard = runCli(["emit", "--check", "--target", "nope"], project);
    expect(hard.status).toBe(2);
  });
});
