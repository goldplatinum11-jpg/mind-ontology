import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { createConnector } from "../../connector/worker/lib/index.mjs";
import { TOOLS, SERVER_INFO } from "../../connector/worker/lib/mcp.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const SNAPSHOT = {
  schema: "agentctx-snapshot/v1",
  sources: {
    "constraints.md":
      "## Never log secrets #security #logging\nDo not write tokens or keys to logs.\n\n" +
      "## Rate limit public endpoints #api\nEvery public endpoint enforces a per-key rate limit.\n",
    "decisions.md": "## Use OAuth 2.0 with PKCE #auth\nThe login flow adopts OAuth 2.0 with PKCE.\n",
  },
};

const connector = createConnector(SNAPSHOT, {});

function mcpReq(message) {
  return new Request("https://connector.test/mcp", { method: "POST", body: JSON.stringify(message) });
}
async function rpc(message) {
  const res = await connector.fetch(mcpReq(message));
  return { status: res.status, json: await res.json() };
}

describe("hosted connector remote MCP (/mcp, PR2)", () => {
  it("initialize returns protocolVersion, capabilities, and serverInfo", async () => {
    const { status, json } = await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    expect(status).toBe(200);
    expect(json.jsonrpc).toBe("2.0");
    expect(json.id).toBe(1);
    expect(json.result.protocolVersion).toBeTruthy();
    expect(json.result.capabilities.tools).toBeTruthy();
    expect(json.result.serverInfo).toEqual(SERVER_INFO);
  });

  it("tools/list returns exactly the two tools with their schemas", async () => {
    const { json } = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    expect(json.result.tools.map((t) => t.name)).toEqual(["get_context", "list_constraints"]);
    const gc = json.result.tools.find((t) => t.name === "get_context");
    expect(gc.inputSchema.required).toEqual(["task"]);
    expect(gc.inputSchema.properties.format.enum).toEqual(["markdown", "json"]);
  });

  it("tools/call get_context returns markdown content by default", async () => {
    const { json } = await rpc({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "get_context", arguments: { task: "Fix the OAuth login bug", scope: "auth" } },
    });
    expect(json.result.content[0].type).toBe("text");
    expect(json.result.content[0].text).toContain("agentctx context pack");
  });

  it("tools/call get_context honors format: json (MCP tool output)", async () => {
    const { json } = await rpc({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "get_context", arguments: { task: "Fix the OAuth login bug", format: "json" } },
    });
    const pack = JSON.parse(json.result.content[0].text);
    expect(pack.task).toBe("Fix the OAuth login bug");
    expect(Array.isArray(pack.selected)).toBe(true);
  });

  it("tools/call list_constraints returns content (markdown and json)", async () => {
    const md = await rpc({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "list_constraints" } });
    expect(md.json.result.content[0].text).toContain("# Constraints");

    const js = await rpc({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "list_constraints", arguments: { format: "json" } },
    });
    const parsed = JSON.parse(js.json.result.content[0].text);
    expect(parsed.file).toBe("constraints.md");
    expect(parsed.blockCount).toBe(2);
  });

  it("notifications/initialized is a 202 with no body", async () => {
    const res = await connector.fetch(mcpReq({ jsonrpc: "2.0", method: "notifications/initialized" }));
    expect(res.status).toBe(202);
    expect((await res.text()).trim()).toBe("");
  });

  it("unknown tool is a JSON-RPC -32601 error", async () => {
    const { json } = await rpc({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "nope" } });
    expect(json.error.code).toBe(-32601);
  });

  it("unknown method is a JSON-RPC -32601 error", async () => {
    const { json } = await rpc({ jsonrpc: "2.0", id: 8, method: "frobnicate" });
    expect(json.error.code).toBe(-32601);
  });

  it("get_context without a task is a JSON-RPC -32602 error", async () => {
    const { json } = await rpc({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "get_context", arguments: {} } });
    expect(json.error.code).toBe(-32602);
  });

  it("malformed JSON is a -32700 parse error", async () => {
    const res = await connector.fetch(new Request("https://connector.test/mcp", { method: "POST", body: "{not json" }));
    expect(res.status).toBe(200);
    expect((await res.json()).error.code).toBe(-32700);
  });

  it("non-POST /mcp is 405", async () => {
    const res = await connector.fetch(new Request("https://connector.test/mcp", { method: "GET" }));
    expect(res.status).toBe(405);
  });

  it("bearer auth gates /mcp when CONNECTOR_BEARER_TOKEN is set (fake token)", async () => {
    const FAKE = "fake-token-for-mcp-tests-only";
    const guarded = createConnector(SNAPSHOT, { CONNECTOR_BEARER_TOKEN: FAKE });
    const init = { jsonrpc: "2.0", id: 1, method: "initialize" };

    const noAuth = await guarded.fetch(mcpReq(init));
    expect(noAuth.status).toBe(401);

    const ok = await guarded.fetch(
      new Request("https://connector.test/mcp", {
        method: "POST",
        body: JSON.stringify(init),
        headers: { authorization: `Bearer ${FAKE}` },
      }),
    );
    expect(ok.status).toBe(200);
  });

  it("PR1's GPT-Action /get_context stays JSON-only and intact", async () => {
    const res = await connector.fetch(
      new Request("https://connector.test/get_context", { method: "POST", body: JSON.stringify({ task: "x" }) }),
    );
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.task).toBe("x"); // a ContextPack, not an MCP { content } envelope
    expect(j.content).toBeUndefined();
  });

  it("the connector's tools match the example connector manifests' /mcp surface", () => {
    const claude = JSON.parse(
      readFileSync(resolve(REPO_ROOT, "docs/agentctx-setup/claude-ai-connector.example.json"), "utf8"),
    );
    const chatgpt = JSON.parse(
      readFileSync(resolve(REPO_ROOT, "docs/agentctx-setup/chatgpt-connector.example.json"), "utf8"),
    );
    const toolNames = TOOLS.map((t) => t.name);
    expect(claude.url.endsWith("/mcp")).toBe(true);
    expect(claude.tools).toEqual(toolNames);
    expect(chatgpt.server_url.endsWith("/mcp")).toBe(true);
    expect(chatgpt.allowed_tools).toEqual(toolNames);
  });

  it("the MCP module ships no secret or real endpoint", () => {
    const raw = readFileSync(resolve(REPO_ROOT, "connector/worker/lib/mcp.mjs"), "utf8");
    expect(raw).not.toMatch(/bearer\s+[A-Za-z0-9._-]{12,}/i);
    expect(raw).not.toMatch(/https:\/\/[a-z0-9.-]+\.(workers\.dev|com)\//i);
  });
});
