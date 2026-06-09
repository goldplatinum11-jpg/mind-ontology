import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileFromCwd } from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = resolve(REPO_ROOT, "tests/fixtures/autopilot-line");
const SRC_DIR = resolve(FIXTURE, ".agentctx");

function pack(task) {
  return JSON.parse(compileFromCwd({ cwd: FIXTURE, task, scopes: [], format: "json" }));
}

// Count every authored block across the fixture so we can prove "no full dump".
function totalBlockCount() {
  let n = 0;
  for (const file of readdirSync(SRC_DIR)) {
    if (!file.endsWith(".md")) continue;
    const headings = readFileSync(resolve(SRC_DIR, file), "utf8").match(/^## /gm);
    n += headings ? headings.length : 0;
  }
  return n;
}

// Wrong-axis: phrased as memory/history lookups. The constitution is a
// task-scoped policy, not a memory store, so these must NOT pull policy blocks
// they don't lexically earn — only the always-included safety floor.
const WRONG_AXIS = [
  "What did we decide last week in our standup?",
  "Recall every conversation we have ever had about pricing.",
  "List the full history of everything stored in memory.",
  "Remember what I told you yesterday about my weekend.",
];

// Right-axis: task-scoped policy reads that SHOULD earn a specific file.
const RIGHT_AXIS = [
  { task: "When should the worker call list_constraints before a write?", file: "agent-roles.md" },
  { task: "What direction is this autopilot line building toward?", file: "direction.md" },
];

describe("wrong-axis negative-control corpus (A13)", () => {
  it("the fixture has enough blocks that a full dump would be visible", () => {
    expect(totalBlockCount()).toBeGreaterThanOrEqual(8);
  });

  it.each(WRONG_AXIS)("memory-lookup task is not turned into a dump: %s", (task) => {
    const selected = pack(task).selected;
    const files = selected.map((b) => b.file);
    // Always-included safety floor is present...
    expect(files).toContain("constraints.md");
    // ...but the off-topic policy files are NOT pulled in.
    expect(files).not.toContain("direction.md");
    expect(files).not.toContain("agent-roles.md");
    // And the pack is scoped, never the whole ontology.
    expect(selected.length).toBeLessThan(totalBlockCount());
  });

  it("every wrong-axis pack is strictly smaller than a right-axis pack on the same fixture", () => {
    const wrongMax = Math.max(...WRONG_AXIS.map((t) => pack(t).selected.length));
    const rightMin = Math.min(...RIGHT_AXIS.map((c) => pack(c.task).selected.length));
    expect(wrongMax).toBeLessThanOrEqual(rightMin);
  });

  it.each(RIGHT_AXIS)("right-axis task surfaces its policy file: $task", ({ task, file }) => {
    expect(pack(task).selected.map((b) => b.file)).toContain(file);
  });

  it("no wrong-axis pack emits a hosted endpoint or secret", () => {
    for (const task of WRONG_AXIS) {
      const blob = JSON.stringify(pack(task)).toLowerCase();
      expect(blob).not.toMatch(/sirtai\.org|workers\.dev|bearer /);
    }
  });
});
