import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseMarkdownBlocks } from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CQ_PATH = resolve(REPO_ROOT, "templates/mind-ontology/.agentctx/cq.md");

const REQUIRED_CQ_TAGS = ["context", "safety"];

function loadCqBlocks() {
  return parseMarkdownBlocks(readFileSync(CQ_PATH, "utf8"), "cq.md");
}

function cqBlocks() {
  return loadCqBlocks().filter((block) => block.tags.includes("cq"));
}

describe("cq.md schema v0 conformance", () => {
  it("contains at least one #cq block", () => {
    expect(cqBlocks().length).toBeGreaterThanOrEqual(1);
  });

  it("every CQ heading is phrased as a question with a topic tag and non-empty body", () => {
    for (const block of cqBlocks()) {
      expect(
        block.title.trim().endsWith("?"),
        `CQ "${block.title}" is not phrased as a question`,
      ).toBe(true);
      const topicTags = block.tags.filter((tag) => tag !== "cq");
      expect(
        topicTags.length,
        `CQ "${block.title}" has no topic tag besides #cq`,
      ).toBeGreaterThan(0);
      expect(
        block.body.trim().length,
        `CQ "${block.title}" has an empty body`,
      ).toBeGreaterThan(0);
    }
  });

  it("covers the required context and safety competency questions", () => {
    const tags = new Set(cqBlocks().flatMap((block) => block.tags));
    for (const required of REQUIRED_CQ_TAGS) {
      expect(tags.has(required), `missing required CQ topic #${required}`).toBe(true);
    }
  });
});
