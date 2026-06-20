import { describe, expect, it } from "vitest";

import { createConnector } from "../../connector/worker/lib/index.mjs";
import { loadSnapshot, SNAPSHOT_SCHEMA } from "../../connector/worker/lib/source-snapshot.mjs";

// Connector robustness pins (Phase 16 / D92): forward-compat on the snapshot
// schema, and tolerance of extra / junk request fields a real client may send.
// Every behavior here was verified against the live handlers before pinning.

const SNAPSHOT = {
  schema: "agentctx-snapshot/v1",
  sources: { "constraints.md": "## Keep it portable #core\nReadable by any agent.\n" },
};
const connector = createConnector(SNAPSHOT, {});

async function post(path, body) {
  return connector.fetch(new Request(`https://c.test${path}`, { method: "POST", body: JSON.stringify(body) }));
}

describe("hosted connector — robustness pins (Phase 16)", () => {
  it("loadSnapshot rejects a future / unknown snapshot schema (forward-compat guard)", () => {
    expect(SNAPSHOT_SCHEMA).toBe("agentctx-snapshot/v1");
    expect(() => loadSnapshot({ schema: "agentctx-snapshot/v2", sources: { "constraints.md": "x" } })).toThrow(/schema must be/);
  });

  it("MCP tools/call ignores unknown extra arguments (does not 400/throw)", async () => {
    const res = await post("/mcp", {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "get_context", arguments: { task: "x", format: "json", bogusExtra: 123, nested: { a: 1 } } },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result).toBeTruthy();
    expect(JSON.parse(body.result.content[0].text).task).toBe("x");
  });

  it("HTTP /list_constraints ignores junk body arguments", async () => {
    const res = await post("/list_constraints", { junk: true, format: "evil" });
    expect(res.status).toBe(200);
    expect((await res.json()).file).toBe("constraints.md");
  });

  it("non-POST methods are handled per route: OPTIONS /mcp -> 405, OPTIONS /get_context -> 404", async () => {
    const optMcp = await connector.fetch(new Request("https://c.test/mcp", { method: "OPTIONS" }));
    expect(optMcp.status).toBe(405);
    const optGc = await connector.fetch(new Request("https://c.test/get_context", { method: "OPTIONS" }));
    expect(optGc.status).toBe(404);
    // GET /health remains the one GET route.
    const health = await connector.fetch(new Request("https://c.test/health", { method: "GET" }));
    expect(health.status).toBe(200);
  });
});
