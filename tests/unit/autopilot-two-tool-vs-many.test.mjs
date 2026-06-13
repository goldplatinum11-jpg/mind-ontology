import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-two-tool-vs-many-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot two-tool vs many-tool v1 (A38)", () => {
  it("ships the anti-pattern doc", () => {
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

  it("names tool sprawl as the anti-pattern and its costs", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/tool sprawl/);
    expect(lower).toMatch(/widens the trust surface/);
    expect(lower).toMatch(/wrong-axis/);
  });

  it("argues the two read-only tools as one trust surface", () => {
    const t = text();
    expect(t).toContain("get_context(task)");
    expect(t).toContain("list_constraints()");
    const lower = t.toLowerCase();
    expect(lower).toMatch(/one trust surface/);
    expect(lower).toMatch(/read-only/);
  });

  it("routes memory/search/writeback to the optional fail-closed hosted layer", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/durable memory,\s+search,\s+and writeback/);
    expect(lower).toMatch(/optional,\s+fail-closed/);
  });

  it("links the two-tool contract and trust model", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-two-tool-contract-v1.md");
    expect(t).toContain("mind-ontology-trust-security-model-v0.md");
  });
});
