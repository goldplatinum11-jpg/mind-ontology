import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOCS = resolve(REPO_ROOT, "docs");
const DOC = resolve(DOCS, "mind-ontology-autopilot-quality-bar-v1.md");
const PKG = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));
const text = () => readFileSync(DOC, "utf8");

describe("autopilot pack quality bar v1 (A80)", () => {
  it("ships the quality-bar doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });
  it("pins the top-of-doc Autopilot Integration Pack header back-link", () => {
    // The pack header back-link lives in the doc header, above the first
    // horizontal rule. Pin it structurally (scoped to the header, with the exact
    // link target) so the A-series pack frame can't silently drop off the top of
    // this doc without its owning public-surface test failing.
    const header = text().split("\n---")[0];
    expect(header).toContain(
      "Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).",
    );
  });
  it("states the bar: principles, guards, real claims, links, no leakage, reads cleanly", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/honors the six/);
    expect(lower).toMatch(/passes the ten structural guards/);
    expect(lower).toMatch(/resolves all its links/);
    expect(lower).toMatch(/leaks nothing/);
    expect(lower).toMatch(/reads cleanly/);
  });
  it("names what is NOT the bar", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/what is not the bar/);
    expect(lower).toMatch(/green-by-vacuity|length\./);
  });
  it("cites only npm scripts that exist", () => {
    for (const s of new Set([...text().matchAll(/npm run ([a-z:]+)/g)].map((m) => m[1]))) {
      expect(PKG.scripts, `cited missing script: ${s}`).toHaveProperty(s);
    }
  });
  it("links the principles and consistency docs, and all links resolve", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-principles-v1.md");
    expect(t).toContain("mind-ontology-autopilot-consistency-v1.md");
    for (const d of new Set([...t.matchAll(/\(([a-z0-9-]+\.md)\)/g)].map((m) => m[1]))) {
      expect(existsSync(resolve(DOCS, d)), `quality-bar links missing doc: ${d}`).toBe(true);
    }
  });
});
