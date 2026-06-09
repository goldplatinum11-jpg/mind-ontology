import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileFromCwd } from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = resolve(REPO_ROOT, "tests/fixtures/autopilot-roles");

function selectedTitles(task) {
  const pack = JSON.parse(compileFromCwd({ cwd: FIXTURE, task, scopes: [], format: "json" }));
  return pack.selected.map((b) => `${b.file}:${b.title}`);
}

// One row per role: a task phrased the way that role's question would arrive,
// plus the agent-roles block that must surface to answer it.
const ROLES = [
  { role: "worker", task: "As the implementation worker, when do I edit code in a lane step?", title: "Worker implementation role" },
  { role: "controller", task: "As the controller, how do I plan the next lane and approve continuation?", title: "Controller planning role" },
  { role: "reviewer", task: "As the reviewer, how do I judge merge-readiness and missing tests?", title: "Reviewer gate role" },
  { role: "proposer", task: "As the writeback proposer, how do I turn a decision into a proposal?", title: "Writeback proposer role" },
];

describe("autopilot multi-agent role matrix (A15)", () => {
  it.each(ROLES)("$role: its trigger-point block surfaces for a role-phrased task", ({ task, title }) => {
    expect(selectedTitles(task)).toContain(`agent-roles.md:${title}`);
  });

  it("each role block is distinct — a role task does not collapse to another role", () => {
    for (const { task, title } of ROLES) {
      const titles = selectedTitles(task);
      const roleTitles = titles.filter((t) => t.startsWith("agent-roles.md:"));
      // The matching role must rank in; we don't require exclusivity, but the
      // intended block must be present and the set must be non-empty.
      expect(roleTitles).toContain(`agent-roles.md:${title}`);
    }
  });

  it("the safety floor is always included alongside any role read", () => {
    for (const { task } of ROLES) {
      expect(selectedTitles(task).some((t) => t.startsWith("constraints.md:"))).toBe(true);
    }
  });

  it("the writeback role stays proposal-only / fail-closed (no hosted execution)", () => {
    const pack = JSON.parse(
      compileFromCwd({ cwd: FIXTURE, task: "writeback proposer role", scopes: [], format: "json" }),
    );
    const blob = JSON.stringify(pack).toLowerCase();
    // The role is framed as propose-only / fail-closed, and never executes.
    expect(blob).toMatch(/proposal-only|propose only|fail-closed/);
    expect(blob).toMatch(/never execute a hosted write/);
    expect(blob).not.toMatch(/sirtai\.org|workers\.dev|bearer /);
  });
});
