import { describe, expect, it } from "vitest";
import {
  compileContext,
  parseArgv,
  parseMarkdownBlocks,
  renderContextPack,
  scoreBlock,
  tokenize,
} from "../../scripts/agentctx/compile.mjs";

const sources = {
  "constraints.md": `# Constraints

## Do not edit env files #secrets

Never modify .env files or print secret values.
`,
  "direction.md": `# Direction

## Frontend cockpit #frontend #ui

Build a quiet operator cockpit.

## Context compiler #agentctx #cli

Compile task-scoped context for AI agents.
`,
  "decisions.md": `# Decisions

## Authentication adapter #auth #security

OAuth work must preserve fail-closed behavior.

## CLI before MCP #cli #mcp

Prove context compilation in a command line tool first.
`,
};

describe("agentctx compile", () => {
  it("tokenizes task text into stable searchable tokens", () => {
    expect(tokenize("Fix OAuth auth bug in the adapter")).toEqual([
      "fix",
      "oauth",
      "auth",
      "bug",
      "adapter",
    ]);
  });

  it("chunks Markdown by H2 headings and extracts tags", () => {
    const blocks = parseMarkdownBlocks(sources["decisions.md"], "decisions.md");

    expect(blocks).toHaveLength(2);
    expect(blocks[0].title).toBe("Authentication adapter");
    expect(blocks[0].tags).toEqual(["auth", "security"]);
  });

  it("scores tag and heading matches above body-only matches", () => {
    const [block] = parseMarkdownBlocks(sources["decisions.md"], "decisions.md");

    expect(scoreBlock(block, tokenize("auth bug"), [])).toBeGreaterThan(
      scoreBlock(block, tokenize("closed behavior"), []),
    );
  });

  it("always includes constraints and selects relevant decision blocks", () => {
    const pack = compileContext({
      sources,
      task: "Fix OAuth authentication bug",
      now: new Date("2026-06-07T00:00:00.000Z"),
    });

    const selected = pack.selected.map((block) => `${block.file}:${block.title}`);
    expect(selected).toContain("constraints.md:Do not edit env files");
    expect(selected).toContain("decisions.md:Authentication adapter");
    expect(selected).not.toContain("decisions.md:CLI before MCP");
  });

  it("renders a provenance-bearing Markdown context pack", () => {
    const pack = compileContext({
      sources,
      task: "Build CLI compiler",
      scopes: ["cli"],
      now: new Date("2026-06-07T00:00:00.000Z"),
    });
    const rendered = renderContextPack(pack);

    expect(rendered).toContain("# agentctx context pack");
    expect(rendered).toContain("Task: Build CLI compiler");
    expect(rendered).toContain("Source: constraints.md");
    expect(rendered).toContain("decisions.md / CLI before MCP");
  });

  it("parses CLI arguments", () => {
    expect(parseArgv(["compile", "--task", "Fix auth", "--scope", "auth,security"])).toMatchObject({
      command: "compile",
      task: "Fix auth",
      scopes: ["auth", "security"],
    });
  });
});

