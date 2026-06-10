#!/usr/bin/env node

/**
 * Competency-question answerability core (Workbench W7/W8).
 *
 * Operationalizes docs/mind-ontology-cq-schema-v0.md per W2 §6: for each CQ
 * block in .agentctx/cq.md, compile a pack using the rendered question title
 * as the task and decide — deterministically, structurally, with no language
 * model — whether the pack answers it, and from which blocks.
 *
 * The predicate (locked by W8's table-driven fixtures): a CQ is answered when
 * the compiled pack contains at least one block, from any file other than
 * cq.md (a question can never answer itself), that either
 *   (a) was selected by scoring against the question text (reason "matched"),
 *   or
 *   (b) shares a topic tag with the CQ (the CQ's tags minus the "cq" marker).
 * No wall-clock, locale, or randomness input anywhere.
 *
 * Gate strength (operator ruling, W2 §6 ratified amendment): only the CQ
 * schema's required topics gate the verdict — an unanswered #context or
 * #safety CQ fails; every other unanswered CQ is advisory.
 */

import { compileContext, parseMarkdownBlocks } from "./compile.mjs";

export const CQ_SOURCE_FILE = "cq.md";
export const CQ_MARKER_TAG = "cq";
// The CQ schema's required topics (#context / #safety).
export const REQUIRED_CQ_TOPICS = new Set(["context", "safety"]);

/**
 * Parse the CQ blocks out of the sources. Ids are 1-based source order —
 * a session-scoped selector, not a stable reference (W2 §6).
 * Returns [{ id, question, tags, topics }].
 */
export function parseCqs(sources) {
  const blocks = parseMarkdownBlocks(sources[CQ_SOURCE_FILE] ?? "", CQ_SOURCE_FILE);
  return blocks
    .filter((block) => block.tags.includes(CQ_MARKER_TAG))
    .map((block, i) => ({
      id: i + 1,
      question: block.title,
      tags: block.tags,
      topics: block.tags.filter((tag) => tag !== CQ_MARKER_TAG),
    }));
}

/**
 * Evaluate one CQ against the sources.
 * Returns { id, question, tags, required, answered, answered_by }.
 */
export function evaluateCq(sources, cq) {
  const pack = compileContext({ sources, task: cq.question });
  const topicSet = new Set(cq.topics);
  const contributing = pack.selected.filter(
    (block) =>
      block.file !== CQ_SOURCE_FILE &&
      (block.reason === "matched" || block.tags.some((tag) => topicSet.has(tag))),
  );
  return {
    id: cq.id,
    question: cq.question,
    tags: cq.tags,
    required: cq.topics.some((topic) => REQUIRED_CQ_TOPICS.has(topic)),
    answered: contributing.length > 0,
    answered_by: contributing.map((block) => ({
      sourceFile: block.file,
      heading: block.title,
    })),
  };
}

/**
 * Evaluate every CQ (or one, via `id`).
 * Returns { ok, total, answered, cqs } where `ok` applies the required-only
 * gate: false iff a required-topic CQ is unanswered.
 */
export function evaluateCqs(sources, { id = null } = {}) {
  const all = parseCqs(sources);
  const selected = id === null ? all : all.filter((cq) => cq.id === id);
  const cqs = selected.map((cq) => evaluateCq(sources, cq));
  return {
    ok: cqs.every((cq) => cq.answered || !cq.required),
    total: cqs.length,
    answered: cqs.filter((cq) => cq.answered).length,
    cqs,
  };
}
