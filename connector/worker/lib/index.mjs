// Mind Ontology hosted connector — Worker entry (PR1).
//
// Scope of PR1: a GPT-Action-shaped HTTP JSON surface over a bundled .agentctx
// snapshot. It exposes the two read-only operations and a health probe:
//   GET  /health            -> { ok, service, version }
//   POST /get_context       -> ContextPack JSON   (body { task, scope? })
//   POST /list_constraints  -> { file, blockCount, blocks }
//   *                       -> 404 { error: "not_found" }
//
// NOT in PR1 (deferred to PR2 / later, by design):
//   - remote MCP `/mcp` JSON-RPC  (returns 501 here so it is explicit, not 404)
//   - any deploy, real endpoint URL, KV/R2/GitHub source loading, multi-workspace
//   - any committed secret. Bearer auth is enforced ONLY when the operator sets
//     the CONNECTOR_BEARER_TOKEN env var (a Worker secret); no token is stored here.

import { httpGetContext, httpListConstraints } from "./http-handlers.mjs";
// The workspace snapshot is bundled with the Worker. The committed file is an
// EXAMPLE; an operator regenerates it for their workspace before deploy
// (scripts/build-agentctx-snapshot.mjs) and points this import at the result.
import exampleSnapshot from "../agentctx.snapshot.example.json" with { type: "json" };

const VERSION = "0.1.0";

function json(status, body) {
  return new Response(JSON.stringify(body, null, 2) + "\n", {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function readJsonBody(request) {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return null; // signal malformed JSON
  }
}

// Build a stateless connector over a given snapshot. `env` may carry
// CONNECTOR_BEARER_TOKEN; when present, data endpoints require a matching
// `Authorization: Bearer <token>`. Health and unknown routes never require auth.
export function createConnector(snapshot, env = {}) {
  const requiredToken =
    typeof env.CONNECTOR_BEARER_TOKEN === "string" && env.CONNECTOR_BEARER_TOKEN.trim()
      ? env.CONNECTOR_BEARER_TOKEN
      : null;

  function authorized(request) {
    if (!requiredToken) return true;
    const header = request.headers.get("authorization") || "";
    return header === `Bearer ${requiredToken}`;
  }

  return {
    async fetch(request) {
      const { pathname } = new URL(request.url);
      const { method } = request;

      if (method === "GET" && pathname === "/health") {
        return json(200, { ok: true, service: "agentctx-connector", version: VERSION });
      }

      // Remote MCP transport is PR2 — explicit, not a silent 404.
      if (pathname === "/mcp") {
        return json(501, { error: "not_implemented", detail: "remote MCP /mcp is deferred to PR2" });
      }

      const dataRoute =
        method === "POST" && (pathname === "/get_context" || pathname === "/list_constraints");

      if (dataRoute && !authorized(request)) {
        return json(401, { error: "unauthorized" });
      }

      if (method === "POST" && pathname === "/get_context") {
        const body = await readJsonBody(request);
        if (body === null) return json(400, { error: "request body is not valid JSON" });
        const { status, json: payload } = httpGetContext(snapshot, body);
        return json(status, payload);
      }

      if (method === "POST" && pathname === "/list_constraints") {
        const body = await readJsonBody(request);
        if (body === null) return json(400, { error: "request body is not valid JSON" });
        const { status, json: payload } = httpListConstraints(snapshot);
        return json(status, payload);
      }

      return json(404, { error: "not_found" });
    },
  };
}

// Cloudflare Worker default export. Serves the bundled example snapshot; a real
// deploy swaps the import above for the operator's generated snapshot.
export default {
  fetch(request, env) {
    return createConnector(exampleSnapshot, env ?? {}).fetch(request);
  },
};
