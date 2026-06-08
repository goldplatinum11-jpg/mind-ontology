import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseMarkdownBlocks } from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ROLES_PATH = resolve(
  REPO_ROOT,
  "templates/mind-ontology/.agentctx/agent-roles.md",
);

const REQUIRED_ROLE_TAGS = ["coding", "review"];

function loadRoleBlocks() {
  return parseMarkdownBlocks(readFileSync(ROLES_PATH, "utf8"), "agent-roles.md");
}

function roleBlocks() {
  return loadRoleBlocks().filter((block) => block.tags.includes("agent"));
}

describe("agent-roles.md schema v0 conformance", () => {
  it("has at least one #agent role block", () => {
    expect(roleBlocks().length).toBeGreaterThanOrEqual(1);
  });

  it("every role block carries #agent plus exactly one role tag and a non-empty body", () => {
    for (const block of roleBlocks()) {
      const roleTags = block.tags.filter((tag) => tag !== "agent");
      expect(
        roleTags.length,
        `role "${block.title}" must have exactly one role tag, got: ${block.tags.join(",")}`,
      ).toBe(1);
      expect(
        block.body.trim().length,
        `role "${block.title}" has an empty body`,
      ).toBeGreaterThan(0);
    }
  });

  it("defines the required coding and review roles", () => {
    const tags = new Set(roleBlocks().flatMap((block) => block.tags));
    for (const required of REQUIRED_ROLE_TAGS) {
      expect(tags.has(required), `missing required role #${required}`).toBe(true);
    }
  });
});
