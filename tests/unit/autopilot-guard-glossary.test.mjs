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
