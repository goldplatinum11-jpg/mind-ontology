import { readFileSync, readdirSync, statSync } from "node:fs";
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

// ---------------------------------------------------------------------------
// Full setup-fixture contract (MIND_ONTOLOGY_MCP_SETUP_FIXTURES_V1)
//
// The product promise: every AI client setup points at the SAME local Mind
// Ontology MCP entrypoint and exposes the SAME two read-only tools. The block
// above guards the two stdio JSON fixtures and the doc blocks. This block makes
// the guard total and drift-proof: it parses/validates EVERY copied config under
// docs/agentctx-setup against one declarative manifest, so a new or edited
// fixture cannot silently diverge from the contract.
// ---------------------------------------------------------------------------

const SETUP_DIR = "docs/agentctx-setup";
const CANONICAL_ENTRY = "scripts/agentctx/mcp-server.mjs";
const TOOL_CONTRACT = ["get_context", "list_constraints"];
const PLACEHOLDER_HOST = "YOUR-CONNECTOR-HOST.example";

// Every file that may live under docs/agentctx-setup, with its kind. The on-disk
// directory must equal this set exactly — a copied config cannot land unaudited,
// and a removed one cannot silently drop coverage.
//
//   stdio-json  — local stdio client config (Claude Code, Cursor): node + entry
//   stdio-toml  — local stdio client config (Codex): [mcp_servers.agentctx]
//   hosted-json — hosted/HTTP connector example (Claude.ai, ChatGPT): placeholder
//   openapi     — OpenAPI connector shape for hosted GPT Actions / remote MCP
const FIXTURES = {
  "claude-code.mcp.json": { kind: "stdio-json" },
  "cursor.mcp.json": { kind: "stdio-json" },
  "codex-config.toml": { kind: "stdio-toml" },
  "claude-ai-connector.example.json": { kind: "hosted-json", toolsKey: "tools" },
  "chatgpt-connector.example.json": { kind: "hosted-json", toolsKey: "allowed_tools" },
  "mind-ontology-connector.openapi.json": { kind: "openapi" },
};

const STDIO_JSON = Object.entries(FIXTURES).filter(([, m]) => m.kind === "stdio-json").map(([n]) => n);
const HOSTED_JSON = Object.entries(FIXTURES).filter(([, m]) => m.kind === "hosted-json");

const readSetup = (name) => read(`${SETUP_DIR}/${name}`);
const parseSetup = (name) => JSON.parse(readSetup(name));

// Narrow, dependency-free TOML reader for the only shape this repo ships:
// table headers, plus the agentctx table's `command` and `args = [..]` lines.
function tomlTableHeaders(text) {
  return [...text.matchAll(/^\s*\[([^\]]+)\]\s*$/gm)].map((m) => m[1].trim());
}
function tomlArgs(text) {
  const m = text.match(/^\s*args\s*=\s*\[([^\]]*)\]/m);
  if (!m) return [];
  return [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]);
}

// Collect every value that appears under a tool-list key (tools / allowed_tools)
// or as an OpenAPI operationId, anywhere in a parsed fixture. Used to prove no
// tool name outside the two-tool contract leaks into any client config.
function toolTokens(node, out = []) {
  if (Array.isArray(node)) {
    for (const v of node) toolTokens(v, out);
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if ((k === "tools" || k === "allowed_tools") && Array.isArray(v)) {
        out.push(...v.filter((x) => typeof x === "string"));
      }
      if (k === "operationId" && typeof v === "string") out.push(v);
      toolTokens(v, out);
    }
  }
  return out;
}

const CRED_PATTERNS = [
  [/\bbearer\s+[A-Za-z0-9._-]{12,}/i, "inline bearer value"],
  [/("?(authorization|api[_-]?key|token|secret)"?\s*[:=]\s*")[^"]{8,}/i, "inline key/token value"],
];

