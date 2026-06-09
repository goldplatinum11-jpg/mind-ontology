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
