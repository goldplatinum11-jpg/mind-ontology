import { describe, expect, it } from "vitest";

import { createConnector } from "../../connector/worker/lib/index.mjs";
import { SUPPORTED_PROTOCOL_VERSIONS, DEFAULT_PROTOCOL_VERSION } from "../../connector/worker/lib/mcp.mjs";

// Deeper MCP JSON-RPC conformance / edge cases for the remote /mcp transport
// (Phase 8). These pin the protocol-version negotiation across every supported
// revision and the JSON-RPC error behavior on malformed / odd request shapes, so
// a real Claude.ai / ChatGPT client cannot trip an unhandled path.

const SNAPSHOT = {
  schema: "agentctx-snapshot/v1",
  sources: { "constraints.md": "## Keep it portable #core\nReadable by any agent.\n" },
};
const connector = createConnector(SNAPSHOT, {});

async function rpc(message, headers) {
  const res = await connector.fetch(
    new Request("https://connector.test/mcp", {
      method: "POST",
      body: JSON.stringify(message),
      headers: headers ?? {},
    }),
  );
  const text = await res.text();
  return { status: res.status, json: text.trim() ? JSON.parse(text) : null };
}

describe("remote MCP conformance — protocol versions (Phase 8)", () => {
  it("echoes every supported initialize protocolVersion", async () => {
    for (const v of SUPPORTED_PROTOCOL_VERSIONS) {
      const { status, json } = await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: v } });
      expect(status).toBe(200);
      expect(json.result.protocolVersion).toBe(v);
    }
  });

  it("falls back to the default for an unsupported initialize version (server-chooses, per spec)", async () => {
    const { json } = await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2099-01-01" } });
    // Spec: when the server does not support the requested version it MUST reply
    // with a version it supports (here the broadly-compatible default). The client
    // then decides whether to proceed or disconnect.
    expect(json.result.protocolVersion).toBe(DEFAULT_PROTOCOL_VERSION);
    expect(SUPPORTED_PROTOCOL_VERSIONS).toContain(json.result.protocolVersion);
  });
});

describe("remote MCP conformance — JSON-RPC edge shapes (Phase 8)", () => {
  it("a request with no method but an id is a -32601 method-not-found", async () => {
    const { status, json } = await rpc({ jsonrpc: "2.0", id: 7 });
    expect(status).toBe(200);
    expect(json.error.code).toBe(-32601);
    expect(json.id).toBe(7);
  });

  it("a notification (no id) for an unknown method gets 202 with no body", async () => {
    const res = await connector.fetch(
      new Request("https://connector.test/mcp", {
        method: "POST",
        body: JSON.stringify({ jsonrpc: "2.0", method: "some/notification" }),
      }),
    );
    expect(res.status).toBe(202);
    expect((await res.text()).trim()).toBe("");
  });

  it("tools/call with no params (missing name) is a -32601 unknown tool", async () => {
    const { json } = await rpc({ jsonrpc: "2.0", id: 8, method: "tools/call" });
    expect(json.error.code).toBe(-32601);
  });

  it("tools/call get_context with empty arguments is a -32602 (missing task)", async () => {
    const { json } = await rpc({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "get_context", arguments: {} } });
    expect(json.error.code).toBe(-32602);
  });

  it("tools/call get_context with a bad format is a -32602", async () => {
    const { json } = await rpc({
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: { name: "get_context", arguments: { task: "x", format: "xml" } },
    });
    expect(json.error.code).toBe(-32602);
  });

  it("a tools/list request with id:null still returns a result (id echoed as null)", async () => {
    const { status, json } = await rpc({ jsonrpc: "2.0", id: null, method: "tools/list" });
    expect(status).toBe(200);
    expect(json.id).toBeNull();
    expect(json.result.tools.map((t) => t.name)).toEqual(["get_context", "list_constraints"]);
  });
});
