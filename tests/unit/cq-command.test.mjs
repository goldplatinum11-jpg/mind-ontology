import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it, vi } from "vitest";
import { evaluateCqs, parseCqs } from "../../scripts/agentctx/cq-core.mjs";

// W8 — `mind-ontology cq` (W2 §6) and the answerability predicate locked with
// table-driven fixtures. The predicate is deterministic and structural: a CQ
// is answered by a non-cq.md block that is either a scored match against the
// question text or shares one of the CQ's topic tags. The gate applies the
// ratified amendment: required topics (#context / #safety) fail the run;
// other unanswered CQs are advisory.

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = resolve(REPO_ROOT, "scripts/agentctx/cli.mjs");
const FIXTURES = resolve(REPO_ROOT, "tests/fixtures");

vi.setConfig({ testTimeout: 60_000 });

const tempRoots = [];
afterAll(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
}

function project(files) {
  const cwd = mkdtempSync(join(tmpdir(), "mo-cq-"));
  tempRoots.push(cwd);
  mkdirSync(join(cwd, ".agentctx"));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(cwd, ".agentctx", name), content);
  }
  return cwd;
}

// ---------------------------------------------------------------------------
// Table-driven fixture run (the packet's W8 guard): every example ontology
// shipping a cq.md must answer all of its CQs, and the named source file must
// be among the contributors — the CQ regression contract extended to the
// command surface.
// ---------------------------------------------------------------------------

// `answeredBy: null` rows document a real, accepted gap: the CQ's verbatim
// title does not surface its source file (the existing per-fixture CQ
// regression suites answer those topics through rephrased tasks), and the
// topic is advisory — the gate stays green while the report shows the gap.
const FIXTURE_TABLE = [
  {
    fixture: "autopilot-solo",
    answered: 3,
    expectations: [
      { id: 1, answeredBy: "identity.md" },
      { id: 2, answeredBy: "direction.md" },
      { id: 3, answeredBy: "projects.md" },
    ],
  },
  {
    fixture: "autopilot-team",
    answered: 2,
    expectations: [
      { id: 1, answeredBy: null },
      { id: 2, answeredBy: "direction.md" },
      { id: 3, answeredBy: "agent-roles.md" },
    ],
  },
];

