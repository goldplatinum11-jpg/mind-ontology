import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-reading-protocol-v1.md");

describe("autopilot reading protocol v1 (A2)", () => {
  it("ships the reading protocol doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("binds get_context to task start and list_constraints to risky writes", () => {
    const text = readFileSync(DOC, "utf8");
    expect(text).toContain("get_context(task)");
    expect(text).toContain("list_constraints()");
    const lower = text.toLowerCase();
    expect(lower).toMatch(/task start|start of every task/);
    expect(lower).toMatch(/destructive|structural|irreversible/);
  });

  it("specifies trigger points for both worker and controller roles", () => {
    const lower = readFileSync(DOC, "utf8").toLowerCase();
    expect(lower).toContain("worker");
    expect(lower).toMatch(/controller|planner|reviewer/);
  });

  it("pins each role's trigger points to the two tools, not just the role name", () => {
    const text = readFileSync(DOC, "utf8");
    // Split the "Trigger points by role" section into its per-role subsections so
    // each role's get_context / list_constraints bindings are pinned structurally,
    // not merely by the role word appearing somewhere in the prose.
    const triggerSection = text.split("## Trigger points by role")[1] ?? "";
    expect(triggerSection).not.toBe("");

    const worker = triggerSection.split("### Worker")[1]?.split("###")[0] ?? "";
    const controller =
      triggerSection.split("### Controller / Planner / Reviewer")[1]?.split("###")[0] ?? "";
    const anyClient = triggerSection.split("### Any MCP client")[1]?.split("###")[0] ?? "";

    // Worker: get_context at lane/task start, list_constraints before the risky
    // write, and a completion check that stays inside the surfaced constraints.
    expect(worker).toContain("get_context(task)");
    expect(worker).toContain("list_constraints()");
    expect(worker.toLowerCase()).toMatch(/lane \/ task start|task start/);
    expect(worker.toLowerCase()).toMatch(/before reporting completion/);

    // Controller: anchors with the task-scoped get_context("plan ...") form and
    // re-reads list_constraints both before planning and when reviewing a result.
    expect(controller).toContain('get_context("plan');
    expect(controller.split("list_constraints()").length - 1).toBeGreaterThanOrEqual(2);
    expect(controller.toLowerCase()).toMatch(/reviewing a worker result/);
    expect(controller.toLowerCase()).toMatch(/approving continuation/);

    // Any MCP client: identical surface — same two triggers, no richer/narrower.
    expect(anyClient.toLowerCase()).toMatch(/same two triggers/);
    expect(anyClient.toLowerCase()).toMatch(/richer or narrower|portable/);
  });

  it("encodes the read-on-the-right-axis / no-wrong-axis rule", () => {
    const lower = readFileSync(DOC, "utf8").toLowerCase();
    expect(lower).toMatch(/wrong-axis|right.axis/);
    // The constitution is a task-scoped policy, not a memory store.
    expect(lower).toMatch(/not a memory store|durable memory|memory store/);
  });

  it("adds no new tool and no hosted dependency", () => {
    const lower = readFileSync(DOC, "utf8").toLowerCase();
    expect(lower).toMatch(/no new tool|no network|no account|two read-only tools/);
    expect(lower).toMatch(/fail-closed|off by default|opt-in/);
  });
});
