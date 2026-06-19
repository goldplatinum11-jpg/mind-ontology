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
