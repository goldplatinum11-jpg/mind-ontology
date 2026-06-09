import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-consistency-v1.md");
const text = () => readFileSync(DOC, "utf8");

describe("autopilot cross-pack consistency v1 (A77)", () => {
  it("ships the consistency doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });
  it("explains how the guards compose into a closed loop", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/self-correcting whole/);
    expect(lower).toMatch(/closed loop/);
    expect(lower).toMatch(/every omission trips a different guard/);
  });
  it("walks the add-a-doc failure chain across guards", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/completeness fails/);
    expect(lower).toMatch(/manifest-freshness fails/);
    expect(lower).toMatch(/pack-acceptance fails/);
  });
  it("frames maturity as the closure of the checks, one green suite", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/closure of the consistency checks/);
    expect(lower).toMatch(/one green suite|the whole consistency contract/);
  });
  it("links the maturity audit and guard glossary", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-maturity-audit-v1.md");
    expect(t).toContain("mind-ontology-autopilot-guard-glossary-v1.md");
  });
});
