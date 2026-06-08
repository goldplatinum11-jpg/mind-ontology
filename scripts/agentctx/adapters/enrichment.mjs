// Mind Ontology — hosted-memory enrichment rendering (Phase 4 / P4-PR07).
//
// Renders memory-retrieval results (MemoryResult[]) into a clearly-LABELED,
// SEPARATE section so an agent never confuses hosted memory with local source
// blocks. Pure formatting — no hosted call, no secret. With no results (the
// default when the flag is off or the null adapter is used), it renders nothing.

import { isMemoryResult } from "./memory-adapter.mjs";

export const ENRICHMENT_HEADER = "## Hosted Memory (enrichment)";

/**
 * Render a labeled enrichment section from memory results. Returns "" when there
 * is nothing to add, so a flag-off / null-adapter pack is byte-identical to the
 * pure local pack.
 *
 * @param {Array} results MemoryResult[]
 * @returns {string}
 */
export function renderEnrichmentSection(results) {
  const valid = Array.isArray(results) ? results.filter(isMemoryResult) : [];
  if (valid.length === 0) return "";

  const lines = [
    ENRICHMENT_HEADER,
    "",
    "_Optional hosted-memory results. Separate from local source blocks; advisory, not constraints._",
    "",
  ];
  for (const r of valid) {
    const meta = [r.source ? `source: ${r.source}` : null, r.score !== undefined ? `score: ${r.score}` : null]
      .filter(Boolean)
      .join(", ");
    lines.push(`- [${r.id}]${meta ? ` (${meta})` : ""}: ${r.text}`);
  }
  lines.push("");
  return lines.join("\n");
}

/** True if a rendered pack string contains an enrichment section. */
export function hasEnrichment(packText) {
  return typeof packText === "string" && packText.includes(ENRICHMENT_HEADER);
}
