import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseMarkdownBlocks } from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const IDENTITY_PATH = resolve(
  REPO_ROOT,
  "templates/mind-ontology/.agentctx/identity.md",
);

// Required blocks per docs/mind-ontology-identity-schema-v0.md.
// Matched by required tag, not exact title text.
const REQUIRED_BLOCKS = [
  { name: "Operator profile", requiredTag: "identity" },
  { name: "Working style", requiredTag: "style" },
];

function loadIdentityBlocks() {
  const markdown = readFileSync(IDENTITY_PATH, "utf8");
  return parseMarkdownBlocks(markdown, "identity.md");
}

describe("identity.md schema v0 conformance", () => {
  it("parses into tagged blocks", () => {
    const blocks = loadIdentityBlocks();
    expect(blocks.length).toBeGreaterThanOrEqual(REQUIRED_BLOCKS.length);
    for (const block of blocks) {
      expect(block.tags.length, `block "${block.title}" has no tags`).toBeGreaterThan(0);
    }
  });

  it("contains every required block with its required tag and a non-empty body", () => {
    const blocks = loadIdentityBlocks();
    for (const required of REQUIRED_BLOCKS) {
      const match = blocks.find((block) => block.tags.includes(required.requiredTag));
      expect(
        match,
        `missing required block tagged #${required.requiredTag} (${required.name})`,
      ).toBeTruthy();
      expect(
        match.body.trim().length,
        `required block #${required.requiredTag} has an empty body`,
      ).toBeGreaterThan(0);
    }
  });

  it("keeps the #identity namespace tag on at least one block", () => {
    const blocks = loadIdentityBlocks();
    const hasIdentityNamespace = blocks.some((block) => block.tags.includes("identity"));
    expect(hasIdentityNamespace).toBe(true);
  });

  it("does not embed secret-like assignments", () => {
    const raw = readFileSync(IDENTITY_PATH, "utf8");
    // Guard the schema's no-secrets rule: no "<secret-ish key> = <value>" lines.
    expect(raw).not.toMatch(/\b(api[_-]?key|password|secret|token|private[_-]?key)\b\s*[:=]\s*\S/i);
  });
});
