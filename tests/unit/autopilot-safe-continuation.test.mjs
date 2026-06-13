import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-safe-continuation-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot safe continuation v1 (A33)", () => {
  it("ships the safe-continuation doc", () => {
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

  it("states the boundary-or-budget principle", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/safe continuation, not safe stopping/);
    expect(lower).toMatch(/boundary or a budget/);
  });

  it("explains why continuation is the safe choice without crossing boundaries", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/stopping early wastes a runway/);
    expect(lower).toMatch(/inside.*the write\s+scope|never crosses a forbidden boundary/);
  });

  it("keeps the stop conditions defined and narrow", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/valid.*terminal condition|time budget/);
    expect(lower).toMatch(/invalid.*stop|green tests/);
  });

  it("ties the stop policy, checkpoint cadence, and scope discipline", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-stop-policy-v1.md");
    expect(t).toContain("mind-ontology-autopilot-checkpoint-cadence-v1.md");
    expect(t.toLowerCase()).toMatch(/scope discipline/);
  });
});
