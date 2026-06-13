import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileFromCwd } from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-empty-ontology-v1.md");
const MINIMAL = resolve(REPO_ROOT, "tests/fixtures/autopilot-minimal");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot empty-ontology behavior v1 (A63)", () => {
  it("ships the empty-ontology doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("pins the top-of-doc Autopilot Integration Pack header back-link", () => {
    // The pack header back-link lives in the doc header, above the first
    // horizontal rule. Pin it structurally (scoped to the header, with the
    // exact link target) so the A-series pack frame can't silently drop off
    // the top of this doc without its owning public-surface test failing.
    const header = text().split("\n---")[0];
    expect(header).toContain(
      "Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).",
    );
  });

  it("explains what a constraints-only line answers and cannot answer", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/what must i never do/);
    expect(lower).toMatch(/is this task risky/);
    expect(lower).toMatch(/what it cannot answer/);
    expect(lower).toMatch(/absences\*?,\s+not errors/);
  });

  it("frames empty as valid, not broken", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/empty is not broken|still valid|valid, safe state/);
  });

  it("matches reality: the minimal fixture answers the floor and risk, nothing more", () => {
    const pack = JSON.parse(compileFromCwd({ cwd: MINIMAL, task: "What direction should I take?", scopes: [], format: "json" }));
    const files = pack.selected.map((b) => b.file);
    expect(files).toContain("constraints.md");
    expect(files.every((f) => f === "constraints.md")).toBe(true);
    const risky = JSON.parse(compileFromCwd({ cwd: MINIMAL, task: "Drop the production table", scopes: [], format: "json" }));
    expect(risky.risk.level).toBe("risky");
  });

  it("links the minimal-vs-full spectrum", () => {
    expect(text()).toContain("mind-ontology-autopilot-minimal-vs-full-v1.md");
  });
});
