// Mind Ontology hosted connector — pure HTTP handlers (PR1, GPT Action surface).
//
// Thin transport over the EXISTING compile contract. These handlers import the
// engine's compileContext / parseMarkdownBlocks / renderContextPackJson verbatim
// and add nothing but request shaping and a snapshot source — so the hosted
// surface cannot diverge from the local stdio server's `format: json` output.
// No scoring, parsing, or rendering logic is re-implemented here.
//
// Each handler returns a plain `{ status, json }` so the Worker entry (index.mjs)
// owns the actual Response construction. Stateless: the snapshot is read per call.

import {
  compileContext,
  parseMarkdownBlocks,
  renderContextPackJson,
} from "../../../scripts/agentctx/compile.mjs";
import { loadSnapshot } from "./source-snapshot.mjs";

// Mirror the stdio server's scope normalization: accept a comma-string or an
// array, trim, drop empties.
function normalizeScope(scope) {
  if (Array.isArray(scope)) return scope.map((s) => String(s).trim()).filter(Boolean);
  if (typeof scope === "string") return scope.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

// POST /get_context — body { task: string, scope?: string|string[] } -> ContextPack JSON.
export function httpGetContext(snapshot, body) {
  const sources = loadSnapshot(snapshot);
  const { task, scope } = body ?? {};

  if (!task || typeof task !== "string" || !task.trim()) {
    return { status: 400, json: { error: 'Parameter "task" is required and must be a non-empty string.' } };
  }

  const scopes = normalizeScope(scope);
  const pack = compileContext({ sources, task: task.trim(), scopes });
  // Reuse the engine's JSON renderer verbatim, then parse back to an object so
  // the HTTP body is the identical ContextPack the stdio server emits for
  // `format: json`. PR1 is JSON-only; markdown stays a future MCP-side concern.
  return { status: 200, json: JSON.parse(renderContextPackJson(pack)) };
}

// POST /list_constraints — body {} (ignored) -> { file, blockCount, blocks }.
// Same shape the stdio handler returns for `format: json`.
export function httpListConstraints(snapshot) {
  const sources = loadSnapshot(snapshot);
  const blocks = parseMarkdownBlocks(sources["constraints.md"] ?? "", "constraints.md");
  return {
    status: 200,
    json: {
      file: "constraints.md",
      blockCount: blocks.length,
      blocks: blocks.map((b) => ({ title: b.title, tags: b.tags, body: b.body })),
    },
  };
}
