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
  const dir = mkdtempSync(join(tmpdir(), "agentctx-cqdeep-"));
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

// All surfaced blocks for one source file, with their answer material flattened.
function answerTextFor(pack, file) {
  return pack.selected
    .filter((b) => b.file === file)
    .map((b) => `${b.title}\n${b.body}`)
    .join("\n")
    .toLowerCase();
}

// Deeper than the M55 file-presence table: each row is one competency question from
// cq.md, and it asserts that EVERY source file the CQ names actually surfaces for the
// CQ's own question AND carries the concrete answer material (a stable heading/body
// fragment), not just that the file is present. `answers` pins the answer-bearing
// content so a file that surfaces as an empty or wrong block still fails.
//
//   cqTitle  — the exact CQ heading in cq.md (binds the row to the template; the sync
//              guard below fails if a CQ is added/removed/renamed without updating here).
//   task     — how an agent would ask, in prose (no tag injection).
//   sources  — every file this CQ must make answerable (superset of the files the CQ
//              names in backticks; the guard verifies the backtick set is covered).
//   answers  — { file, needle, reason }: a stable fragment that must appear in that
//              file's surfaced answer material, AND the selection reason that the block
//              must carry. "matched" = earned by scoring against the task; "always" =
//              the safety floor (constraints.md); "risk-forced" = risk-gate inclusion.
//              Asserting reason proves the retrieval is genuine (not a lucky always-floor
//              hit passing as a scored match, or vice-versa).
const DEEP_CASES = [
  {
    cqTitle: "What should the agent know before starting?",
    task: "Before starting, what is the current direction, which prior decision keeps the free layer self-hosted, and what does the context pack term mean?",
    sources: ["direction.md", "decisions.md", "glossary.md"],
    answers: [
      { file: "direction.md", needle: "current direction", reason: "matched" },
      { file: "decisions.md", needle: "self-host", reason: "matched" },
      { file: "glossary.md", needle: "context pack", reason: "matched" },
    ],
  },
  {
    cqTitle: "What is the current direction this work serves?",
    task: "What is the current direction and near-term priorities this work serves?",
    sources: ["direction.md"],
    answers: [{ file: "direction.md", needle: "current direction", reason: "matched" }],
  },
  {
    cqTitle: "What must the agent avoid?",
    task: "What actions must the agent avoid because they are forbidden, risky, or destructive?",
    sources: ["constraints.md"],
    // constraints.md is always included; the safety floor, not a scored match.
    answers: [{ file: "constraints.md", needle: "destructive", reason: "always" }],
  },
  {
    cqTitle: "Which writes are forbidden, and when must the agent fail closed?",
    task: "Which writes are forbidden — deploy, migration, secrets, production config, live data — and when must the agent fail closed?",
    sources: ["constraints.md"],
    // This task mentions risk keywords (deploy, secrets) so the risk gate may also
    // fire; asserting "always" still holds since constraints.md is always present.
    answers: [{ file: "constraints.md", needle: "secret", reason: "always" }],
  },
  {
    cqTitle: "Which files am I allowed to write for this task?",
    task: "Which files, paths, and repos am I allowed to write for the active project given the current direction?",
    sources: ["projects.md", "direction.md", "constraints.md"],
    answers: [
      { file: "projects.md", needle: "active project", reason: "matched" },
      { file: "direction.md", needle: "current direction", reason: "matched" },
    ],
  },
  {
    cqTitle: "Which prior decision applies?",
    task: "Which prior decision applies — for example, why was the free layer kept self-hosted as OSS?",
    sources: ["decisions.md"],
    answers: [{ file: "decisions.md", needle: "self-host", reason: "matched" }],
  },
  {
    cqTitle: "Is this capability local or hosted?",
    task: "Is this capability part of the local OSS layer or an optional, fail-closed hosted adapter?",
    sources: ["glossary.md"],
    answers: [{ file: "glossary.md", needle: "hosted adapter", reason: "matched" }],
  },
];

// Parse the canonical cq.md into its competency-question blocks (every block tagged #cq).
function cqBlocks() {
  return parseMarkdownBlocks(readFileSync(CQ_PATH, "utf8"), "cq.md").filter((b) => b.tags.includes("cq"));
}

// The .md source files a CQ block names in backticks (e.g. `direction.md`), excluding cq.md.
function filesNamedBy(block) {
  return new Set(
    [...`${block.title}\n${block.body}`.matchAll(/`([a-z][a-z-]*\.md)`/g)].map((m) => m[1]).filter((f) => f !== "cq.md"),
  );
}

