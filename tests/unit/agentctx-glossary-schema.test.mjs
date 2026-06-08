import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseMarkdownBlocks } from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const GLOSSARY_PATH = resolve(
  REPO_ROOT,
  "templates/mind-ontology/.agentctx/glossary.md",
);

function loadGlossaryBlocks() {
  return parseMarkdownBlocks(readFileSync(GLOSSARY_PATH, "utf8"), "glossary.md");
}

function termBlocks() {
  return loadGlossaryBlocks().filter((block) => block.tags.includes("term"));
}

describe("glossary.md schema v0 conformance", () => {
  it("contains at least one #term block", () => {
    expect(termBlocks().length).toBeGreaterThanOrEqual(1);
  });

  it("every term block has a non-empty definition body", () => {
    for (const block of termBlocks()) {
      expect(
        block.body.trim().length,
        `term "${block.title}" has an empty definition`,
      ).toBeGreaterThan(0);
    }
  });

  it("term titles are unique", () => {
    const titles = termBlocks().map((block) => block.title.toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("every term block carries a topic tag in addition to #term", () => {
    for (const block of termBlocks()) {
      const topicTags = block.tags.filter((tag) => tag !== "term");
      expect(
        topicTags.length,
        `term "${block.title}" has only the #term tag`,
      ).toBeGreaterThan(0);
    }
  });
});
