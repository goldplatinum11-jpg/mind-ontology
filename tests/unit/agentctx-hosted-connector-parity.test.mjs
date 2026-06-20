import { describe, expect, it } from "vitest";

import { createConnector } from "../../connector/worker/lib/index.mjs";

// Two-surface parity (ADL): the GPT-Action HTTP surface and the remote MCP
// surface are two transports over the SAME snapshot adapter and the SAME two
// tools. For identical input they must return identical data — that is the whole
// "thin transport, no divergence" principle. Only `generatedAt` (a per-call
// timestamp) may differ, so we normalize it out before comparing.

const SNAPSHOT = {
  schema: "agentctx-snapshot/v1",
  sources: {
    "constraints.md":
      "## Keep the ontology portable #core\nReadable by any agent.\n\n" +
      "## Rate limit public endpoints #api\nPer-key limit on every public endpoint.\n",
    "decisions.md": "## Adopt OAuth 2.0 with PKCE #auth\nLogin uses OAuth 2.0 with PKCE.\n",
  },
};

const connector = createConnector(SNAPSHOT, {});

async function httpJson(path, body) {
  const res = await connector.fetch(
    new Request(`https://connector.test${path}`, { method: "POST", body: JSON.stringify(body) }),
  );
  return res.json();
}

async function mcpToolJson(name, args) {
  const res = await connector.fetch(
    new Request("https://connector.test/mcp", {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
    }),
  );
  const body = await res.json();
  return JSON.parse(body.result.content[0].text);
}

const stripGeneratedAt = (pack) => {
  const { generatedAt, ...rest } = pack;
  expect(typeof generatedAt).toBe("string"); // both surfaces still stamp it
  return rest;
};

describe("hosted connector — GPT-Action vs remote MCP parity (ADL)", () => {
  it("get_context returns the identical ContextPack on both surfaces (modulo generatedAt)", async () => {
    const input = { task: "Fix the OAuth login bug", scope: "auth" };

    const httpPack = await httpJson("/get_context", input);
    const mcpPack = await mcpToolJson("get_context", { ...input, format: "json" });

    expect(stripGeneratedAt(httpPack)).toEqual(stripGeneratedAt(mcpPack));
    // Sanity: it is a real pack, not an empty/degenerate object.
    expect(httpPack.task).toBe(input.task);
    expect(httpPack.selected.length).toBeGreaterThan(0);
  });

  it("get_context parity holds for a no-scope, no-match task too", async () => {
    const input = { task: "zzzz unrelated gibberish" };
    const httpPack = await httpJson("/get_context", input);
    const mcpPack = await mcpToolJson("get_context", { ...input, format: "json" });
    expect(stripGeneratedAt(httpPack)).toEqual(stripGeneratedAt(mcpPack));
  });

  it("list_constraints returns the identical result on both surfaces", async () => {
    const httpRes = await httpJson("/list_constraints", {});
    const mcpRes = await mcpToolJson("list_constraints", { format: "json" });
    // No timestamp here — a straight deep-equal.
    expect(httpRes).toEqual(mcpRes);
    expect(httpRes.file).toBe("constraints.md");
    expect(httpRes.blockCount).toBe(2);
  });
});
