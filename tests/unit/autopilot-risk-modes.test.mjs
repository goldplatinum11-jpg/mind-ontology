import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileFromCwd } from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-risk-modes-v1.md");
const FIXTURE = resolve(REPO_ROOT, "tests/fixtures/autopilot-line");

function pack(task, riskMode) {
  return JSON.parse(compileFromCwd({ cwd: FIXTURE, task, scopes: [], format: "json", riskMode }));
}

describe("autopilot risk modes v1 (A21)", () => {
  it("ships the risk-modes tie-in doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("the doc explains forcing as selection-only with a fail-closed write boundary", () => {
    const lower = readFileSync(DOC, "utf8").toLowerCase();
    expect(lower).toMatch(/risk-forced/);
    expect(lower).toMatch(/fails closed|fail-closed/);
    expect(lower).toMatch(/forcing is not permission|never authorizes|never treat that surfacing as a green light/);
  });

  it("a risky lane step force-includes a safety block (end-to-end via the compiler)", () => {
    const p = pack("Delete the production database and drop the orders table");
    expect(p.risk.level).toBe("risky");
    expect(p.selected.some((b) => b.reason === "risk-forced")).toBe(true);
  });

  it("an ordinary lane step is not inflated — no forced blocks", () => {
    const p = pack("Refine the autopilot adoption wording");
    expect(p.risk.level).toBe("safe");
    expect(p.selected.some((b) => b.reason === "risk-forced")).toBe(false);
  });

  it("the constraints floor is present on both risky and safe tasks", () => {
    for (const task of ["Drop the orders table", "Tidy the docs"]) {
      const files = pack(task).selected.map((b) => b.file);
      expect(files).toContain("constraints.md");
    }
  });

  it("an explicit safe override is honored even on scary wording", () => {
    const p = pack("Delete the production database", "safe");
    expect(p.risk.level).toBe("safe");
    expect(p.selected.some((b) => b.reason === "risk-forced")).toBe(false);
  });
});
