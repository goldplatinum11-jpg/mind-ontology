import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { createConnector } from "../../connector/worker/lib/index.mjs";
import { TOOLS } from "../../connector/worker/lib/mcp.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readJson = (rel) => JSON.parse(readFileSync(resolve(REPO_ROOT, rel), "utf8"));

const FIXTURE = readJson("tests/fixtures/mcp-streamable-http-session.json");
const TOOL_NAMES = ["get_context", "list_constraints"];
const REAL_URL = /https:\/\/[a-z0-9.-]+\.(workers\.dev|com|net|org|io)\//i;

function mcpRequest(connector, message) {
  return connector.fetch(
    new Request("https://connector.test/mcp", { method: "POST", body: JSON.stringify(message) }),
  );
}

describe("hosted connector — Streamable-HTTP MCP session fixture (PR4)", () => {
  const connector = createConnector(FIXTURE.snapshot, {});

  it("replays the canonical client session and every step matches the fixture", async () => {
    for (const step of FIXTURE.session) {
      const res = await mcpRequest(connector, step.request);
      const e = step.expect;

      expect(res.status, `${step.name}: status`).toBe(e.status);

      const text = await res.text();
      if (e.bodyEmpty) {
        expect(text.trim(), `${step.name}: body empty`).toBe("");
        continue;
      }
      const body = JSON.parse(text);

      if ("json.result.protocolVersion" in e) {
        expect(body.result.protocolVersion).toBe(e["json.result.protocolVersion"]);
      }
      if ("json.result.serverInfo.name" in e) {
        expect(body.result.serverInfo.name).toBe(e["json.result.serverInfo.name"]);
      }
      if (e.toolNames) {
        expect(body.result.tools.map((t) => t.name)).toEqual(e.toolNames);
      }
      if ("contentJson.task" in e) {
        const pack = JSON.parse(body.result.content[0].text);
        expect(pack.task).toBe(e["contentJson.task"]);
      }
      if (e.contentIncludes) {
        expect(body.result.content[0].text).toContain(e.contentIncludes);
      }
    }
  });

  it("verifies markdown and json tool-output shapes for both tools (D25)", async () => {
    const callTool = async (name, args) => {
      const res = await mcpRequest(connector, {
        jsonrpc: "2.0",
        id: 9,
        method: "tools/call",
        params: { name, arguments: args },
      });
      return (await res.json()).result.content[0];
    };

    const gcMd = await callTool("get_context", { task: "Fix the OAuth login bug" });
    expect(gcMd.type).toBe("text");
    expect(gcMd.text).toContain("agentctx context pack");

    const gcJson = await callTool("get_context", { task: "Fix the OAuth login bug", format: "json" });
    const pack = JSON.parse(gcJson.text);
    expect(pack).toHaveProperty("task");
    expect(pack).toHaveProperty("selected");
    expect(pack).toHaveProperty("sourceFiles");

    const lcMd = await callTool("list_constraints", {});
    expect(lcMd.text).toContain("# Constraints");

    const lcJson = await callTool("list_constraints", { format: "json" });
    const parsed = JSON.parse(lcJson.text);
    expect(parsed.file).toBe("constraints.md");
    expect(parsed).toHaveProperty("blockCount");
    expect(Array.isArray(parsed.blocks)).toBe(true);
  });

  it("auth-negative and auth-positive remote MCP fixtures (fake token only) (D24)", async () => {
    const FAKE = "fake-token-for-fixtures-only";
    const guarded = createConnector(FIXTURE.snapshot, { CONNECTOR_BEARER_TOKEN: FAKE });
    const init = { jsonrpc: "2.0", id: 1, method: "initialize" };

    // negative — no bearer
    expect((await mcpRequest(guarded, init)).status).toBe(401);

    // negative — wrong bearer
    const wrong = await guarded.fetch(
      new Request("https://connector.test/mcp", {
        method: "POST",
        body: JSON.stringify(init),
        headers: { authorization: "Bearer not-the-token" },
      }),
    );
    expect(wrong.status).toBe(401);

    // positive — correct bearer
    const ok = await guarded.fetch(
      new Request("https://connector.test/mcp", {
        method: "POST",
        body: JSON.stringify(init),
        headers: { authorization: `Bearer ${FAKE}` },
      }),
    );
    expect(ok.status).toBe(200);
  });
});

describe("hosted connector — example connector manifests consistency (PR4)", () => {
  it("the Claude.ai connector example matches the implemented MCP surface (D22)", () => {
    const claude = readJson("docs/agentctx-setup/claude-ai-connector.example.json");
    expect(claude.transport).toBe("streamable-http");
    expect(claude.url.endsWith("/mcp")).toBe(true);
    expect(claude.tools).toEqual(TOOL_NAMES);
    expect(claude.tools).toEqual(TOOLS.map((t) => t.name));
    // Placeholder host, no committed credential.
    expect(claude.url).not.toMatch(REAL_URL);
    expect(claude.auth.type).toBe("none");
  });

  it("the ChatGPT/Responses MCP example matches the implemented MCP surface (D23)", () => {
    const chatgpt = readJson("docs/agentctx-setup/chatgpt-connector.example.json");
    expect(chatgpt.type).toBe("mcp");
    expect(chatgpt.server_url.endsWith("/mcp")).toBe(true);
    expect(chatgpt.allowed_tools).toEqual(TOOL_NAMES);
    expect(chatgpt.allowed_tools).toEqual(TOOLS.map((t) => t.name));
    expect(chatgpt.server_url).not.toMatch(REAL_URL);
    expect(chatgpt.require_approval).toBeTruthy();
  });

  it("the session fixture leaks no real endpoint or credential", () => {
    const raw = readFileSync(resolve(REPO_ROOT, "tests/fixtures/mcp-streamable-http-session.json"), "utf8");
    expect(raw).not.toMatch(REAL_URL);
    expect(raw).not.toMatch(/bearer\s+[A-Za-z0-9._-]{12,}/i);
  });
});
