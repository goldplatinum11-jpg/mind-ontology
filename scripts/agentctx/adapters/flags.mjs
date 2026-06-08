// Mind Ontology — adapter feature flags (Phase 4 / P4-PR06).
//
// Gates the optional hosted adapters behind flags that DEFAULT OFF (local
// fail-closed). The only way to enable a hosted adapter is an explicit truthy
// env value AND a conforming adapter object; anything else resolves to the null
// adapter, so the local layer is the default and any misconfiguration degrades
// to local rather than failing or leaking.

import { NULL_MEMORY_ADAPTER, isMemoryAdapter } from "./memory-adapter.mjs";
import { NULL_WRITEBACK_ADAPTER, isWritebackAdapter } from "./writeback-adapter.mjs";

export const MEMORY_FLAG = "AGENTCTX_ENABLE_MEMORY";
export const WRITEBACK_FLAG = "AGENTCTX_ENABLE_WRITEBACK";

// Only these exact values enable a flag. Everything else (unset, "0", "false",
// "off", typos) is OFF.
const TRUTHY = new Set(["1", "true", "on", "yes"]);

export function isFlagEnabled(value) {
  return typeof value === "string" && TRUTHY.has(value.trim().toLowerCase());
}

/**
 * Resolve adapter flags from an environment map. Both default to false.
 * @returns {{ memoryRetrieval: boolean, writebackProposals: boolean }}
 */
export function resolveAdapterFlags(env = process.env) {
  return {
    memoryRetrieval: isFlagEnabled(env?.[MEMORY_FLAG]),
    writebackProposals: isFlagEnabled(env?.[WRITEBACK_FLAG]),
  };
}

/**
 * Choose the active memory adapter: the provided one only when the flag is on
 * AND it conforms; otherwise the fail-closed null adapter.
 */
export function selectMemoryAdapter(flags, adapter) {
  if (flags?.memoryRetrieval && isMemoryAdapter(adapter)) return adapter;
  return NULL_MEMORY_ADAPTER;
}

/**
 * Choose the active writeback adapter under the same rules.
 */
export function selectWritebackAdapter(flags, adapter) {
  if (flags?.writebackProposals && isWritebackAdapter(adapter)) return adapter;
  return NULL_WRITEBACK_ADAPTER;
}
