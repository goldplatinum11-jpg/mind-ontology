import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-adopting-incrementally-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot adopting incrementally v1 (A65)", () => {
  it("ships the incremental-adoption doc", () => {
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

  it("lays out the adoption sequence as numbered steps in order", () => {
    const lower = text().toLowerCase();
    let last = -1;
    for (const n of [1, 2, 3, 4]) {
      const idx = lower.search(new RegExp(`### step ${n}`));
      expect(idx, `missing/out-of-order step ${n}`).toBeGreaterThan(last);
      last = idx;
    }
  });

  it("starts at constraints-only and adds direction/roles next", () => {
    const t = text();
    expect(t).toMatch(/`constraints\.md` only/);
    expect(t).toContain("direction.md");
    expect(t).toContain("agent-roles.md");
  });

  it("argues every step is valid with the floor present from step 1", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/every step is valid/);
    expect(lower).toMatch(/floor is there from step 1|always included/);
    expect(lower).toMatch(/no big-bang migration/);
  });

  it("links the spectrum and the empty-ontology behavior", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-minimal-vs-full-v1.md");
    expect(t).toContain("mind-ontology-autopilot-empty-ontology-v1.md");
  });
});
