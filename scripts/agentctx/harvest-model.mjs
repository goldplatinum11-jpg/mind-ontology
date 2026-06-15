/**
 * harvest-model.mjs — Domain model for the ontology harvester.
 *
 * Defines the types used across harvesting, classification, writing, and
 * provenance tracking. Pure data shapes; no I/O.
 */

// ---------------------------------------------------------------------------
// Category constants — which .agentctx/ file a candidate targets.
// ---------------------------------------------------------------------------

export const CATEGORY = /** @type {const} */ ({
  DECISION:   "decision",    // decisions.md
  CONSTRAINT: "constraint",  // constraints.md
  GLOSSARY:   "glossary",    // glossary.md
  PRINCIPLE:  "principle",   // principles.md
  INBOX:      "inbox",       // inbox.md (uncertain / low-confidence / contradicted)
});

// ---------------------------------------------------------------------------
// Confidence tiers
// ---------------------------------------------------------------------------

export const CONFIDENCE = /** @type {const} */ ({
  HIGH:   "high",    // Clear, durable, named decision with rationale
  MEDIUM: "medium",  // Plausible but may need human review
  LOW:    "low",     // Routed to inbox.md automatically
});

/**
 * A source document that was imported for harvesting.
 *
 * @typedef {Object} HarvestSource
 * @property {string}  id          Stable identifier (e.g. sha256 of content, or "chatgpt:<conversationId>")
 * @property {string}  type        Provider type: "chatgpt-export" | "claude-session" | "manual"
 * @property {string}  label       Human-readable label (filename, conversation title, …)
 * @property {string}  importedAt  ISO-8601 timestamp
 * @property {string}  [path]      Local file path if applicable
 */

/**
 * A single candidate extracted from a source before classification.
 *
 * @typedef {Object} HarvestCandidate
 * @property {string} sourceId       References HarvestSource.id
 * @property {string} text           The raw extracted text
 * @property {string} context        Surrounding context (prior/next utterance snippet)
 * @property {string} [speakerRole]  "user" | "assistant" | "unknown"
 * @property {number} [turnIndex]    0-based index of the conversation turn
 */

/**
 * A classified, ready-to-write ontology entry.
 *
 * @typedef {Object} OntologyEntry
 * @property {string}   category    One of CATEGORY values
 * @property {string}   confidence  One of CONFIDENCE values
 * @property {string}   heading     Markdown heading text (without ##)
 * @property {string}   body        Markdown body (may be empty)
 * @property {string[]} [tags]      Inferred tags (without #)
 * @property {string}   sourceId    References HarvestSource.id
 * @property {number}   [turnIndex] Conversation turn index
 * @property {string}   [reason]    Why this was classified as this category
 * @property {string}   [supersedes] heading of a prior entry this replaces (for future use)
 */

/**
 * Result returned by the .agentctx writer after attempting a write.
 *
 * @typedef {Object} WritebackResult
 * @property {boolean} written      True if a new block was appended
 * @property {boolean} duplicate    True if an identical/near-identical heading already existed
 * @property {string}  targetFile   The .agentctx/ file that was (or would have been) written
 * @property {string}  [heading]    The heading that was processed
 * @property {string}  [error]      Error message if write failed
 */

/**
 * Summary of a full import run.
 *
 * @typedef {Object} ImportSummary
 * @property {number}          sourcesProcessed
 * @property {number}          candidatesFound
 * @property {number}          entriesWritten
 * @property {number}          duplicatesSkipped
 * @property {number}          inboxed           Routed to inbox.md (low-confidence/uncertain)
 * @property {number}          rejected          Filtered out (implementation details)
 * @property {WritebackResult[]} results
 */
