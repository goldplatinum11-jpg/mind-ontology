import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { SOURCE_FILES, compileFromCwd, parseMarkdownBlocks } from "../../scripts/agentctx/compile.mjs";
import { initAgentctx } from "../../scripts/agentctx/init.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CQ_PATH = resolve(REPO_ROOT, "templates/mind-ontology/.agentctx/cq.md");

const tempRoots = [];
function project() {
  const dir = mkdtempSync(join(tmpdir(), "agentctx-cqtable-"));
  tempRoots.push(dir);
  initAgentctx({ cwd: dir });
  return dir;
}
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

function compile(dir, task) {
  return JSON.parse(compileFromCwd({ cwd: dir, task, format: "json" }));
}

// M55 — the product promise made concrete: given a real-world task phrased the way
// an agent would ask it, the compiler must surface the ontology file that answers it.
// This is the "competency questions are the verification core" claim regressed at the
// retrieval layer, one row per CQ topic family. The tasks are natural language — no
// tag injection — so the rows fail if scoring drifts away from answering the question.
//
//   family    — the CQ topic this row guards (must cover every required family below).
//   task      — how an agent would actually ask, in prose.
//   expects   — the source file that must appear in the compiled pack.
//   reason    — how it must appear: "matched" = earned by scoring against the task;
//               "always" = the safety floor (constraints.md is always included).
const CASES = [
  {
    family: "project/scope",
    task: "What is the active project and which repos belong to it?",
    expects: "projects.md",
    reason: "matched",
  },
  {
    family: "project/scope",
    task: "What is the current direction and near-term priorities for this work?",
    expects: "direction.md",
    reason: "matched",
  },
  {
    family: "constraints/safety",
    task: "What must the agent avoid, and which writes are forbidden or destructive?",
    expects: "constraints.md",
    reason: "always",
  },
  {
    family: "vocabulary/glossary",
    task: "What does the term context pack mean in the glossary?",
    expects: "glossary.md",
    reason: "matched",
  },
  {
    family: "architecture/layering",
    task: "Explain the architecture layers and the layer map.",
    expects: "architecture.md",
    reason: "matched",
  },
  {
    family: "decisions/rationale",
    task: "Why did we decide to keep the free layer self-hosted as OSS?",
    expects: "decisions.md",
    reason: "matched",
  },
  {
    family: "agent-roles/delegation",
    task: "Which agent role handles code review and delegation?",
    expects: "agent-roles.md",
    reason: "matched",
  },
];

// The families the product promise must keep answerable. If a row is deleted, the
// coverage guard below fails — drift cannot silently drop a whole CQ family.
const REQUIRED_FAMILIES = [
  "project/scope",
  "constraints/safety",
  "vocabulary/glossary",
  "architecture/layering",
  "decisions/rationale",
  "agent-roles/delegation",
];

describe("CQ regression (table): each CQ task surfaces the file that answers it (M55)", () => {
  for (const { family, task, expects, reason } of CASES) {
    it(`[${family}] "${task}" surfaces ${expects} (${reason})`, () => {
      const pack = compile(project(), task);
      const hit = pack.selected.find((b) => b.file === expects);

      expect(hit, `${expects} did not surface for: ${task}`).toBeTruthy();
      expect(SOURCE_FILES, `${expects} is not a compiled source file`).toContain(expects);
      // It must appear for the documented reason — a "matched" row proves the scorer
      // earned the answer from the task, not that the always-include floor masked it.
      expect(hit.reason, `${expects} surfaced via "${hit.reason}", expected "${reason}"`).toBe(reason);
      // And it must actually carry answer material, not an empty heading.
      expect(hit.body.trim().length, `${expects} block is empty`).toBeGreaterThan(0);
    });
  }

  it("the table covers every required CQ topic family", () => {
    const covered = new Set(CASES.map((c) => c.family));
    for (const family of REQUIRED_FAMILIES) {
      expect(covered.has(family), `no CQ regression row covers ${family}`).toBe(true);
    }
  });

  it("an unrelated task still surfaces the safety floor but not every topic file", () => {
    // Negative control: when the task matches nothing, constraints.md is still the
    // always-included floor, but topic files like glossary.md must NOT appear — proof
    // the matched rows above are earned retrieval, not everything-always-included.
    const pack = compile(project(), "xyzzy plugh frobnicate quux");
    const constraints = pack.selected.filter((b) => b.file === "constraints.md");
    expect(constraints.length, "constraints.md is the always-included safety floor").toBeGreaterThanOrEqual(1);
    expect(constraints.every((b) => b.reason === "always")).toBe(true);
    expect(pack.selected.some((b) => b.file === "glossary.md"), "glossary.md should not match an unrelated task").toBe(
      false,
    );
  });

  it("the safety task is classified risky and forces safety context", () => {
    // The constraints/safety row's task names destructive/forbidden writes; the risk
    // gate must catch that and the pack must carry safety material.
    const pack = compile(project(), CASES.find((c) => c.family === "constraints/safety").task);
    expect(pack.risk.level).toBe("risky");
    expect(
      pack.selected.some((b) => b.file === "constraints.md" || b.reason === "risk-forced"),
      "risky safety task must surface constraints/forced safety context",
    ).toBe(true);
  });

  it("every source file the template CQs name surfaces for its matching topic task", () => {
    // Bridge cq.md's promises to retrieval: any file a competency question names must
    // be one our table actually surfaces (or the always-included floor). Locks the CQ
    // text and the compiler behavior together so neither drifts without the other.
    const cqBody = readFileSync(CQ_PATH, "utf8");
    const named = new Set(
      [...cqBody.matchAll(/`([a-z][a-z-]*\.md)`/g)].map((m) => m[1]).filter((f) => f !== "cq.md"),
    );
    const surfaced = new Set();
    for (const { task } of CASES) {
      for (const b of compile(project(), task).selected) surfaced.add(b.file);
    }
    for (const file of named) {
      expect(surfaced.has(file), `CQ names ${file} but no regression task surfaces it`).toBe(true);
    }
  });
});
