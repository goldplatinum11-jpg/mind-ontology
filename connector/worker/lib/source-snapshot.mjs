// Mind Ontology hosted connector — source snapshot adapter (PR1).
//
// The local stdio MCP server reads `.agentctx/` from the filesystem
// (compile.mjs `readAgentctx`). A Cloudflare Worker has no filesystem, so the
// hosted connector serves a *deploy-time snapshot* of one workspace instead: a
// plain JSON map of the same SOURCE_FILES the engine already knows. This module
// is filesystem-free and Worker-safe; the Node-only build script
// (scripts/build-agentctx-snapshot.mjs) produces the snapshot via the engine's
// readAgentctx before bundling.
//
// The snapshot carries exactly the `{ "<file>.md": "<content>" }` shape
// readAgentctx returns, so it can be handed straight to compileContext({ sources })
// with no second implementation of the ontology.

import { SOURCE_FILES, REQUIRED_SOURCE_FILES } from "../../../scripts/agentctx/compile.mjs";

export const SNAPSHOT_SCHEMA = "agentctx-snapshot/v1";

// Build a snapshot object from an in-memory sources map (filename -> content).
// Pure: no filesystem access. Every SOURCE_FILES key is present (missing ones
// become "" — the same normalization readAgentctx applies for absent files).
export function buildSnapshot(sources) {
  const out = {};
  for (const file of SOURCE_FILES) {
    out[file] = typeof sources?.[file] === "string" ? sources[file] : "";
  }
  return { schema: SNAPSHOT_SCHEMA, sources: out };
}

// Validate a parsed snapshot object and return its sources map. Throws on a
// malformed snapshot. Worker-safe (no filesystem). The required-source check
// mirrors the engine's validateAgentctxSources contract (constraints.md must be
// present and non-empty) so a hosted miss fails loudly instead of serving an
// empty pack.
export function loadSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    throw new Error("agentctx snapshot must be an object");
  }
  if (snapshot.schema !== SNAPSHOT_SCHEMA) {
    throw new Error(`agentctx snapshot schema must be "${SNAPSHOT_SCHEMA}", got: ${snapshot.schema}`);
  }
  const sources = snapshot.sources;
  if (!sources || typeof sources !== "object") {
    throw new Error("agentctx snapshot.sources must be an object of { filename: content }");
  }
  for (const file of REQUIRED_SOURCE_FILES) {
    if (typeof sources[file] !== "string" || !sources[file].trim()) {
      throw new Error(`agentctx snapshot is missing required source: ${file}`);
    }
  }
  return sources;
}
