import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SETUP_DIR = resolve(REPO_ROOT, "docs/agentctx-setup");
const setup = (name) => resolve(SETUP_DIR, name);
const SERVER_ENTRY = "scripts/agentctx/mcp-server.mjs";
const THIN_TOOLS = ["get_context", "list_constraints"];

// M12-M15 — the connector/client surface must stay thin, local, and consistent:
// one MCP endpoint, exactly two read-only tools, no sprawl, no wrong-repo paths,
// no embedded credentials. One audit guarding Claude Code, Codex, Cursor, ChatGPT,
// Claude.ai, and the OpenAPI shape together.

describe("connector + client surface stays thin and local (M12-M15)", () => {
  it("Claude Code, Cursor, and Codex all launch the same single MCP endpoint", () => {
    const claude = JSON.parse(readFileSync(setup("claude-code.mcp.json"), "utf8"));
    const cursor = JSON.parse(readFileSync(setup("cursor.mcp.json"), "utf8"));
    for (const cfg of [claude, cursor]) {
      expect(Object.keys(cfg.mcpServers)).toEqual(["agentctx"]); // one server, no sprawl
      expect(cfg.mcpServers.agentctx.command).toBe("node");
      expect(cfg.mcpServers.agentctx.args).toContain(SERVER_ENTRY);
    }
    const toml = readFileSync(setup("codex-config.toml"), "utf8");
    expect(toml).toContain("[mcp_servers.agentctx]");
    expect(toml).toContain(SERVER_ENTRY);
  });

  it("the OpenAPI connector exposes exactly the two read-only tools (no 147-tool sprawl)", () => {
    const api = JSON.parse(readFileSync(setup("mind-ontology-connector.openapi.json"), "utf8"));
    const opIds = Object.values(api.paths).flatMap((p) => Object.values(p)).map((op) => op.operationId).sort();
    expect(opIds).toEqual([...THIN_TOOLS].sort());
    // Read-only shape: every operation is a POST query; no PUT/PATCH/DELETE write verbs.
    for (const pathItem of Object.values(api.paths)) {
      for (const method of Object.keys(pathItem)) {
        expect(["post"]).toContain(method);
      }
    }
    // Self-hosted placeholder only; the OSS project hosts nothing.
    expect(api.servers[0].url).toContain("YOUR-CONNECTOR-HOST.example");
    expect(JSON.stringify(api)).not.toMatch(/https:\/\/[a-z0-9-]+\.workers\.dev/i);
  });

  it("no setup file references a forbidden product repo as a required path", () => {
    for (const name of readdirSync(SETUP_DIR)) {
      const raw = readFileSync(setup(name), "utf8");
      expect(raw, `${name} references sirt-app-v2`).not.toMatch(/sirt-app-v2/);
      expect(raw, `${name} references a private clone path`).not.toMatch(/sirt-codex-clones|sirt-product-workspaces/);
    }
  });

  it("no setup file embeds a credential value", () => {
    for (const name of readdirSync(SETUP_DIR)) {
      const raw = readFileSync(setup(name), "utf8");
      expect(raw, `${name} has a bearer value`).not.toMatch(/\bbearer\s+[A-Za-z0-9._-]{12,}/i);
      expect(raw, `${name} has an inline key/token value`).not.toMatch(/("?(authorization|api[_-]?key|token|secret)"?\s*[:=]\s*")[^"]{8,}/i);
    }
  });
});
