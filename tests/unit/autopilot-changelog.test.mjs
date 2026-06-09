import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-changelog-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot pack changelog v1 (A57)", () => {
  it("ships the changelog doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("is framed append-only and frozen at the v1 contract", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/append-only/);
    expect(lower).toMatch(/v1 contract/);
    expect(lower).toMatch(/a future v2 starts\s+a new changelog|frozen/);
  });

  it("summarises what landed across the pack themes", () => {
    const lower = text().toLowerCase();
    for (const theme of ["frame", "adoption", "handoff", "reference", "fixtures"]) {
      expect(lower, `changelog omits theme: ${theme}`).toContain(theme);
    }
  });

  it("records what did NOT change in v1 (the contract)", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/what did not change|did not change in v1/);
    expect(lower).toMatch(/two read-only tools/);
  });

  it("links the versioning and manifest docs", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-versioning-v1.md");
    expect(t).toContain("mind-ontology-autopilot-manifest-v1.md");
  });
});
