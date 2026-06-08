import { describe, expect, it } from "vitest";
import { dirname, resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { handleListConstraints, resolveDefaultCwd } from "../../scripts/agentctx/mcp-server.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SERVER_REL = "scripts/agentctx/mcp-server.mjs";

describe("agentctx MCP setup templates", () => {
  describe("Claude Code template (docs/agentctx-setup/claude-code.mcp.json)", () => {
    const path = resolve(REPO_ROOT, "docs/agentctx-setup/claude-code.mcp.json");

    it("exists and is valid JSON", () => {
      expect(existsSync(path)).toBe(true);
      expect(() => JSON.parse(readFileSync(path, "utf8"))).not.toThrow();
    });

    it("registers an agentctx stdio server launching the real server script", () => {
      const cfg = JSON.parse(readFileSync(path, "utf8"));
      const server = cfg.mcpServers?.agentctx;
      expect(server).toBeTruthy();
      expect(server.command).toBe("node");
      expect(server.args).toEqual([SERVER_REL]);
    });

    it("references a server script that exists in the repo", () => {
      const cfg = JSON.parse(readFileSync(path, "utf8"));
      const scriptArg = cfg.mcpServers.agentctx.args.at(-1);
      expect(existsSync(resolve(REPO_ROOT, scriptArg))).toBe(true);
    });
  });

  describe("Codex template (docs/agentctx-setup/codex-config.toml)", () => {
    const path = resolve(REPO_ROOT, "docs/agentctx-setup/codex-config.toml");

    it("exists", () => {
      expect(existsSync(path)).toBe(true);
    });

    it("declares the agentctx mcp_servers block with the real server script", () => {
      const toml = readFileSync(path, "utf8");
      expect(toml).toContain("[mcp_servers.agentctx]");
      expect(toml).toContain('command = "node"');
      expect(toml).toContain(`args = ["${SERVER_REL}"]`);
    });
  });

  describe("resolveDefaultCwd (AGENTCTX_HOME pin)", () => {
    it("returns process.cwd() when AGENTCTX_HOME is unset", () => {
      expect(resolveDefaultCwd({})).toBe(process.cwd());
    });

    it("returns process.cwd() when AGENTCTX_HOME is blank", () => {
      expect(resolveDefaultCwd({ AGENTCTX_HOME: "   " })).toBe(process.cwd());
    });

    it("returns the trimmed AGENTCTX_HOME when set", () => {
      expect(resolveDefaultCwd({ AGENTCTX_HOME: `  ${REPO_ROOT}  ` })).toBe(REPO_ROOT);
    });
  });

  describe("server resolves .agentctx/ from the pinned home regardless of cwd", () => {
    it("reads real constraints when defaultCwd points at the repo root", () => {
      // Simulates AGENTCTX_HOME pinning: handlers take the resolved default cwd.
      const result = handleListConstraints({ format: "json" }, resolveDefaultCwd({ AGENTCTX_HOME: REPO_ROOT }));
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.file).toBe("constraints.md");
      expect(parsed.blocks.length).toBeGreaterThanOrEqual(1);
    });
  });
});
