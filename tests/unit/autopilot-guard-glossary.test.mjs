import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-guard-glossary-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot guard glossary v1 (A66)", () => {
  it("ships the guard-glossary doc", () => {
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

  it("explains each of the eight structural guards", () => {
    const lower = text().toLowerCase();
    for (const guard of [
      "pack-completeness",
      "manifest",
      "pack-acceptance",
      "kit-completeness",
      "discoverability",
      "glossary-completeness",
      "versioning",
      "safety-floor proof",
    ]) {
      expect(lower, `glossary omits guard: ${guard}`).toContain(guard);
    }
  });

  it("frames the guards as the pack's immune system", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/immune system/);
    expect(lower).toMatch(/orphaned, undocumented, unguarded, or unsafe/);
  });

  it("links the maturity audit and extending docs", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-maturity-audit-v1.md");
    expect(t).toContain("mind-ontology-autopilot-extending-v1.md");
  });
});
