/**
 * harvest-sirt.mjs — SIRT node adapter for the ontology harvester.
 *
 * Fetches nodes from the SIRT API (MCP streamable-HTTP transport) and converts
 * them into HarvestCandidate objects for the classifier pipeline.
 *
 * SIRT endpoint: https://connector.sirtai.org/mcp
 * Auth:          Authorization: Bearer <SIRT_API_KEY>
 *
 * The client is exported as a factory so callers (and tests) can inject a
 * custom fetch implementation without touching the module's fetch global.
 *
 * Usage:
 *   import { createSirtClient, parseSirtNodes } from "./harvest-sirt.mjs";
 *   const client = createSirtClient(process.env.SIRT_API_KEY);
 *   const nodes  = await client.listNodes({ limit: 50 });
 *   const parsed = parseSirtNodes(nodes);
 */

import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_BASE_URL = "https://connector.sirtai.org/mcp";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stableId(str) {
  return createHash("sha256").update(str).digest("hex").slice(0, 16);
}

/**
 * Split text into sentence-level candidates (≥ 30 chars each).
 * Mirrors the same helper used in harvest-chatgpt.mjs and harvest-claude-session.mjs.
 */
function splitIntoCandidates(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length >= 30);
}

/**
 * Unwrap the JSON payload from an MCP streamable-HTTP tool-call response body.
 *
 * MCP wraps tool results as:
 *   { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: "<json>" }] } }
 *
 * Returns the parsed inner payload.
 *
 * @param {object} body  Parsed response JSON
 */
function unwrapMcpToolResult(body) {
  if (body?.error) {
    const msg = body.error?.message ?? JSON.stringify(body.error);
    throw new Error(`harvest-sirt: SIRT returned error: ${msg}`);
  }
  const content = body?.result?.content;
  if (Array.isArray(content) && content[0]?.type === "text") {
    try {
      return JSON.parse(content[0].text);
    } catch {
      throw new Error("harvest-sirt: could not parse SIRT tool result text as JSON");
    }
  }
  // Some MCP servers return the result directly (not wrapped in content[])
  if (body?.result && !content) {
    return body.result;
  }
  throw new Error("harvest-sirt: unexpected MCP response shape");
}

// ---------------------------------------------------------------------------
// SIRT client factory
// ---------------------------------------------------------------------------

/**
 * Create a SIRT API client.
 *
 * @param {string} apiKey    Bearer token (SIRT_API_KEY)
 * @param {string} [baseUrl] MCP endpoint (default: connector.sirtai.org/mcp)
 * @param {Function} [fetchFn] fetch implementation (injectable for tests)
 * @returns {{ listNodes: Function }}
 */
export function createSirtClient(apiKey, baseUrl = DEFAULT_BASE_URL, fetchFn = globalThis.fetch) {
  if (!apiKey) {
    throw new Error(
      "harvest-sirt: SIRT_API_KEY is required. " +
      "Set the SIRT_API_KEY environment variable and retry.",
    );
  }
  if (!fetchFn) {
    throw new Error("harvest-sirt: fetch is not available in this Node.js version");
  }

  /**
   * Send a tools/call request to the SIRT MCP endpoint.
   * @param {string} toolName
   * @param {object} args
   */
  async function callTool(toolName, args) {
    let response;
    try {
      response = await fetchFn(baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "MCP-Protocol-Version": "2025-03-26",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: stableId(`${toolName}-${Date.now()}`),
          method: "tools/call",
          params: { name: toolName, arguments: args },
        }),
      });
    } catch (err) {
      throw new Error(`harvest-sirt: network error — ${err.message}`);
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `harvest-sirt: authentication failed (HTTP ${response.status}). ` +
        "Check that SIRT_API_KEY is valid.",
      );
    }
    if (!response.ok) {
      throw new Error(
        `harvest-sirt: SIRT API returned HTTP ${response.status}`,
      );
    }

    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error("harvest-sirt: SIRT API response was not valid JSON");
    }

    return unwrapMcpToolResult(body);
  }

  /**
   * List SIRT nodes.
   *
   * @param {object} [opts]
   * @param {number} [opts.limit=50]          Max nodes to return
   * @param {string} [opts.query]             Optional semantic filter
   * @param {string} [opts.order="t_created"] Sort order
   * @param {boolean} [opts.includeBodies=true] Include full body text
   * @returns {Promise<object[]>}  Array of SIRT node objects
   */
  async function listNodes({
    limit = 50,
    query,
    order = "t_created",
    includeBodies = true,
  } = {}) {
    const args = { limit, order, include_bodies: includeBodies };
    if (query) args.query = query;

    const result = await callTool("sirt_nodes_list", args);

    // sirt_nodes_list returns { nodes: [...] } or directly []
    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.nodes)) return result.nodes;
    return [];
  }

  return { listNodes };
}

// ---------------------------------------------------------------------------
// Node → candidate conversion
// ---------------------------------------------------------------------------

/**
 * Convert a single SIRT node object into a { source, candidates } pair.
 *
 * Body and summary are concatenated and split into sentence-level candidates
 * so the downstream classifier can act on individual statements.
 *
 * @param {object} node       SIRT node (must have node_id or id)
 * @param {string} importedAt ISO-8601 timestamp for the source record
 * @returns {{ source: import('./harvest-model.mjs').HarvestSource,
 *             candidates: import('./harvest-model.mjs').HarvestCandidate[] }}
 */
export function parseSirtNode(node, importedAt = new Date().toISOString()) {
  const nodeId = node?.node_id ?? node?.id ?? stableId(JSON.stringify(node));
  const sourceId = `sirt:${nodeId}`;
  const nodeType = node?.node_type ?? "node";
  const summarySnip = (node?.summary ?? "").slice(0, 60);

  /** @type {import('./harvest-model.mjs').HarvestSource} */
  const source = {
    id: sourceId,
    type: "sirt-node",
    label: `SIRT ${nodeType} ${nodeId.slice(0, 12)}${summarySnip ? ` — ${summarySnip}` : ""}`,
    importedAt,
  };

  // Build text corpus from summary + body (deduplicated)
  const chunks = [];
  if (node?.summary) chunks.push(node.summary.trim());
  const body = node?.body ?? "";
  if (body && body !== node?.summary) chunks.push(body.trim());
  const fullText = chunks.join("\n\n");

  if (!fullText) return { source, candidates: [] };

  const snippets = splitIntoCandidates(fullText);
  const candidates = snippets.map((text, i) => ({
    sourceId,
    text,
    context: fullText.slice(0, 200),
    speakerRole: "assistant",
    turnIndex: i,
  }));

  return { source, candidates };
}

/**
 * Convert an array of SIRT nodes into an array of { source, candidates } pairs.
 *
 * @param {object[]} nodes
 * @param {string}   [importedAt]
 * @returns {{ source: import('./harvest-model.mjs').HarvestSource,
 *             candidates: import('./harvest-model.mjs').HarvestCandidate[] }[]}
 */
export function parseSirtNodes(nodes, importedAt = new Date().toISOString()) {
  if (!Array.isArray(nodes)) return [];
  return nodes.map(n => parseSirtNode(n, importedAt));
}
