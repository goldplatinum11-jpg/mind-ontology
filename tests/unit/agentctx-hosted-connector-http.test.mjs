import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { createConnector } from "../../connector/worker/lib/index.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// A small, deterministic snapshot — does not depend on the example file's content.
const SNAPSHOT = {
  schema: "agentctx-snapshot/v1",
  sources: {
    "constraints.md":
      "## Never log secrets #security #logging\nDo not write tokens or keys to logs.\n\n" +
      "## Rate limit public endpoints #api\nEvery public endpoint enforces a per-key rate limit.\n",
    "decisions.md": "## Use OAuth 2.0 with PKCE #auth\nThe login flow adopts OAuth 2.0 with PKCE.\n",
  },
};

function req(method, path, body) {
  const init = { method };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request(`https://connector.test${path}`, init);
}

async function call(connector, method, path, body) {
  const res = await connector.fetch(req(method, path, body));
  const json = await res.json();
  return { status: res.status, json };
}

describe("hosted connector HTTP surface (PR1, GPT Action)", () => {
  const connector = createConnector(SNAPSHOT, {});

  it("GET /health returns a service descriptor", async () => {
    const { status, json } = await call(connector, "GET", "/health");
    expect(status).toBe(200);
    expect(json).toMatchObject({ ok: true, service: "agentctx-connector" });
    expect(typeof json.version).toBe("string");
  });

  it("POST /get_context returns a ContextPack JSON for a task", async () => {
    const { status, json } = await call(connector, "POST", "/get_context", {
      task: "Fix the OAuth login bug",
      scope: "auth",
    });
    expect(status).toBe(200);
    expect(json.task).toBe("Fix the OAuth login bug");
    expect(Array.isArray(json.selected)).toBe(true);
    expect(json.selected.length).toBeGreaterThan(0); // constraints are always included
    expect(Array.isArray(json.sourceFiles)).toBe(true);
    expect(json.risk).toBeTruthy();
    expect(typeof json.omittedCount).toBe("number");
  });

  it("POST /get_context without a task is a 400", async () => {
    const { status, json } = await call(connector, "POST", "/get_context", {});
    expect(status).toBe(400);
    expect(json.error).toMatch(/task/);
  });

  it("POST /list_constraints returns the constraints blocks", async () => {
    const { status, json } = await call(connector, "POST", "/list_constraints", {});
    expect(status).toBe(200);
    expect(json.file).toBe("constraints.md");
    expect(json.blockCount).toBe(2);
    expect(json.blocks.map((b) => b.title)).toContain("Never log secrets");
    for (const b of json.blocks) {
      expect(b).toHaveProperty("title");
      expect(b).toHaveProperty("tags");
      expect(b).toHaveProperty("body");
    }
  });

  it("an unknown route is a 404", async () => {
    const { status, json } = await call(connector, "GET", "/nope");
    expect(status).toBe(404);
    expect(json.error).toBe("not_found");
  });

  it("remote MCP /mcp is live (PR2) and coexists with the GPT-Action routes", async () => {
    // Full MCP behavior is covered in agentctx-hosted-connector-mcp.test.mjs;
    // here we only confirm PR2 wired /mcp into the same connector without
    // disturbing PR1's HTTP surface.
    const { status, json } = await call(connector, "POST", "/mcp", {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {},
    });
    expect(status).toBe(200);
    expect(json.result.serverInfo.name).toBe("agentctx");
  });

  it("malformed JSON body is a 400", async () => {
    const res = await connector.fetch(
      new Request("https://connector.test/get_context", { method: "POST", body: "{not json" }),
    );
    expect(res.status).toBe(400);
  });

  it("bearer auth is enforced ONLY when CONNECTOR_BEARER_TOKEN is set (fake token)", async () => {
    const FAKE = "fake-token-for-tests-only";
    const guarded = createConnector(SNAPSHOT, { CONNECTOR_BEARER_TOKEN: FAKE });

    // No / wrong bearer -> 401 on data routes.
    const noAuth = await guarded.fetch(req("POST", "/get_context", { task: "x" }));
    expect(noAuth.status).toBe(401);

    const wrong = await guarded.fetch(
      new Request("https://connector.test/get_context", {
        method: "POST",
        body: JSON.stringify({ task: "x" }),
        headers: { authorization: "Bearer wrong" },
      }),
    );
    expect(wrong.status).toBe(401);

    // Correct bearer -> served.
    const ok = await guarded.fetch(
      new Request("https://connector.test/get_context", {
        method: "POST",
        body: JSON.stringify({ task: "Fix the OAuth login bug" }),
        headers: { authorization: `Bearer ${FAKE}` },
      }),
    );
    expect(ok.status).toBe(200);

    // Health never requires auth.
    const health = await guarded.fetch(req("GET", "/health"));
    expect(health.status).toBe(200);
  });

  it("the committed connector source ships no secret or real endpoint", () => {
    const files = [
      "connector/worker/lib/index.mjs",
      "connector/worker/lib/http-handlers.mjs",
      "connector/worker/lib/source-snapshot.mjs",
      "connector/worker/wrangler.toml.example",
      "docs/agentctx-setup/mind-ontology-connector.openapi.json",
    ];
    for (const f of files) {
      const raw = readFileSync(resolve(REPO_ROOT, f), "utf8");
      expect(raw, `${f} embeds a real bearer token`).not.toMatch(/bearer\s+[A-Za-z0-9._-]{12,}/i);
      expect(raw, `${f} embeds a real endpoint host`).not.toMatch(
        /https:\/\/[a-z0-9.-]+\.(workers\.dev|com)\//i,
      );
    }
  });

  it("the OpenAPI placeholder typo (/mco) is fixed", () => {
    const raw = readFileSync(
      resolve(REPO_ROOT, "docs/agentctx-setup/mind-ontology-connector.openapi.json"),
      "utf8",
    );
    const spec = JSON.parse(raw);
    expect(spec.servers[0].url).toBe("https://YOUR-CONNECTOR-HOST.example");
    expect(spec.servers[0].url).not.toMatch(/\/mco\b/);
  });
});
