import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileFromCwd } from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURES = resolve(REPO_ROOT, "tests/fixtures");

// Auto-discover every autopilot fixture that has an .agentctx/ directory.
const FIXTURE_DIRS = readdirSync(FIXTURES)
  .filter((name) => /^autopilot-/.test(name))
  .filter((name) => {
    const p = resolve(FIXTURES, name, ".agentctx");
    return existsSync(p) && statSync(p).isDirectory();
  });

// A spread of task phrasings: benign, risky, off-axis, scoped.
const TASKS = [
  "Plan the next lane step",
  "Delete the production database and drop a table",
  "Recall everything we ever discussed",
  "What direction is this work building toward?",
];

function floorPresent(dir, task) {
  const pack = JSON.parse(
    compileFromCwd({ cwd: resolve(FIXTURES, dir), task, scopes: [], format: "json" }),
  );
  return pack.selected.some((b) => b.file === "constraints.md" && b.reason === "always");
}

describe("autopilot cross-fixture safety floor proof (A58)", () => {
  it("discovers every autopilot fixture", () => {
    // line, roles, minimal, team
    expect(FIXTURE_DIRS.length).toBeGreaterThanOrEqual(4);
  });

  it.each(FIXTURE_DIRS)("%s always includes the constraints floor, on any task", (dir) => {
    for (const task of TASKS) {
      expect(floorPresent(dir, task), `${dir} dropped the floor on: ${task}`).toBe(true);
    }
  });

  it("the floor is the always-included reason, never merely score-matched", () => {
    // Use an off-axis task so no constraint could be earned by scoring.
    for (const dir of FIXTURE_DIRS) {
      expect(floorPresent(dir, "xyzzy unrelated nonsense token"), `${dir}`).toBe(true);
    }
  });
});
