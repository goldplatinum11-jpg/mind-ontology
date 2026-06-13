import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOCS = resolve(REPO_ROOT, "docs");
const DOC = resolve(DOCS, "mind-ontology-autopilot-reading-paths-v1.md");
const text = () => readFileSync(DOC, "utf8");

describe("autopilot reading paths v1 (A79)", () => {
  it("ships the reading-paths doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });
  it("offers a route for adopters, reviewers, and contributors", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/if you are adopting/);
    expect(lower).toMatch(/if you are reviewing/);
    expect(lower).toMatch(/if you are contributing/);
  });
  it("each route starts at a sensible entry doc", () => {
    const t = text();
    // adopter -> frame; reviewer -> reviewer quickstart; contributor -> principles.
    expect(t).toContain("mind-ontology-autopilot-adoption-v1.md");
    expect(t).toContain("mind-ontology-autopilot-reviewer-quickstart-v1.md");
    expect(t).toContain("mind-ontology-autopilot-extending-v1.md");
  });
  it("every linked doc exists on disk", () => {
    const linked = [...text().matchAll(/\(([a-z0-9-]+\.md)\)/g)].map((m) => m[1]);
    expect(linked.length).toBeGreaterThanOrEqual(10);
    for (const d of new Set(linked)) {
      expect(existsSync(resolve(DOCS, d)), `reading-paths links missing doc: ${d}`).toBe(true);
    }
  });
  it("offers an in-a-hurry shortcut to the pitch", () => {
    const t = text();
    expect(t.toLowerCase()).toMatch(/in a hurry/);
    expect(t).toContain("mind-ontology-autopilot-pitch-v1.md");
  });
  it("pins the top-of-doc Autopilot Integration Pack header back-link", () => {
    expect(text()).toContain(
      "Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).",
    );
  });
});
