import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TPL = resolve(REPO_ROOT, "templates/mind-ontology/autopilot/cheat-sheet.md");

const text = () => readFileSync(TPL, "utf8");

describe("autopilot cheat sheet kit template (A47)", () => {
  it("ships the cheat sheet", () => {
    expect(existsSync(TPL)).toBe(true);
  });

  it("has a triggers table naming both tools", () => {
    const t = text();
    expect(t).toContain("get_context(task)");
    expect(t).toContain("list_constraints()");
    expect(t.toLowerCase()).toMatch(/start of every task|lane step/);
    expect(t.toLowerCase()).toMatch(/destructive.*irreversible|irreversible/);
  });

  it("states the right-axis read and the one-line stop policy", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/right axis|not as a memory store/);
    expect(lower).toMatch(/valid terminal boundary/);
    expect(lower).toMatch(/not\*\* stops|are \*\*not\*\* stops|continue/);
  });

  it("uses only the two tools, no secret or hosted host", () => {
    const lower = text().toLowerCase();
    expect(lower).not.toMatch(/sirt_|writeback_execute|search_hybrid/);
    expect(lower).not.toMatch(/sirtai\.org|workers\.dev|bearer [a-z0-9]/);
    expect(lower).toMatch(/no hosted sirt|local-first/);
  });

  it("points at the protocol, stop-policy, and common-mistakes docs", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-reading-protocol-v1.md");
    expect(t).toContain("mind-ontology-autopilot-stop-policy-v1.md");
    expect(t).toContain("mind-ontology-autopilot-common-mistakes-v1.md");
  });
});
