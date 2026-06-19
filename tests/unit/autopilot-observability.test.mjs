import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-observability-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot observability v1 (A60)", () => {
  it("ships the observability doc", () => {
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

  it("names the two observability surfaces: the Result Pack and the guard tests", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/the result pack\*\* answers \*what happened\*|result pack answers/);
    expect(lower).toMatch(/the guard tests\*\* answer \*is it correct\*|guard tests answer/);
  });

  it("argues files beat a dashboard: auditable, reproducible, no new dependency", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/auditable/);
    expect(lower).toMatch(/reproducible/);
    expect(lower).toMatch(/no new dependency/);
  });

  it("gives the operator a concrete three-step check", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/read the latest result pack/);
    expect(lower).toMatch(/npm test/);
    expect(lower).toMatch(/diff the working tree/);
  });

  it("links the walkthrough and non-goals", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-result-pack-walkthrough-v1.md");
    expect(t).toContain("mind-ontology-autopilot-non-goals-v1.md");
  });
});
