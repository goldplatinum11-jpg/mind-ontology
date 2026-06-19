import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOCS = resolve(REPO_ROOT, "docs");
const DOC = resolve(DOCS, "mind-ontology-autopilot-contributor-faq-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot contributor FAQ v1 (A73)", () => {
  it("ships the contributor FAQ doc", () => {
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

  it("answers the load-bearing contributor questions", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/where do i put a new doc/);
    expect(lower).toMatch(/why did my new doc fail the suite/);
    expect(lower).toMatch(/guard test that does not flake/);
    expect(lower).toMatch(/can i add a tool/);
    expect(lower).toMatch(/what counts as a v2/);
  });

  it("repeats the no-third-tool / non-goals boundary", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/two read-only tools/);
    expect(lower).toMatch(/non-goals/);
  });

  it("every linked doc exists", () => {
    const linked = [...text().matchAll(/\(([a-z0-9-]+\.md)\)/g)].map((m) => m[1]);
    expect(linked.length).toBeGreaterThanOrEqual(4);
    for (const d of new Set(linked)) {
      expect(existsSync(resolve(DOCS, d)), `FAQ links missing doc: ${d}`).toBe(true);
    }
  });

  it("links extending-the-pack and versioning", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-extending-v1.md");
    expect(t).toContain("mind-ontology-autopilot-versioning-v1.md");
  });
});
