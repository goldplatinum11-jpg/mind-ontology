import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-glossary-tie-in-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot glossary tie-in v1 (A35)", () => {
  it("ships the glossary tie-in doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("defines the core autopilot terms", () => {
    const lower = text().toLowerCase();
    for (const term of ["runway", "lane", "adl", "result pack", "worker", "controller", "right-axis", "wrong-axis", "stop policy", "risk forcing", "two-tool"]) {
      expect(lower, `glossary omits: ${term}`).toContain(term);
    }
  });

  it("links every term to a doc that exists on disk", () => {
    const t = text();
    const linked = [...t.matchAll(/\(([a-z0-9-]+\.md)\)/g)].map((m) => m[1]);
    expect(linked.length).toBeGreaterThanOrEqual(8);
    for (const doc of new Set(linked)) {
      expect(existsSync(resolve(REPO_ROOT, "docs", doc)), `dangling glossary link: ${doc}`).toBe(true);
    }
  });

  it("distinguishes pack vocabulary from the user's .agentctx glossary", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/\.agentctx\/glossary\.md/);
    expect(lower).toMatch(/never mix|pack vocabulary explains the pack/);
  });
});