describe("CQ regression (deep): each CQ is answerable from its named source blocks", () => {
  for (const { cqTitle, task, sources, answers } of DEEP_CASES) {
    it(`"${cqTitle}" surfaces its named sources with answer material and correct selection reason`, () => {
      const pack = compile(project(), task);

      for (const file of sources) {
        expect(SOURCE_FILES, `${file} is not a compiled source file`).toContain(file);
        const hits = pack.selected.filter((b) => b.file === file);
        expect(hits.length, `${file} did not surface for: ${task}`).toBeGreaterThan(0);
        expect(
          hits.some((b) => b.body.trim().length > 0),
          `${file} surfaced only empty blocks for: ${task}`,
        ).toBe(true);
      }

      for (const { file, needle, reason } of answers) {
        const hits = pack.selected.filter((b) => b.file === file);
        expect(
          answerTextFor(pack, file).includes(needle.toLowerCase()),
          `${file} surfaced but its answer material is missing "${needle}" for: ${task}`,
        ).toBe(true);
        // Verify the block was selected for the right reason — not just that it appeared.
        // "matched" = scorer earned it from the task text; "always" = safety floor.
        expect(
          hits.some((b) => b.reason === reason),
          `${file} has no block with reason="${reason}" for: ${task} (got: [${hits.map((b) => b.reason).join(", ")}])`,
        ).toBe(true);
      }
    });
  }

  it("#scope: the write-surface question surfaces BOTH projects.md and direction.md blocks", () => {
    // The headline product promise: the scope CQ must let an agent see the project AND
    // the direction at once, from real answer blocks — not one or the other.
    const scope = DEEP_CASES.find((c) => c.cqTitle === "Which files am I allowed to write for this task?");
    const pack = compile(project(), scope.task);

    const projects = pack.selected.filter((b) => b.file === "projects.md");
    const direction = pack.selected.filter((b) => b.file === "direction.md");

    expect(projects.length, "projects.md must surface for the scope question").toBeGreaterThan(0);
    expect(direction.length, "direction.md must surface for the scope question").toBeGreaterThan(0);
    expect(answerTextFor(pack, "projects.md")).toContain("active project");
    expect(answerTextFor(pack, "direction.md")).toContain("current direction");
  });

  it("sync guard: the deep table covers exactly the CQs in cq.md", () => {
    // Add/remove/rename a competency question in cq.md and this fails until the deep
    // table is updated in lockstep — drift cannot silently change the verified set.
    const templateTitles = new Set(cqBlocks().map((b) => b.title.trim()));
    const tableTitles = new Set(DEEP_CASES.map((c) => c.cqTitle));

    for (const title of templateTitles) {
      expect(tableTitles.has(title), `cq.md has CQ "${title}" with no deep regression row`).toBe(true);
    }
    for (const title of tableTitles) {
      expect(templateTitles.has(title), `deep table has row "${title}" not present in cq.md`).toBe(true);
    }
  });

  it("sync guard: every file a CQ names in backticks is covered by its row's sources", () => {
    // If a CQ starts naming a new source file, the matching row must promise to surface
    // it — so the answer assertions cannot lag behind the CQ text.
    for (const block of cqBlocks()) {
      const named = filesNamedBy(block);
      if (named.size === 0) continue;
      const row = DEEP_CASES.find((c) => c.cqTitle === block.title.trim());
      expect(row, `cq.md CQ "${block.title.trim()}" has no deep regression row`).toBeTruthy();
      const sources = new Set(row.sources);
      for (const file of named) {
        expect(sources.has(file), `CQ "${block.title.trim()}" names ${file} but its row does not list it in sources`).toBe(
          true,
        );
      }
    }
  });

  it("sync guard: every answer's reason is 'matched' or 'always' (no unknown reasons in table)", () => {
    const KNOWN_REASONS = new Set(["matched", "always", "risk-forced"]);
    for (const { cqTitle, answers } of DEEP_CASES) {
      for (const { file, reason } of answers) {
        expect(
          KNOWN_REASONS.has(reason),
          `DEEP_CASES row "${cqTitle}" answer for ${file} has unknown reason "${reason}"`,
        ).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Negative controls: unrelated topics must not cross-contaminate
// ---------------------------------------------------------------------------

describe("CQ regression (deep): negative controls — selection reason isolation", () => {
  it("constraints.md always appears in every CQ task's pack but never via plain 'matched'", () => {
    // The safety floor guarantee: constraints.md must be present for every task (the
    // always-include invariant) but must not appear with reason "matched" — that would
    // mean the task text scored against constraint content, implying a false coupling.
    for (const { task } of DEEP_CASES) {
      const pack = compile(project(), task);
      const constraintBlocks = pack.selected.filter((b) => b.file === "constraints.md");
      expect(constraintBlocks.length, `constraints.md missing from pack for: ${task}`).toBeGreaterThan(0);
      expect(
        constraintBlocks.every((b) => b.reason === "always" || b.reason === "risk-forced"),
        `constraints.md has a plain "matched" block for: ${task} — safety floor is masquerading as scored retrieval`,
      ).toBe(true);
    }
  });

  it("direction.md never appears with reason 'always' in any CQ task", () => {
    // direction.md is a scored source, never the always-include floor. If it ever
    // appears with reason "always" the always-include guarantee has expanded and
    // the always-only invariant for constraints.md would be meaningless.
    for (const { task } of DEEP_CASES) {
      const pack = compile(project(), task);
      const dirAlways = pack.selected.filter((b) => b.file === "direction.md" && b.reason === "always");
      expect(dirAlways.length, `direction.md appeared with reason "always" for: ${task}`).toBe(0);
    }
  });

  it("projects.md never appears with reason 'always' in any CQ task", () => {
    // projects.md is a scored source too — only constraints.md has the always-include
    // privilege. Asserting projects.md stays "matched" keeps the scorer's role clear.
    for (const { task } of DEEP_CASES) {
      const pack = compile(project(), task);
      const projAlways = pack.selected.filter((b) => b.file === "projects.md" && b.reason === "always");
      expect(projAlways.length, `projects.md appeared with reason "always" for: ${task}`).toBe(0);
    }
  });
});
