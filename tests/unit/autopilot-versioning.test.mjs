import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOCS = resolve(REPO_ROOT, "docs");
const DOC = resolve(DOCS, "mind-ontology-autopilot-versioning-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot pack versioning v1 (A50)", () => {
  it("ships the versioning doc", () => {
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

  it("explains the -v1 suffix convention and the change-the-meaning rule", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/-v1`?\s*suffix/);
    expect(lower).toMatch(/change the meaning,\s+change the version/);
  });

  it("distinguishes a v2 contract change from a v1 edit", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/what a v2 would change/);
    expect(lower).toMatch(/what stays a v1 edit/);
    expect(lower).toMatch(/result pack required keys|new tool added/);
  });

  it("links the product versioning checklist", () => {
    expect(text()).toContain("mind-ontology-versioning-release-checklist-v0.md");
  });

  it("the convention it describes is true: every autopilot doc filename ends in -v1.md", () => {
    const autopilotDocs = readdirSync(DOCS).filter((f) => /^mind-ontology-autopilot-/.test(f));
    for (const doc of autopilotDocs) {
      expect(doc, `non -v1 autopilot doc: ${doc}`).toMatch(/-v1\.md$/);
    }
  });
});
