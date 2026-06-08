#!/usr/bin/env node

/**
 * agentctx MCP server — stdio JSON-RPC transport, no external dependencies.
 *
 * Tools:
 *   get_context(task, scope?, format?, cwd?)     — task-scoped context pack
 *   list_constraints(format?, cwd?)              — all constraints.md blocks
 *
 * Default .agentctx/ location:
 *   The server resolves its default working directory from the AGENTCTX_HOME
 *   environment variable, falling back to process.cwd(). Repo-local MCP setup
 *   templates (see docs/agentctx-mcp-setup.md) set AGENTCTX_HOME to the repo
 *   root so the same server resolves the same .agentctx/ regardless of which
 *   directory the MCP client launches it from. Individual tool calls can still
 *   override per call via the `cwd` parameter.
 */

import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compileContext,
  parseMarkdownBlocks,
  readAgentctx,
  renderContextPack,
  renderContextPackJson,
} from "./compile.mjs";

const SERVER_INFO = { name: "agentctx", version: "0.1.0" };
const PROTOCOL_VERSION = "2024-11-05";

// ---------------------------------------------------------------------------
// Tool manifest
// ---------------------------------------------------------------------------

const TOOLS = [
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
        task: {
          type: "string",
          description: "Task description to compile context for.",
        },
        scope: {
          description: 'Scope tag(s). String (comma-separated) or string array, e.g. "auth,security".',
          oneOf: [
            { type: "string" },
            { type: "array", items: { type: "string" } },
          ],
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

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

class McpError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeScope(scope) {
  if (!scope) return [];
  if (Array.isArray(scope)) return scope.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim());
  if (typeof scope === "string") return scope.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

export function resolveDefaultCwd(env = process.env) {
  const home = typeof env.AGENTCTX_HOME === "string" ? env.AGENTCTX_HOME.trim() : "";
  return home || process.cwd();
}

function assertFormat(format) {
  if (format !== "markdown" && format !== "json") {
    throw new McpError(-32602, `Parameter "format" must be "markdown" or "json", got: ${JSON.stringify(format)}`);
  }
}

// ---------------------------------------------------------------------------
// Exported handler functions (pure — no stdio, testable directly)
// ---------------------------------------------------------------------------

export function handleGetContext(args, defaultCwd = process.cwd()) {
  const { task, scope, format = "markdown", cwd = defaultCwd } = args ?? {};

  if (!task || typeof task !== "string" || !task.trim()) {
    throw new McpError(-32602, 'Parameter "task" is required and must be a non-empty string.');
  }
  assertFormat(format);

  const scopes = normalizeScope(scope);
  const sources = readAgentctx(resolve(cwd));
  const pack = compileContext({ sources, task: task.trim(), scopes });
  const text = format === "json" ? renderContextPackJson(pack) : renderContextPack(pack);
  return { content: [{ type: "text", text }] };
}

export function handleListConstraints(args, defaultCwd = process.cwd()) {
  const { format = "markdown", cwd = defaultCwd } = args ?? {};
  assertFormat(format);

  const sources = readAgentctx(resolve(cwd));
  const raw = sources["constraints.md"] ?? "";
  const blocks = parseMarkdownBlocks(raw, "constraints.md");

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

// ---------------------------------------------------------------------------
// JSON-RPC dispatch
// ---------------------------------------------------------------------------

function sendResponse(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}

function sendError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n");
}

function dispatch(request, defaultCwd) {
  const { id, method, params } = request;

  if (method === "initialize") {
    sendResponse(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    });
    return;
  }

  if (method === "notifications/initialized") {
    return;
  }

  if (method === "tools/list") {
    sendResponse(id, { tools: TOOLS });
    return;
  }

  if (method === "tools/call") {
    const { name, arguments: toolArgs } = params ?? {};
    try {
      let result;
      if (name === "get_context") {
        result = handleGetContext(toolArgs, defaultCwd);
      } else if (name === "list_constraints") {
        result = handleListConstraints(toolArgs, defaultCwd);
      } else {
        sendError(id, -32601, `Unknown tool: ${name}`);
        return;
      }
      sendResponse(id, result);
    } catch (err) {
      const code = err instanceof McpError ? err.code : -32603;
      sendError(id, code, err.message);
    }
    return;
  }

  // Ignore notifications (no id field)
  if (id === undefined || id === null) return;

  sendError(id, -32601, `Method not found: ${method}`);
}

// ---------------------------------------------------------------------------
// stdio server
// ---------------------------------------------------------------------------

export function runServer(defaultCwd = process.cwd()) {
  const rl = createInterface({ input: process.stdin, terminal: false });

  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let request;
    try {
      request = JSON.parse(trimmed);
    } catch {
      sendError(null, -32700, "Parse error: invalid JSON");
      return;
    }

    dispatch(request, defaultCwd);
  });

  rl.on("close", () => process.exit(0));
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  runServer(resolveDefaultCwd());
}
