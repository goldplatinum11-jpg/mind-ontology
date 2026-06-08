import { describe, expect, it } from "vitest";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { handleGetContext, handleListConstraints } from "../../scripts/agentctx/mcp-server.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("agentctx MCP handlers", () => {
  // ---------------------------------------------------------------------------
  // handleGetContext
  // ---------------------------------------------------------------------------

  describe("handleGetContext", () => {
    it("returns a single text content block", () => {
      const result = handleGetContext({ task: "Fix OAuth authentication bug" }, REPO_ROOT);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
    });

    it("returns markdown context pack by default", () => {
      const result = handleGetContext({ task: "Fix OAuth authentication bug" }, REPO_ROOT);
      expect(result.content[0].text).toContain("# agentctx context pack");
      expect(result.content[0].text).toContain("Task: Fix OAuth authentication bug");
    });

    it("returns valid JSON when format=json", () => {
      const result = handleGetContext({ task: "Fix OAuth bug", format: "json" }, REPO_ROOT);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.task).toBe("Fix OAuth bug");
      expect(Array.isArray(parsed.selected)).toBe(true);
      expect(Array.isArray(parsed.scopes)).toBe(true);
    });

    it("includes constraints.md in every JSON response", () => {
      const result = handleGetContext({ task: "Any task at all", format: "json" }, REPO_ROOT);
      const parsed = JSON.parse(result.content[0].text);
      const constraintBlocks = parsed.selected.filter((b) => b.file === "constraints.md");
      expect(constraintBlocks.length).toBeGreaterThanOrEqual(1);
      expect(constraintBlocks.every((b) => b.reason === "always")).toBe(true);
    });

    it("normalizes scope as comma-separated string", () => {
      const result = handleGetContext(
        { task: "Fix auth bug", scope: "auth,security", format: "json" },
        REPO_ROOT,
      );
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.scopes).toContain("auth");
      expect(parsed.scopes).toContain("security");
    });

    it("normalizes scope as array", () => {
      const result = handleGetContext(
        { task: "Fix auth bug", scope: ["auth"], format: "json" },
        REPO_ROOT,
      );
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.scopes).toContain("auth");
    });

    it("scoped compile selects fewer total blocks than total available", () => {
      const result = handleGetContext(
        { task: "Build MCP transport layer", scope: "mcp", format: "json" },
        REPO_ROOT,
      );
      const parsed = JSON.parse(result.content[0].text);
      const total = parsed.selected.length + parsed.omittedCount;
      expect(parsed.selected.length).toBeLessThan(total);
    });

    it("throws when task is missing", () => {
      expect(() => handleGetContext({}, REPO_ROOT)).toThrow(/task.*required/i);
    });

    it("throws when task is empty string", () => {
      expect(() => handleGetContext({ task: "   " }, REPO_ROOT)).toThrow(/task.*required/i);
    });

    it("throws when task is null", () => {
      expect(() => handleGetContext({ task: null }, REPO_ROOT)).toThrow(/task.*required/i);
    });

    it("throws when format is unrecognized", () => {
      expect(() => handleGetContext({ task: "Fix bug", format: "xml" }, REPO_ROOT)).toThrow(/format/i);
    });
  });

  // ---------------------------------------------------------------------------
  // handleListConstraints
  // ---------------------------------------------------------------------------

  describe("handleListConstraints", () => {
    it("returns a single text content block", () => {
      const result = handleListConstraints({}, REPO_ROOT);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
    });

    it("returns markdown with a Constraints heading by default", () => {
      const result = handleListConstraints({}, REPO_ROOT);
      expect(result.content[0].text).toContain("# Constraints");
    });

    it("returns at least one constraint block in markdown", () => {
      const result = handleListConstraints({}, REPO_ROOT);
      expect(result.content[0].text).toMatch(/^## /m);
    });

    it("returns valid JSON when format=json", () => {
      const result = handleListConstraints({ format: "json" }, REPO_ROOT);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.file).toBe("constraints.md");
      expect(Array.isArray(parsed.blocks)).toBe(true);
      expect(parsed.blockCount).toBe(parsed.blocks.length);
    });

    it("each JSON block has title, tags, and body fields", () => {
      const result = handleListConstraints({ format: "json" }, REPO_ROOT);
      const parsed = JSON.parse(result.content[0].text);
      for (const block of parsed.blocks) {
        expect(block).toHaveProperty("title");
        expect(block).toHaveProperty("tags");
        expect(block).toHaveProperty("body");
        expect(Array.isArray(block.tags)).toBe(true);
      }
    });

    it("returns at least one block from real .agentctx/constraints.md", () => {
      const result = handleListConstraints({ format: "json" }, REPO_ROOT);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.blocks.length).toBeGreaterThanOrEqual(1);
    });

    it("throws when format is unrecognized", () => {
      expect(() => handleListConstraints({ format: "yaml" }, REPO_ROOT)).toThrow(/format/i);
    });
  });
});
