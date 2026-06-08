import { describe, expect, it } from "vitest";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compileContext,
  parseMarkdownBlocks,
  readAgentctx,
  SOURCE_FILES,
} from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REAL_SOURCES = readAgentctx(REPO_ROOT);

function allBlocks(sources) {
  return SOURCE_FILES.flatMap((file) =>
    parseMarkdownBlocks(sources[file] ?? "", file),
  );
}

function totalBodyBytes(sources) {
  return allBlocks(sources).reduce((sum, b) => sum + b.body.length, 0);
}

// ---------------------------------------------------------------------------
// Five task fixtures covering: CLI, positioning, SIRT relationship, schema,
// and MCP wrapper readiness.
// ---------------------------------------------------------------------------

const FIXTURES = [
  {
    name: "cli-compile",
    task: "Implement the agentctx CLI compile command with task and scope flags",
    scopes: ["cli"],
    expectedBlocks: ["decisions.md:Build CLI before MCP"],
    description: "CLI implementation task — should prioritise CLI decisions",
  },
  {
    name: "positioning",
    task: "Position agentctx against CLAUDE.md and AGENTS.md agent instruction files",
    scopes: [],
    expectedBlocks: ["decisions.md:Compete with agent instruction files"],
    description: "Competitive positioning — should surface the positioning decision",
  },
  {
    name: "sirt-relationship",
    task: "Design the SIRT memory adapter integration as an optional plugin for agentctx",
    scopes: ["sirt"],
    expectedBlocks: ["direction.md:SIRT relationship"],
    description: "SIRT adapter design — should surface the SIRT direction block",
  },
  {
    name: "schema",
    task: "Write the Markdown schema spec for .agentctx source files and H2 chunking",
    scopes: ["schema", "markdown"],
    expectedBlocks: ["decisions.md:Use Markdown source files"],
    description: "Schema specification — should surface the Markdown decision",
  },
  {
    name: "mcp-wrapper",
    task: "Build the MCP tool wrapper that exposes agentctx compile as an MCP server tool",
    scopes: ["mcp"],
    expectedBlocks: ["decisions.md:MCP wrapper after CLI validation"],
    description: "MCP wrapper task — the MCP wrapper decision must be selected",
  },
];

describe("agentctx proof — 5 fixture compiles", () => {
  // Sanity: source files load and are non-empty.
  it("reads real .agentctx source files and finds blocks", () => {
    const blocks = allBlocks(REAL_SOURCES);
    expect(blocks.length).toBeGreaterThanOrEqual(10);

    const constraintsBlocks = blocks.filter((b) => b.file === "constraints.md");
    expect(constraintsBlocks.length).toBeGreaterThanOrEqual(1);
  });

  for (const fixture of FIXTURES) {
    describe(`fixture: ${fixture.name}`, () => {
      it(`[${fixture.name}] always includes all constraints.md blocks`, () => {
        const pack = compileContext({
          sources: REAL_SOURCES,
          task: fixture.task,
          scopes: fixture.scopes,
          now: new Date("2026-06-07T00:00:00.000Z"),
        });

        const selectedConstraintsBlocks = pack.selected.filter(
          (b) => b.file === "constraints.md",
        );
        const allConstraintsBlocks = parseMarkdownBlocks(
          REAL_SOURCES["constraints.md"] ?? "",
          "constraints.md",
        );

        expect(selectedConstraintsBlocks.length).toBe(allConstraintsBlocks.length);
        expect(
          selectedConstraintsBlocks.every((b) => b.reason === "always"),
        ).toBe(true);
      });

      it(`[${fixture.name}] filters: selected block count < total block count`, () => {
        const pack = compileContext({
          sources: REAL_SOURCES,
          task: fixture.task,
          scopes: fixture.scopes,
          now: new Date("2026-06-07T00:00:00.000Z"),
        });

        const total = allBlocks(REAL_SOURCES).length;
        expect(pack.selected.length).toBeLessThan(total);
        expect(pack.omitted.length).toBeGreaterThan(0);
      });

      it(`[${fixture.name}] selected body bytes are less than half of total body bytes`, () => {
        const pack = compileContext({
          sources: REAL_SOURCES,
          task: fixture.task,
          scopes: fixture.scopes,
          now: new Date("2026-06-07T00:00:00.000Z"),
        });

        const total = totalBodyBytes(REAL_SOURCES);
        const selected = pack.selected.reduce((s, b) => s + b.body.length, 0);
        expect(selected).toBeLessThan(total * 0.5);
      });

      it(`[${fixture.name}] includes expected block: ${fixture.expectedBlocks.join(", ")}`, () => {
        const pack = compileContext({
          sources: REAL_SOURCES,
          task: fixture.task,
          scopes: fixture.scopes,
          now: new Date("2026-06-07T00:00:00.000Z"),
        });

        const selectedKeys = pack.selected.map((b) => `${b.file}:${b.title}`);
        for (const expected of fixture.expectedBlocks) {
          expect(selectedKeys).toContain(expected);
        }
      });
    });
  }

  it("compression ratio table (informational — all ratios < 0.50)", () => {
    const total = totalBodyBytes(REAL_SOURCES);
    const totalCount = allBlocks(REAL_SOURCES).length;

    const rows = FIXTURES.map((fixture) => {
      const pack = compileContext({
        sources: REAL_SOURCES,
        task: fixture.task,
        scopes: fixture.scopes,
        now: new Date("2026-06-07T00:00:00.000Z"),
      });
      const selectedBytes = pack.selected.reduce((s, b) => s + b.body.length, 0);
      const ratio = (selectedBytes / total).toFixed(2);
      return {
        fixture: fixture.name,
        blocks: `${pack.selected.length}/${totalCount}`,
        bodyBytes: `${selectedBytes}/${total}`,
        ratio,
        omitted: pack.omitted.length,
      };
    });

    for (const row of rows) {
      console.log(
        `  [${row.fixture}] blocks=${row.blocks} body=${row.bodyBytes} ratio=${row.ratio} omitted=${row.omitted}`,
      );
    }

    for (const row of rows) {
      expect(parseFloat(row.ratio)).toBeLessThan(0.5);
    }
  });
});
