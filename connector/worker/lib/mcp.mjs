// Mind Ontology hosted connector — remote MCP over HTTP (PR2).
//
// Streamable-HTTP JSON-RPC for `POST /mcp`, over the SAME bundled-snapshot
// adapter PR1 uses. It mirrors the local stdio server
// (scripts/agentctx/mcp-server.mjs): same serverInfo, protocol version, the two
// tools, JSON-RPC method set, and tool-output shapes — but the sources come from
// the snapshot, not the filesystem, and dispatch returns plain objects instead
// of writing to stdout. The engine renderers are reused verbatim so tool output
// cannot diverge from the stdio server.
//
// This module never imports node:fs and never mutates the stdio server.

import {
  compileContext,
  parseMarkdownBlocks,
  renderContextPack,
  renderContextPackJson,
} from "../../../scripts/agentctx/compile.mjs";
import { loadSnapshot } from "./source-snapshot.mjs";

export const SERVER_INFO = { name: "agentctx", version: "0.1.0" };
export const PROTOCOL_VERSION = "2024-11-05";

// Mirrors the TOOLS manifest in scripts/agentctx/mcp-server.mjs — KEEP IN SYNC.
// `cwd` is accepted for schema parity with the stdio server but ignored here: a
// hosted connector serves exactly one bundled workspace.
export const TOOLS = [
  {
    name: "get_context",
    description:
      "Compile a task-scoped context pack from .agentctx/ source files. " +
      "Always includes every constraints.md block. Selects the most relevant " +
      "blocks from direction.md, decisions.md, and architecture.md by lexical " +
      "scoring against the task and optional scope tags.",
    inputSchema: {
      type: "object",
      required: ["task"],
      properties: {
        task: { type: "string", description: "Task description to compile context for." },
        scope: {
          description: 'Scope tag(s). String (comma-separated) or string array, e.g. "auth,security".',
          oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
        },
        format: {
          type: "string",
          enum: ["markdown", "json"],
          description: 'Output format. Default: "markdown".',
        },
        cwd: {
          type: "string",
          description: "Directory containing .agentctx/. Defaults to server working directory.",
        },
      },
    },
  },
  {
    name: "list_constraints",
    description:
      "Return all blocks from .agentctx/constraints.md — the non-negotiable " +
      "project invariants that are always included in every context pack.",
    inputSchema: {
      type: "object",
      properties: {
        format: {
          type: "string",
          enum: ["markdown", "json"],
          description: 'Output format. Default: "markdown".',
        },
        cwd: {
          type: "string",
          description: "Directory containing .agentctx/. Defaults to server working directory.",
        },
      },
    },
  },
];

class HostedMcpError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function normalizeScope(scope) {
  if (!scope) return [];
  if (Array.isArray(scope)) return scope.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim());
  if (typeof scope === "string") return scope.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

function assertFormat(format) {
  if (format !== "markdown" && format !== "json") {
    throw new HostedMcpError(-32602, `Parameter "format" must be "markdown" or "json", got: ${JSON.stringify(format)}`);
  }
}

// MCP tool — get_context. Unlike PR1's JSON-only HTTP Action, the MCP tool
// honors format: markdown|json (tool output, not a fixed API contract).
function toolGetContext(snapshot, args) {
  const { task, scope, format = "markdown" } = args ?? {};
  if (!task || typeof task !== "string" || !task.trim()) {
    throw new HostedMcpError(-32602, 'Parameter "task" is required and must be a non-empty string.');
  }
  assertFormat(format);
  const sources = loadSnapshot(snapshot);
  const scopes = normalizeScope(scope);
  const pack = compileContext({ sources, task: task.trim(), scopes });
  const text = format === "json" ? renderContextPackJson(pack) : renderContextPack(pack);
  return { content: [{ type: "text", text }] };
}

// MCP tool — list_constraints. Output shapes mirror the stdio server byte-for-byte.
function toolListConstraints(snapshot, args) {
  const { format = "markdown" } = args ?? {};
  assertFormat(format);
  const sources = loadSnapshot(snapshot);
  const blocks = parseMarkdownBlocks(sources["constraints.md"] ?? "", "constraints.md");

  if (format === "json") {
    const text =
      JSON.stringify(
        {
          file: "constraints.md",
          blockCount: blocks.length,
          blocks: blocks.map((b) => ({ title: b.title, tags: b.tags, body: b.body })),
        },
        null,
        2,
      ) + "\n";
    return { content: [{ type: "text", text }] };
  }

  const lines = ["# Constraints", ""];
  for (const block of blocks) {
    lines.push(`## ${block.heading || block.title}`);
    lines.push("");
    lines.push(block.body);
    lines.push("");
  }
  return { content: [{ type: "text", text: lines.join("\n") }] };
}

// Pure JSON-RPC dispatch. Returns a JSON-RPC response object, or `null` for a
// notification (the HTTP layer answers 202 with no body). Same method set,
// result shapes, and error codes as the stdio server's dispatch.
export function dispatchMcp(snapshot, request) {
  const { id, method, params } = request ?? {};

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: SERVER_INFO },
    };
  }

  if (method === "notifications/initialized") {
    return null; // notification — no response
  }

  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  }

  if (method === "tools/call") {
    const { name, arguments: toolArgs } = params ?? {};
    try {
      let result;
      if (name === "get_context") result = toolGetContext(snapshot, toolArgs);
      else if (name === "list_constraints") result = toolListConstraints(snapshot, toolArgs);
      else return { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown tool: ${name}` } };
      return { jsonrpc: "2.0", id, result };
    } catch (err) {
      const code = err instanceof HostedMcpError ? err.code : -32603;
      return { jsonrpc: "2.0", id, error: { code, message: err.message } };
    }
  }

  // Unknown method. A notification (no id) is silently ignored.
  if (id === undefined || id === null) return null;
  return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
}
