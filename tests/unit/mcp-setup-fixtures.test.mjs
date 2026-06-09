import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => readFileSync(resolve(REPO_ROOT, p), "utf8");
const SERVER_ENTRY = "mcp-server.mjs";

// Docs that carry copy-paste MCP config a user is meant to paste verbatim.
const CONFIG_DOCS = [
  "docs/agentctx-mcp.md",
  "docs/agentctx-mcp-setup.md",
  "docs/mind-ontology-claude-code-setup-proof-v0.md",
  "docs/mind-ontology-cursor-setup-proof-v0.md",
];

const JSON_FENCE = /```json\s*\n([\s\S]*?)```/g;

function jsonBlocks(text) {
  const blocks = [];
  let m;
  while ((m = JSON_FENCE.exec(text)) !== null) {
    const body = m[1].trim();
    // Skip illustrative fences (JSONC comments / elided "...").
    if (body.includes("//") || body.includes("...")) continue;
    blocks.push(body);
  }
  return blocks;
}

// M43 — every copy-paste MCP config (fixtures + docs) is valid and launches the
// one real server entry. No client gets a broken or divergent config.
describe("MCP setup fixtures are valid and consistent (M43)", () => {
  it("standalone client fixtures parse and launch the single server entry", () => {
    for (const name of ["claude-code.mcp.json", "cursor.mcp.json"]) {
      const cfg = JSON.parse(read(`docs/agentctx-setup/${name}`));
      expect(cfg.mcpServers.agentctx.args.some((a) => a.includes(SERVER_ENTRY))).toBe(true);
    }
    const toml = read("docs/agentctx-setup/codex-config.toml");
    expect(toml).toContain(SERVER_ENTRY);
  });

  it("every non-illustrative json config block in the setup docs is valid JSON", () => {
    let mcpConfigBlocks = 0;
    for (const doc of CONFIG_DOCS) {
      for (const block of jsonBlocks(read(doc))) {
        let parsed;
        expect(() => { parsed = JSON.parse(block); }, `invalid JSON config in ${doc}:\n${block}`).not.toThrow();
        if (parsed?.mcpServers?.agentctx) {
          mcpConfigBlocks += 1;
          const args = parsed.mcpServers.agentctx.args ?? [];
          expect(args.some((a) => a.includes(SERVER_ENTRY)), `${doc}: agentctx server does not launch ${SERVER_ENTRY}`).toBe(true);
          expect(parsed.mcpServers.agentctx.command).toBe("node");
        }
      }
    }
    // Not vacuous: the docs really do carry multiple working configs.
    expect(mcpConfigBlocks).toBeGreaterThanOrEqual(3);
  });

  it("the doc fixture matches the standalone fixture for Claude Code", () => {
    const fixture = JSON.parse(read("docs/agentctx-setup/claude-code.mcp.json"));
    const docBlocks = jsonBlocks(read("docs/agentctx-mcp.md"))
      .map((b) => { try { return JSON.parse(b); } catch { return null; } })
      .filter((c) => c?.mcpServers?.agentctx && !c.mcpServers.agentctx.env); // the simple project-scope block
    expect(docBlocks.length).toBeGreaterThanOrEqual(1);
    expect(docBlocks[0].mcpServers.agentctx.args).toEqual(fixture.mcpServers.agentctx.args);
  });
});
