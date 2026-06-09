import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DIR = resolve(REPO_ROOT, "templates/mind-ontology/autopilot");
const JSON_CFG = resolve(DIR, "autopilot.mcp.json");
const TOML_CFG = resolve(DIR, "autopilot-codex.toml");

const CANONICAL_ENTRY = "scripts/agentctx/mcp-server.mjs";

describe("autopilot MCP config templates (A9)", () => {
  it("ships both the stdio-json and codex-toml autopilot configs", () => {
    expect(existsSync(JSON_CFG)).toBe(true);
    expect(existsSync(TOML_CFG)).toBe(true);
  });

  it("the JSON config declares exactly one server `agentctx` launching node + canonical entry", () => {
    const cfg = JSON.parse(readFileSync(JSON_CFG, "utf8"));
    const servers = Object.keys(cfg.mcpServers ?? {});
    expect(servers).toEqual(["agentctx"]);
    expect(cfg.mcpServers.agentctx.command).toBe("node");
    expect(cfg.mcpServers.agentctx.args).toContain(CANONICAL_ENTRY);
  });

  it("the Codex TOML declares exactly one [mcp_servers.agentctx] table with the same entry", () => {
    const toml = readFileSync(TOML_CFG, "utf8");
    const tables = [...toml.matchAll(/^\[mcp_servers\.([^\]]+)\]/gm)].map((m) => m[1]);
    expect(tables).toEqual(["agentctx"]);
    expect(toml).toContain('command = "node"');
    expect(toml).toContain(CANONICAL_ENTRY);
  });

  it("both clients launch the identical entry — no per-client divergence", () => {
    const jsonEntry = JSON.parse(readFileSync(JSON_CFG, "utf8")).mcpServers.agentctx.args.join(" ");
    const tomlHasEntry = readFileSync(TOML_CFG, "utf8").includes(CANONICAL_ENTRY);
    expect(jsonEntry).toContain(CANONICAL_ENTRY);
    expect(tomlHasEntry).toBe(true);
  });

  it("no tool sprawl, no hosted host, no embedded secret in either config", () => {
    for (const file of [JSON_CFG, TOML_CFG]) {
      const lower = readFileSync(file, "utf8").toLowerCase();
      // Only the two read-only tools may ever be named; no other tool tokens.
      expect(lower).not.toMatch(/sirt_|writeback|search_hybrid|node_put/);
      expect(lower).not.toMatch(/sirtai\.org|workers\.dev|https:\/\//);
      expect(lower).not.toMatch(/bearer |authorization|token"\s*:/);
    }
  });
});
