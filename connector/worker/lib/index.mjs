// Mind Ontology hosted connector — Worker entry (PR1 + PR2).
//
// Routes over a bundled .agentctx snapshot:
//   GET  /health            -> { ok, service, version }
//   POST /get_context       -> ContextPack JSON   (GPT Action; JSON-only, body { task, scope? })
//   POST /list_constraints  -> { file, blockCount, blocks }   (GPT Action)
//   POST /mcp               -> Streamable-HTTP JSON-RPC (PR2): initialize,
//                              notifications/initialized, tools/list, tools/call
//                              (get_context, list_constraints). See lib/mcp.mjs.
//   *                       -> 404 { error: "not_found" }
//
// Still out of scope (later PRs, by design):
//   - any deploy, real endpoint URL, KV/R2/GitHub source loading, multi-workspace
//   - any committed secret. Bearer auth is enforced ONLY when the operator sets
//     the CONNECTOR_BEARER_TOKEN env var (a Worker secret); no token is stored here.

import { httpGetContext, httpListConstraints } from "./http-handlers.mjs";
import { dispatchMcp, SUPPORTED_PROTOCOL_VERSIONS } from "./mcp.mjs";
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

      // Data routes (auth-gated when CONNECTOR_BEARER_TOKEN is set): the remote
      // MCP transport and the GPT-Action endpoints.
      const isMcp = pathname === "/mcp";
      const isHttpData =
        method === "POST" && (pathname === "/get_context" || pathname === "/list_constraints");

      if ((isMcp || isHttpData) && !authorized(request)) {
        return json(401, { error: "unauthorized" });
      }

      // Remote MCP (PR2): Streamable-HTTP JSON-RPC over the same snapshot adapter.
      // One JSON-RPC message per POST — a request gets a JSON-RPC response; a
      // notification gets 202 with no body. Malformed JSON is a -32700 parse error.
      if (isMcp) {
        if (method !== "POST") {
          return json(405, { error: "method_not_allowed", detail: "POST a JSON-RPC message to /mcp" });
        }
        // Streamable-HTTP MCP-Protocol-Version header: a missing header is treated
        // as compatible (the negotiated default), but a present-but-unsupported
        // value is a 400 per the spec — don't silently serve a mismatched client.
        const protocolHeader = request.headers.get("mcp-protocol-version");
        if (protocolHeader && !SUPPORTED_PROTOCOL_VERSIONS.includes(protocolHeader)) {
          return json(400, {
            error: "unsupported_protocol_version",
            detail: `MCP-Protocol-Version "${protocolHeader}" is not supported`,
            supported: SUPPORTED_PROTOCOL_VERSIONS,
          });
        }
        const body = await readJsonBody(request);
        if (body === null) {
          return json(200, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error: invalid JSON" } });
        }
        const response = dispatchMcp(snapshot, body);
        if (response === null) return new Response(null, { status: 202 });
        return json(200, response);
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
