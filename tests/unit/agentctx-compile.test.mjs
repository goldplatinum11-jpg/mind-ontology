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

// projects-scoring-anchor-v1 — anchors the docs/mind-ontology-projects-schema-v0.md
// claim that optional project blocks "are scored and selected per task like other
// non-constraint sources" and that "there is no upper limit on optional project
// blocks." projects.md is a scored source (not in ALWAYS_INCLUDE_FILES), so it
// flows through the same per-task scoring + maxBlocksPerFile mechanism as every
// other non-constraint file. These tests author a projects.md carrying one
// required #active block and several optional #secondary blocks and prove the
// compiler (1) selects different optional blocks for different tasks by score and
// (2) imposes no project-specific cap: with the per-file limit raised every block
// is selectable, and with it at 1 the rest are scored-but-omitted, not dropped.
describe("compile scores and selects project blocks per task with no project-specific cap", () => {
  const FIXED_NOW = new Date("2026-06-13T00:00:00.000Z");
  const ACTIVE_BLOCK = `## Active project #project #active
Name: Core platform
Status: active
The active effort the agent should default to.`;
  // Optional (#secondary) blocks, each with a distinct domain keyword so a task
  // naming that keyword scores its block above the others.
  const OPTIONAL_BLOCKS = [
    `## Payments revamp #project #secondary
Name: Payments
Status: paused
Adjacent payments and billing work to not confuse with the active effort.`,
    `## Search indexing #project #secondary
Name: Search
Status: exploratory
Adjacent retrieval and indexing work.`,
    `## Mobile client #project #secondary
Name: Mobile
Status: exploratory
Adjacent mobile application work.`,
    `## Analytics warehouse #project #secondary
Name: Analytics
Status: paused
Adjacent reporting and warehouse work.`,
    `## Onboarding journey #project #secondary
Name: Onboarding
Status: exploratory
Adjacent signup and onboarding work.`,
  ];
  const projectSources = {
    "constraints.md": `# Constraints

## Do not edit env files #secrets

Never modify .env files or print secret values.
`,
    "projects.md": `# Projects

${[ACTIVE_BLOCK, ...OPTIONAL_BLOCKS].join("\n\n")}
`,
  };
  const TOTAL_PROJECT_BLOCKS = OPTIONAL_BLOCKS.length + 1;

  const projectsIn = (pack, key) =>
    pack[key].filter((block) => block.file === "projects.md");

  it("selects a different optional project block per task by score", () => {
    const payments = compileContext({
      sources: projectSources,
      task: "improve payments billing",
      maxBlocksPerFile: 1,
      now: FIXED_NOW,
    });
    const search = compileContext({
      sources: projectSources,
      task: "improve search indexing",
      maxBlocksPerFile: 1,
      now: FIXED_NOW,
    });

    expect(projectsIn(payments, "selected").map((b) => b.title)).toEqual(["Payments revamp"]);
    expect(projectsIn(search, "selected").map((b) => b.title)).toEqual(["Search indexing"]);
  });

  it("imposes no project-specific upper limit: every block is selectable as scored", () => {
    // scope "project" matches the #project tag every block carries, so all
    // TOTAL_PROJECT_BLOCKS score above minScore; raising the per-file cap lets
    // every one through — more than the template ships and more than any single
    // scored source, with no projects.md special-casing.
    const pack = compileContext({
      sources: projectSources,
      task: "review the whole project portfolio",
      scopes: ["project"],
      maxBlocksPerFile: TOTAL_PROJECT_BLOCKS,
      now: FIXED_NOW,
    });
    const selected = projectsIn(pack, "selected");

    expect(selected).toHaveLength(TOTAL_PROJECT_BLOCKS);
    for (const block of selected) {
      // scored inclusion, not the always-included constraints path.
      expect(block.reason).toBe("matched");
      expect(Number.isFinite(block.score)).toBe(true);
      expect(block.score).toBeGreaterThanOrEqual(2);
    }
  });

  it("bounds project blocks only by the generic maxBlocksPerFile, omitting the rest as scored", () => {
    const pack = compileContext({
      sources: projectSources,
      task: "review the whole project portfolio",
      scopes: ["project"],
      maxBlocksPerFile: 1,
      now: FIXED_NOW,
    });
    const selected = projectsIn(pack, "selected");
    const omitted = projectsIn(pack, "omitted");

    expect(selected).toHaveLength(1);
    // The remaining project blocks were scored and considered, then capped by the
    // same per-file limit any non-constraint source obeys — not dropped by a cap
    // unique to projects.md.
    expect(omitted).toHaveLength(TOTAL_PROJECT_BLOCKS - 1);
    for (const block of omitted) {
      expect(block.score).toBeGreaterThanOrEqual(2);
    }
  });
});

