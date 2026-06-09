import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = readFileSync(resolve(REPO_ROOT, "docs/concepts.md"), "utf8");

// M52 — the product concepts glossary must define the core vocabulary and stay
// consistent with the real surfaces (exactly two MCP tools, nine source files).
const REQUIRED_TERMS = [
  "Context pack",
  "Scope",
  "Constraint",
  "Competency Question",
  "Source file",
  "Block",
  "Tag",
  "Scoring",
  "Risk forcing",
  "Adapter",
  "Memory adapter",
  "Writeback proposal",
  "Feature flag",
  "MCP tool",
  "Thin connector",
  "Fail-closed",
];

describe("product concepts glossary (M52)", () => {
  it("defines every core product term", () => {
    for (const term of REQUIRED_TERMS) {
      // Each term is introduced as a bolded list entry: **Term**
      expect(DOC, `concepts.md does not define "${term}"`).toContain(`**${term}`);
    }
  });

  it("names exactly the two read-only MCP tools", () => {
    expect(DOC).toContain("get_context");
    expect(DOC).toContain("list_constraints");
  });

  it("distinguishes itself from the user .agentctx glossary", () => {
    expect(DOC.toLowerCase()).toContain("not the terms");
    expect(DOC).toContain(".agentctx/glossary.md");
  });

  it("every doc it links to exists on disk", () => {
    const linkTargets = [...DOC.matchAll(/\]\(([^)#]+\.md)(?:#[^)]*)?\)/g)].map((m) => m[1]);
    expect(linkTargets.length).toBeGreaterThanOrEqual(5);
    for (const target of linkTargets) {
      expect(existsSync(resolve(REPO_ROOT, "docs", target)), `concepts.md links missing ${target}`).toBe(true);
    }
  });
});
