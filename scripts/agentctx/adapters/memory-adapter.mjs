// Mind Ontology — hosted memory retrieval adapter contract (Phase 4 / P4-PR01).
//
// OPTIONAL, HOSTED, READ-ONLY. This module defines the *contract* for an
// optional hosted memory-retrieval adapter plus the LOCAL FAIL-CLOSED default.
// The OSS layer ships only the contract and the null default — no hosted
// endpoint, no auth, no secret. If no adapter is configured, retrieval returns
// nothing and compilation behaves exactly as the pure local layer.
//
// Contract:
//   adapter.name: string
//   adapter.retrieve(query) => Promise<{ results: MemoryResult[] }>
//     query:  { task: string, scopes?: string[], limit?: number }
//     MemoryResult: { id: string, text: string, score?: number, source?: string }
//
// An adapter MUST be read-only. Writeback is a separate contract (P4-PR02).

export const MEMORY_RESULT_FIELDS = ["id", "text"];

/**
 * The local fail-closed default: a conforming adapter that never reaches the
 * network and always returns zero results. This is what the OSS layer uses when
 * no hosted adapter is configured.
 */
export const NULL_MEMORY_ADAPTER = Object.freeze({
  name: "null",
  async retrieve(_query) {
    return { results: [] };
  },
});

/** Structural check: does `obj` implement the adapter contract? */
export function isMemoryAdapter(obj) {
  return Boolean(obj) && typeof obj.name === "string" && typeof obj.retrieve === "function";
}

/** Validate a single retrieval result against the contract. */
export function isMemoryResult(result) {
  if (!result || typeof result !== "object") return false;
  if (typeof result.id !== "string" || result.id.length === 0) return false;
  if (typeof result.text !== "string") return false;
  if (result.score !== undefined && typeof result.score !== "number") return false;
  if (result.source !== undefined && typeof result.source !== "string") return false;
  return true;
}

/**
 * Retrieve memory results through an adapter, fail-closed. Any missing adapter,
 * non-conforming adapter, thrown error, or malformed payload degrades to an
 * empty result set — the local ontology must never depend on the hosted layer.
 *
 * @returns {Promise<{ results: Array, degraded: boolean, reason?: string }>}
 */
export async function retrieveMemory(adapter, query) {
  if (!isMemoryAdapter(adapter)) {
    return { results: [], degraded: true, reason: "no-adapter" };
  }
  try {
    const out = await adapter.retrieve(query);
    const results = Array.isArray(out?.results) ? out.results.filter(isMemoryResult) : [];
    return { results, degraded: false };
  } catch (error) {
    return { results: [], degraded: true, reason: `adapter-error: ${error?.message ?? "unknown"}` };
  }
}
