import { describe, expect, it } from "vitest";

import { createConnector } from "../../connector/worker/lib/index.mjs";

// Cross-surface parity expansion (Phase 15). The GPT-Action HTTP surface and the
// remote MCP surface are two transports over the same snapshot adapter; for the
// same input they must return the same data (modulo the per-call generatedAt),
// across more input shapes — and they must FAIL the same way too.

const SNAPSHOT = {
  schema: "agentctx-snapshot/v1",
  sources: {
    "constraints.md":
      "## Keep the ontology portable #core\nReadable by any agent.\n\n" +
      "## Rate limit public endpoints #api #security\nPer-key limit.\n",
    "decisions.md": "## Adopt OAuth 2.0 with PKCE #auth #security\nLogin uses OAuth 2.0 with PKCE.\n",
  },
};
const connector = createConnector(SNAPSHOT, {});

async function httpJson(conn, path, body) {
  const res = await conn.fetch(new Request(`https://c.test${path}`, { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() };
}
async function mcpToolJson(conn, name, args) {
  const res = await conn.fetch(
    new Request("https://c.test/mcp", {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
    }),
  );
  return await res.json();
}
const strip = (pack) => {
  const { generatedAt, ...rest } = pack;
  return rest;
};

describe("hosted connector — cross-surface parity expansion (Phase 15)", () => {
  it("scope as an array and as a comma string select the same blocks (D79)", async () => {
    const asString = (await httpJson(connector, "/get_context", { task: "Fix the OAuth login bug", scope: "auth,security" })).json;
    const asArray = (await httpJson(connector, "/get_context", { task: "Fix the OAuth login bug", scope: ["auth", "security"] })).json;
    expect(strip(asString)).toEqual(strip(asArray));
    // and HTTP == MCP for the array form
    const mcp = JSON.parse((await mcpToolJson(connector, "get_context", { task: "Fix the OAuth login bug", scope: ["auth", "security"], format: "json" })).result.content[0].text);
    expect(strip(asArray)).toEqual(strip(mcp));
  });

  it("a no-match task yields only the always-included constraints, identically on both surfaces (D80)", async () => {
    const http = (await httpJson(connector, "/get_context", { task: "zzzz unrelated gibberish" })).json;
    const mcp = JSON.parse((await mcpToolJson(connector, "get_context", { task: "zzzz unrelated gibberish", format: "json" })).result.content[0].text);
    expect(strip(http)).toEqual(strip(mcp));
    expect(http.selected.length).toBeGreaterThan(0);
    expect(http.selected.every((b) => b.file === "constraints.md")).toBe(true);
  });

  it("a constraints-only snapshot is served identically on both surfaces (D81)", async () => {
    const conn = createConnector(
      { schema: "agentctx-snapshot/v1", sources: { "constraints.md": "## Single rule #core\nThe only constraint.\n" } },
      {},
    );
    const http = (await httpJson(conn, "/get_context", { task: "anything" })).json;
    const mcp = JSON.parse((await mcpToolJson(conn, "get_context", { task: "anything", format: "json" })).result.content[0].text);
    expect(strip(http)).toEqual(strip(mcp));
    expect(http.selected.map((b) => b.title)).toContain("Single rule");

    const lcHttp = (await httpJson(conn, "/list_constraints", {})).json;
    const lcMcp = JSON.parse((await mcpToolJson(conn, "list_constraints", { format: "json" })).result.content[0].text);
    expect(lcHttp).toEqual(lcMcp);
    expect(lcHttp.blockCount).toBe(1);
  });

  it("a malformed snapshot fails cleanly on BOTH surfaces — HTTP 500, MCP -32603 (D82)", async () => {
    const broken = createConnector({ schema: "agentctx-snapshot/v1", sources: {} }, {}); // missing constraints.md

    const http = await httpJson(broken, "/get_context", { task: "x" });
    expect(http.status).toBe(500);
    expect(http.json.error).toBe("internal_error");

    const mcp = await mcpToolJson(broken, "get_context", { task: "x" });
    expect(mcp.error.code).toBe(-32603);
    // Neither surface crashes / throws — both return a structured error response.
  });

  it("the GPT-Action /get_context is JSON-only — a markdown format hint is ignored (D83)", async () => {
    const res = (await httpJson(connector, "/get_context", { task: "Fix the OAuth login bug", format: "markdown" })).json;
    // A ContextPack object, never an MCP { content } envelope and never a markdown string.
    expect(typeof res).toBe("object");
    expect(res).toHaveProperty("task");
    expect(res).toHaveProperty("selected");
    expect(res).not.toHaveProperty("content");
    expect(res.task).toBe("Fix the OAuth login bug");
  });
});
