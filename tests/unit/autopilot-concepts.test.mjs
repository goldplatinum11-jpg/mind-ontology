import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-concepts-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot concepts tie-in v1 (A17)", () => {
  it("ships the autopilot concepts doc", () => {
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

  it("defines the line/runway and role vocabulary", () => {
    const lower = text().toLowerCase();
    for (const term of ["runway", "lane", "adl", "result pack", "worker", "controller", "right-axis read", "wrong-axis read", "stop policy"]) {
      expect(lower, `missing term: ${term}`).toContain(term);
    }
  });

  it("maps autopilot terms onto the product concepts (links concepts.md)", () => {
    const t = text();
    expect(t).toContain("concepts.md");
    expect(t.toLowerCase()).toContain("concept map");
  });

  it("keeps each term tied to the two-tool surface, no new tool", () => {
    const t = text();
    expect(t).toContain("get_context(task)");
    expect(t).toContain("list_constraints()");
    const lower = t.toLowerCase();
    expect(lower).toMatch(/no new tool|no network call|no hosted dependency/);
  });

  it("routes the history/recall axis to the optional fail-closed hosted adapter", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/memory adapter/);
    expect(lower).toMatch(/optional|fail-closed/);
  });

  it("every docs/*.md it links exists on disk", () => {
    const linked = [...text().matchAll(/\(([a-z0-9-]+\.md)\)/g)].map((m) => m[1]);
    expect(linked.length).toBeGreaterThan(0);
    for (const doc of new Set(linked)) {
      expect(existsSync(resolve(REPO_ROOT, "docs", doc)), `missing linked doc: ${doc}`).toBe(true);
    }
  });
});
