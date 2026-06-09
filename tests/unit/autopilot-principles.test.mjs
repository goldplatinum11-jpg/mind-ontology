import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-principles-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot pack principles v1 (A69)", () => {
  it("ships the principles doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("enumerates the six principles as a numbered list", () => {
    const items = (text().match(/^\d+\.\s+\*\*/gm) || []).length;
    expect(items).toBeGreaterThanOrEqual(6);
  });

  it("names each core principle", () => {
    const lower = text().toLowerCase();
    for (const p of [
      "local-first",
      "two read-only tools",
      "right-axis read",
      "safe continuation",
      "mechanical enforcement",
      "opt-in hosted",
    ]) {
      expect(lower, `principles omit: ${p}`).toContain(p);
    }
  });

  it("frames principles as deciding what belongs, not just describing", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/docs describe; principles decide/);
    expect(lower).toMatch(/honors all six/);
  });

  it("links the two-tool contract and the maturity audit", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-two-tool-contract-v1.md");
    expect(t).toContain("mind-ontology-autopilot-maturity-audit-v1.md");
  });
});