describe("every setup fixture obeys the same MCP contract (FIXTURES_V1)", () => {
  it("the docs/agentctx-setup directory contains exactly the audited fixtures", () => {
    const onDisk = readdirSync(resolve(REPO_ROOT, SETUP_DIR))
      .filter((f) => statSync(resolve(REPO_ROOT, SETUP_DIR, f)).isFile())
      .sort();
    // If this fails: a config was added/removed under docs/agentctx-setup without
    // updating FIXTURES. Classify the new file (stdio-json / stdio-toml /
    // hosted-json / openapi) so it gets validated, or remove the stale entry.
    expect(onDisk).toEqual(Object.keys(FIXTURES).sort());
  });

  it("every fixture parses (JSON fixtures are well-formed, TOML headers are readable)", () => {
    for (const [name, meta] of Object.entries(FIXTURES)) {
      if (meta.kind === "stdio-toml") {
        const headers = tomlTableHeaders(readSetup(name));
        expect(headers.length, `${name} has no TOML tables`).toBeGreaterThan(0);
      } else {
        expect(() => parseSetup(name), `${name} is not valid JSON`).not.toThrow();
      }
    }
  });

  it("every local stdio client launches the one canonical server entry", () => {
    for (const name of STDIO_JSON) {
      const cfg = parseSetup(name);
      // Exactly one MCP server, named agentctx — no sprawl, no second server.
      expect(Object.keys(cfg.mcpServers), `${name} has more than one server`).toEqual(["agentctx"]);
      const server = cfg.mcpServers.agentctx;
      expect(server.command, `${name} command must be node`).toBe("node");
      // Exactly one arg references the entry, and it is the canonical path.
      const entryArgs = server.args.filter((a) => a.includes(SERVER_ENTRY));
      expect(entryArgs, `${name} must launch exactly one ${SERVER_ENTRY}`).toHaveLength(1);
      expect(entryArgs[0]).toBe(CANONICAL_ENTRY);
      // A stdio config pins the launcher, never a tool allow-list subset.
      expect(server.tools, `${name} must not pin a tool subset`).toBeUndefined();
      expect(server.allowed_tools, `${name} must not pin a tool subset`).toBeUndefined();
    }

    // Codex TOML: exactly one [mcp_servers.*] table and it is agentctx.
    const toml = readSetup("codex-config.toml");
    const serverTables = tomlTableHeaders(toml).filter((h) => /^mcp_servers\./.test(h));
    expect(serverTables, "codex config must declare exactly one mcp server").toEqual(["mcp_servers.agentctx"]);
    expect(toml).toMatch(/command\s*=\s*"node"/);
    expect(tomlArgs(toml)).toContain(CANONICAL_ENTRY);
  });

  it("all stdio clients launch the identical entry args (they cannot diverge)", () => {
    const argSets = STDIO_JSON.map((name) => parseSetup(name).mcpServers.agentctx.args);
    for (const args of argSets) expect(args).toEqual(argSets[0]);
    expect(argSets[0]).toContain(CANONICAL_ENTRY);
    // Codex resolves the same relative entry.
    expect(tomlArgs(readSetup("codex-config.toml"))).toEqual(argSets[0]);
  });

  it("hosted/HTTP connector examples are placeholder-only (no real endpoint)", () => {
    for (const [name] of HOSTED_JSON) {
      const raw = readSetup(name);
      expect(raw, `${name} must use the placeholder host`).toContain(PLACEHOLDER_HOST);
    }
    // OpenAPI server is a placeholder too.
    expect(parseSetup("mind-ontology-connector.openapi.json").servers[0].url).toContain(PLACEHOLDER_HOST);

    // Across EVERY fixture: every https URL targets the reserved .example TLD.
    // No production/SIRT/Cloudflare host can hide in any copied config.
    for (const name of Object.keys(FIXTURES)) {
      for (const m of readSetup(name).matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)) {
        const host = m[1];
        expect(host.endsWith(".example"), `${name} points at non-placeholder host ${host}`).toBe(true);
      }
      expect(readSetup(name), `${name} references a real Workers host`).not.toMatch(/[a-z0-9-]+\.workers\.dev/i);
      expect(readSetup(name), `${name} references sirtai.org`).not.toMatch(/sirtai\.org/i);
    }
  });

  it("hosted examples pin the two-tool surface and keep auth value-less", () => {
    for (const [name, meta] of HOSTED_JSON) {
      const cfg = parseSetup(name);
      expect(cfg[meta.toolsKey], `${name} ${meta.toolsKey} must be the two-tool surface`).toEqual(TOOL_CONTRACT);
    }
    // Claude.ai example declares auth but ships no value.
    const claude = parseSetup("claude-ai-connector.example.json");
    expect(claude.auth.type).toBe("none");
    // ChatGPT example keeps approval gating on by default.
    expect(parseSetup("chatgpt-connector.example.json").require_approval).toBe("always");
  });

  it("no fixture exposes a tool outside the get_context / list_constraints contract", () => {
    const seen = new Set();
    for (const [name, meta] of Object.entries(FIXTURES)) {
      if (meta.kind === "stdio-toml") continue; // no tool list in the launcher
      for (const tok of toolTokens(parseSetup(name))) {
        expect(TOOL_CONTRACT, `${name} exposes unexpected tool "${tok}"`).toContain(tok);
        seen.add(tok);
      }
    }
    // Not vacuous: both contract tools really are surfaced somewhere.
    expect([...seen].sort()).toEqual([...TOOL_CONTRACT].sort());
  });

  it("no fixture embeds a credential value", () => {
    for (const name of Object.keys(FIXTURES)) {
      const raw = readSetup(name);
      for (const [re, label] of CRED_PATTERNS) {
        expect(raw, `${name} has an ${label}`).not.toMatch(re);
      }
    }
  });

  it("no fixture hard-codes a forbidden product-repo or private clone path", () => {
    for (const name of Object.keys(FIXTURES)) {
      const raw = readSetup(name);
      expect(raw, `${name} references sirt-app-v2`).not.toMatch(/sirt-app-v2/);
      expect(raw, `${name} references a private clone path`).not.toMatch(/sirt-codex-clones|sirt-product-workspaces/);
    }
  });
});
