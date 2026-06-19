import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOCS = resolve(REPO_ROOT, "docs");
const DOC = resolve(DOCS, "mind-ontology-autopilot-state-of-pack-v1.md");
const PKG = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));
const text = () => readFileSync(DOC, "utf8");

describe("autopilot state of the pack v1 (A82)", () => {
  it("ships the state-of-the-pack doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });
  it("pins the top-of-doc Autopilot Integration Pack header back-link", () => {
    const header = text().split(/\r?\n/).slice(0, 10).join("\n");
    expect(header).toContain(
      "Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).",
    );
  });
  it("summarises what v1 ships: docs, fixtures, kit, guards", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/\*\*docs\.\*\*/);
    expect(lower).toMatch(/\*\*fixtures\.\*\*/);
    expect(lower).toMatch(/\*\*kit\.\*\*/);
    expect(lower).toMatch(/\*\*guards\.\*\*/);
    expect(lower).toMatch(/five worked/);
  });
  it("states the frozen v1 boundary: two read-only tools, local-first, opt-in hosted", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/two read-only tools/);
    expect(lower).toMatch(/local-first/);
    expect(lower).toMatch(/opt-in hosted|optional,\s+fail-closed/);
  });
  it("ties the state to one green suite and cites real scripts", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/one green command|one green suite/);
    for (const s of new Set([...text().matchAll(/npm run ([a-z:]+)/g)].map((m) => m[1]))) {
      expect(PKG.scripts, `cited missing script: ${s}`).toHaveProperty(s);
    }
  });
  it("links versioning and the manifest, and all links resolve", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-versioning-v1.md");
    expect(t).toContain("mind-ontology-autopilot-manifest-v1.md");
    for (const d of new Set([...t.matchAll(/\(([a-z0-9-]+\.md)\)/g)].map((m) => m[1]))) {
      expect(existsSync(resolve(DOCS, d)), `state-of-pack links missing doc: ${d}`).toBe(true);
    }
  });
});
