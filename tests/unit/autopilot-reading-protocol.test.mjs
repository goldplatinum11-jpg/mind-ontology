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

  it("pins the top-of-doc Autopilot Integration Pack header back-link", () => {
    const text = readFileSync(DOC, "utf8");
    // The pack header back-link lives in the doc header, above the first
    // horizontal rule. Pin it structurally (scoped to the header, with the exact
    // link target) so the A-series pack frame can't silently drop off the top of
    // this doc without its owning public-surface test failing.
    const header = text.split("\n---")[0];
    expect(header).toContain(
      "Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).",
    );
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

  it("couples controller continuation approval to a valid terminal stop condition", () => {
    const text = readFileSync(DOC, "utf8");
    const triggerSection = text.split("## Trigger points by role")[1] ?? "";
    const controller =
      triggerSection.split("### Controller / Planner / Reviewer")[1]?.split("###")[0] ?? "";
    expect(controller).not.toBe("");

    // The continuation coupling is the load-bearing claim: "approving
    // continuation" must not be a bare "keep going". Step 3 re-checks the stop
    // policy and continues only when no *valid* terminal stop condition is met,
    // deferring the definition to the stop-policy doc instead of restating it.
    // Whitespace is collapsed so the assertion survives prose re-wrapping.
    const flat = controller.toLowerCase().replace(/\s+/g, " ");
    expect(flat).toContain("re-check the stop policy");
    expect(flat).toMatch(/continue only if no \*?valid\*? terminal stop condition is met/);
    expect(flat).toContain("see the stop-policy doc");
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