describe("W8 — fixture ontologies under the cq verdict (table-driven)", () => {
  for (const { fixture, answered, expectations } of FIXTURE_TABLE) {
    it(`${fixture}: gate green, ${answered} answered, expected contributors present`, () => {
      const cwd = resolve(FIXTURES, fixture);
      const r = runCli(["cq", "--cwd", cwd, "--format", "json"]);
      expect(r.status, r.stderr).toBe(0);
      const out = JSON.parse(r.stdout);
      expect(out.ok).toBe(true);
      expect(out.answered).toBe(answered);
      for (const { id, answeredBy } of expectations) {
        const cq = out.cqs.find((c) => c.id === id);
        if (answeredBy === null) {
          expect(cq.answered, `${fixture} CQ ${id} is a documented advisory gap`).toBe(false);
          expect(cq.required).toBe(false);
        } else {
          expect(cq.answered, `${fixture} CQ ${id}`).toBe(true);
          expect(
            cq.answered_by.map((b) => b.sourceFile),
            `${fixture} CQ ${id} should be answered by ${answeredBy}`,
          ).toContain(answeredBy);
        }
      }
    });
  }

  it("the template ontology answers all of its CQs, including both required topics", () => {
    const cwd = mkdtempSync(join(tmpdir(), "mo-cq-tpl-"));
    tempRoots.push(cwd);
    expect(runCli(["init", "--cwd", cwd]).status).toBe(0);
    const out = JSON.parse(runCli(["cq", "--cwd", cwd, "--format", "json"]).stdout);
    expect(out.ok).toBe(true);
    expect(out.answered).toBe(out.total);
    expect(out.cqs.some((c) => c.tags.includes("context") && c.required)).toBe(true);
    expect(out.cqs.some((c) => c.tags.includes("safety") && c.required)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The predicate, case by case (in-process, no subprocess).
// ---------------------------------------------------------------------------

const PREDICATE_TABLE = [
  {
    name: "answered via topic-tag intersection with an always-included constraint",
    sources: {
      "constraints.md": "# C\n\n## No destructive writes #safety\n\nnever drop data\n",
      "cq.md": "# CQ\n\n## What must the agent avoid? #cq #safety\n\nbody\n",
    },
    expect: { answered: true, by: "constraints.md" },
  },
  {
    name: "answered via scoring against the question text (no shared tag)",
    sources: {
      "constraints.md": "# C\n\n## Keep things small\n\nstay focused\n",
      "direction.md": "# D\n\n## Launch priority\n\nship the launch priority feature first\n",
      "cq.md": "# CQ\n\n## What is the launch priority? #cq #direction\n\nbody\n",
    },
    expect: { answered: true, by: "direction.md" },
  },
  {
    name: "unanswered when nothing matches and no tag intersects",
    sources: {
      "constraints.md": "# C\n\n## Keep things small\n\nstay focused\n",
      "cq.md": "# CQ\n\n## Which deployment region hosts the cluster? #cq #infra\n\nbody\n",
    },
    expect: { answered: false },
  },
  {
    name: "a CQ never answers itself (cq.md blocks are excluded as contributors)",
    sources: {
      "constraints.md": "# C\n\n## Keep things small\n\nstay focused\n",
      "cq.md":
        "# CQ\n\n## Which deployment region hosts the cluster? #cq #infra\n\nthe deployment region cluster question repeats its own words\n",
    },
    expect: { answered: false },
  },
];

describe("W8 — answerability predicate (table-driven)", () => {
  for (const row of PREDICATE_TABLE) {
    it(row.name, () => {
      const verdict = evaluateCqs(row.sources);
      expect(verdict.total).toBe(1);
      const [cq] = verdict.cqs;
      expect(cq.answered).toBe(row.expect.answered);
      if (row.expect.by) {
        expect(cq.answered_by.map((b) => b.sourceFile)).toContain(row.expect.by);
      }
      if (!row.expect.answered) {
        expect(cq.answered_by).toEqual([]);
      }
    });
  }

  it("the predicate is deterministic across runs", () => {
    const run = () => JSON.stringify(evaluateCqs(PREDICATE_TABLE[0].sources));
    expect(run()).toBe(run());
  });

  it("ids are 1-based source order and topics strip the cq marker", () => {
    const cqs = parseCqs({
      "cq.md":
        "# CQ\n\n## First? #cq #context\n\na\n\n## Second? #cq #safety #boundary\n\nb\n",
    });
    expect(cqs.map((c) => c.id)).toEqual([1, 2]);
    expect(cqs[0].topics).toEqual(["context"]);
    expect(cqs[1].topics).toEqual(["safety", "boundary"]);
  });
});

// ---------------------------------------------------------------------------
// Gate strength (the W2 §6 ratified amendment).
// ---------------------------------------------------------------------------

describe("W8 — required-only gate", () => {
  const UNANSWERABLE = "## Which deployment region hosts the cluster?";

  it("an unanswered required CQ fails the gate: exit 1, FAIL summary on stdout", () => {
    const cwd = project({
      "constraints.md": "# C\n\n## Keep things small\n\nstay focused\n",
      "cq.md": `# CQ\n\n${UNANSWERABLE} #cq #safety\n\nbody\n`,
    });
    const r = runCli(["cq", "--cwd", cwd]);
    expect(r.status).toBe(1);
    expect(r.stderr).toBe("");
    expect(r.stdout).toContain("UNANSWERED  1. Which deployment region hosts the cluster? (required)");
    expect(r.stdout).toContain("FAIL - 1 required CQ(s) unanswered (0 of 1 answered)");
  });

  it("an unanswered advisory CQ reports UNANSWERED but exits 0", () => {
    const cwd = project({
      "constraints.md": "# C\n\n## Keep things small\n\nstay focused\n",
      "cq.md": `# CQ\n\n${UNANSWERABLE} #cq #infra\n\nbody\n`,
    });
    const r = runCli(["cq", "--cwd", cwd]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("UNANSWERED  1. Which deployment region hosts the cluster? (advisory)");
    expect(r.stdout).toContain("OK - 0 of 1 CQ(s) answered");
  });
});

// ---------------------------------------------------------------------------
// CLI surface: --id, hard errors, JSON shape.
// ---------------------------------------------------------------------------

describe("W8 — cq CLI surface", () => {
  function templateProject() {
    const cwd = mkdtempSync(join(tmpdir(), "mo-cq-cli-"));
    tempRoots.push(cwd);
    expect(runCli(["init", "--cwd", cwd]).status).toBe(0);
    return cwd;
  }

  it("--id restricts the run and the verdict to one CQ", () => {
    const cwd = templateProject();
    const out = JSON.parse(runCli(["cq", "--cwd", cwd, "--id", "3", "--format", "json"]).stdout);
    expect(out.total).toBe(1);
    expect(out.cqs).toHaveLength(1);
    expect(out.cqs[0].id).toBe(3);
  });

  it("--id out of range is a hard error naming the valid range", () => {
    const cwd = templateProject();
    const r = runCli(["cq", "--cwd", cwd, "--id", "99"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toBe("");
    expect(r.stderr).toMatch(/--id must be between 1 and 7, got: 99/);
  });

  it("missing cq.md is a hard error with the documented message", () => {
    const cwd = templateProject();
    unlinkSync(join(cwd, ".agentctx", "cq.md"));
    const r = runCli(["cq", "--cwd", cwd]);
    expect(r.status).toBe(1);
    expect(r.stdout).toBe("");
    expect(r.stderr).toMatch(
      /Missing \.agentctx\/cq\.md\. Add competency questions \(see the cq schema\) before running cq\./,
    );
  });

  it("the JSON shape carries the normative keys", () => {
    const cwd = templateProject();
    const out = JSON.parse(runCli(["cq", "--cwd", cwd, "--format", "json"]).stdout);
    expect(Object.keys(out)).toEqual(["ok", "total", "answered", "cqs"]);
    for (const cq of out.cqs) {
      expect(Object.keys(cq)).toEqual([
        "id",
        "question",
        "tags",
        "required",
        "answered",
        "answered_by",
      ]);
      for (const b of cq.answered_by) {
        expect(Object.keys(b)).toEqual(["sourceFile", "heading"]);
      }
    }
  });

  it("two runs are byte-identical (no wall-clock in the verdict)", () => {
    const cwd = templateProject();
    const args = ["cq", "--cwd", cwd, "--format", "json"];
    expect(runCli(args).stdout).toBe(runCli(args).stdout);
  });
});
