import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileFromCwd } from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = resolve(REPO_ROOT, "tests/fixtures/autopilot-line");
const CQ = resolve(FIXTURE, ".agentctx/cq.md");

function selectedFiles(task) {
  const pack = JSON.parse(compileFromCwd({ cwd: FIXTURE, task, scopes: [], format: "json" }));
  return pack.selected.map((b) => b.file);
}

// Each autopilot CQ, phrased the way an agent would actually ask it, plus the
// source file that must surface in the compiled pack to answer it.
const CASES = [
  {
    topic: "worker reading protocol",
    task: "When does the worker call get_context and list_constraints in a lane step?",
    mustSurface: "agent-roles.md",
  },
  {
    topic: "safety re-check",
    task: "What must the agent re-check before a destructive or irreversible write?",
    mustSurface: "constraints.md",
  },
  {
    topic: "line direction",
    task: "What direction is this autopilot line building toward right now?",
    mustSurface: "direction.md",
  },
];

describe("autopilot CQ regression — CQs are answerable from named sources (A10)", () => {
  it("the fixture ships a cq.md", () => {
    expect(existsSync(CQ)).toBe(true);
  });

  it.each(CASES)("$topic: '$task' surfaces $mustSurface", ({ task, mustSurface }) => {
    expect(selectedFiles(task)).toContain(mustSurface);
  });

  it("every source file the cq.md names is one a regression task actually surfaces", () => {
    const named = [...readFileSync(CQ, "utf8").matchAll(/`([a-z-]+\.md)`/g)].map((m) => m[1]);
    const surfaced = new Set(CASES.flatMap((c) => selectedFiles(c.task)));
    // constraints.md is always surfaced; the others must be earned by some case.
    for (const file of new Set(named)) {
      expect(surfaced.has(file), `cq.md names ${file} but no regression task surfaces it`).toBe(true);
    }
  });

  it("an unrelated task surfaces only the constraints safety floor (matches are earned)", () => {
    const files = selectedFiles("Describe the weather in Tokyo today");
    expect(files).toContain("constraints.md");
    expect(files).not.toContain("direction.md");
    expect(files).not.toContain("agent-roles.md");
  });
});
