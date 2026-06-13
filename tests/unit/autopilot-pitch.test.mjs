import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-pitch-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot one-paragraph pitch v1 (A71)", () => {
  it("ships the pitch doc", () => {
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

  it("contains a blockquote pitch naming the two tools and local-first", () => {
    const t = text();
    expect(t).toMatch(/^>\s/m);
    expect(t).toContain("get_context(task)");
    expect(t).toContain("list_constraints()");
    expect(t.toLowerCase()).toMatch(/local-first/);
  });

  it("covers the four beats: what, who, why, boundary", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/\*\*what:/);
    expect(lower).toMatch(/\*\*who:/);
    expect(lower).toMatch(/\*\*why:/);
    expect(lower).toMatch(/\*\*boundary:/);
  });

  it("keeps the opt-in hosted boundary", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/optional,\s+fail-closed|opt-in/);
  });

  it("links the frame and principles", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-pack-v1.md");
    expect(t).toContain("mind-ontology-autopilot-principles-v1.md");
  });
});
