import { describe, expect, it } from "vitest";

import { createConnector } from "../../connector/worker/lib/index.mjs";

// One consolidated snapshot of the hosted connector's PUBLIC CONTRACT (D93): the
// four routes and their methods, the two tools, the JSON-only GPT-Action surface,
// and the input-tolerance guarantees. A single place a reviewer can read what the
// connector promises. Every assertion was verified against the live handlers.

const SNAPSHOT = {
  schema: "agentctx-snapshot/v1",
  sources: {
    "constraints.md": "## Keep the ontology portable #core\nReadable by any agent.\n",
    "decisions.md": "## Adopt OAuth 2.0 with PKCE #auth\nLogin uses OAuth 2.0 with PKCE.\n",
  },
};
const connector = createConnector(SNAPSHOT, {});

const post = (path, body) => connector.fetch(new Request(`https://c.test${path}`, { method: "POST", body: JSON.stringify(body) }));
const get = (path) => connector.fetch(new Request(`https://c.test${path}`, { method: "GET" }));

describe("hosted connector — public surface contract (D93)", () => {
  it("the four routes behave as documented", async () => {
    expect((await get("/health")).status).toBe(200);

    const gc = await post("/get_context", { task: "Fix the OAuth login bug" });
    expect(gc.status).toBe(200);
    const gcBody = await gc.json();
    expect(gcBody).toHaveProperty("task");
    expect(gcBody).toHaveProperty("selected");

    const lc = await post("/list_constraints", {});
    expect(lc.status).toBe(200);
    expect((await lc.json()).file).toBe("constraints.md");

    const mcp = await post("/mcp", { jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    expect(mcp.status).toBe(200);
    expect((await mcp.json()).result.serverInfo.name).toBe("agentctx");

    expect((await get("/does-not-exist")).status).toBe(404);
  });

  it("exposes exactly the two read-only tools", async () => {
    const res = await post("/mcp", { jsonrpc: "2.0", id: 1, method: "tools/list" });
    const names = (await res.json()).result.tools.map((t) => t.name);
    expect(names).toEqual(["get_context", "list_constraints"]);
  });

  it("the GPT-Action /get_context is JSON-only (a markdown hint is ignored)", async () => {
    const body = await (await post("/get_context", { task: "x", format: "markdown" })).json();
    expect(typeof body).toBe("object");
    expect(body).not.toHaveProperty("content"); // not an MCP envelope, not a markdown string
    expect(body.task).toBe("x");
  });

  it("tolerates a snapshot with extra unknown source keys (only SOURCE_FILES are compiled)", async () => {
    const conn = createConnector(
      { schema: "agentctx-snapshot/v1", sources: { "constraints.md": "## R #t\nb\n", "extra-unknown.md": "## Bogus #x\nignored\n" } },
      {},
    );
    const body = await (await conn.fetch(new Request("https://c.test/get_context", { method: "POST", body: JSON.stringify({ task: "x" }) }))).json();
    expect([...new Set(body.selected.map((s) => s.file))]).toEqual(["constraints.md"]);
  });

  it("normalizes scope: empty string and empty array are the same as no scope", async () => {
    const strip = (p) => {
      const { generatedAt, ...rest } = p;
      return rest;
    };
    const none = strip(await (await post("/get_context", { task: "Fix OAuth" })).json());
    const emptyStr = strip(await (await post("/get_context", { task: "Fix OAuth", scope: "" })).json());
    const emptyArr = strip(await (await post("/get_context", { task: "Fix OAuth", scope: [] })).json());
    expect(emptyStr).toEqual(none);
    expect(emptyArr).toEqual(none);
  });
});
