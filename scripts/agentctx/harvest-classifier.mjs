/**
 * harvest-classifier.mjs — Classifier that decides which harvest candidates
 * become ontology entries and which are rejected or inboxed.
 *
 * Rules (strict):
 *   KEEP → decisions, constraints, glossary terms, product principles
 *   REJECT → function/variable names, bug-fix minutiae, test names,
 *             command logs, temporary work state, implementation steps
 *   INBOX → uncertain, contradicted, low-confidence, AI-only speculation
 */

import { CATEGORY, CONFIDENCE } from "./harvest-model.mjs";

// ---------------------------------------------------------------------------
// Rejection patterns — implementation details that must not enter the ontology
// ---------------------------------------------------------------------------

const REJECT_PATTERNS = [
  // Code identifiers
  /\b(function|const|let|var|class|import|export|return|async|await)\s+\w+/i,
  // Bug / fix references
  /\b(fix(ed)?|bug|hotfix|patch|workaround|hack|todo|fixme)\b/i,
  // Test / CI noise
  /\b(test(s)?|spec|vitest|jest|describe|it\(|expect\(|passing|failing|green|red)\b/i,
  // Command log lines
  /^\s*\$\s+/,
  /\bnpm (run|install|ci|test|publish)\b/i,
  /\bgit (add|commit|push|merge|checkout|branch|log|diff|status)\b/i,
  // Transient progress markers
  /\b(wip|in progress|done|✓|✅|❌|→|lane \d|step \d|pr \d)\b/i,
  // File path / line number noise
  /\b\w+\.(mjs|js|ts|json|md):\d+\b/,
  // Exit codes / process output
  /exit code \d+/i,
  /\b(stdout|stderr|output)\b/i,
];

// ---------------------------------------------------------------------------
// Acceptance patterns — signals that a candidate is durable knowledge
// ---------------------------------------------------------------------------

const DECISION_PATTERNS = [
  /\b(decided?|decision|chose|chosen|we (will|won't|should|must|agreed|settled|locked))\b/i,
  /\b(rationale|reason(ing)?|because|therefore|that('s| is) why)\b/i,
  /\b(going forward|from now on|henceforth|policy|approach)\b/i,
];

const CONSTRAINT_PATTERNS = [
  /\b(must not|never|forbidden|prohibited|do not|don't|avoid|blocked?|banned?)\b/i,
  /\b(always|required|mandatory|enforce[sd]?|guaranteed|invariant)\b/i,
  /\b(boundary|limit|off.limits|red.zone|hard.stop)\b/i,
];

const GLOSSARY_PATTERNS = [
  /\b(\w[\w\s]{1,30}) (means?|refers? to|is defined as|stands? for|denotes?)\b/i,
  /\bterminology\b/i,
  /\b(term|concept|definition|abbreviation|acronym)\b/i,
];

const PRINCIPLE_PATTERNS = [
  /\b(principle|philosophy|posture|ethos|belief|value|design goal)\b/i,
  /\b(goal is to|aim(s?) to|we believe|core idea|guiding)\b/i,
];

// ---------------------------------------------------------------------------
// Confidence scoring
// ---------------------------------------------------------------------------

/**
 * Score how confident we are that a candidate is durable knowledge.
 * Returns 0–1. Below 0.3 → inbox.
 */
function scoreConfidence(text) {
  let score = 0;

  // Penalise short / fragment texts
  if (text.length < 40) score -= 0.3;
  if (text.length > 60) score += 0.1;

  // Boost if multiple strong signals
  const signals = [
    ...DECISION_PATTERNS,
    ...CONSTRAINT_PATTERNS,
    ...GLOSSARY_PATTERNS,
    ...PRINCIPLE_PATTERNS,
  ];
  for (const re of signals) {
    if (re.test(text)) score += 0.2;
  }

  // Penalise if it looks like implementation noise
  for (const re of REJECT_PATTERNS) {
    if (re.test(text)) score -= 0.4;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Infer category from candidate text. Returns the best-matching CATEGORY.
 */
function inferCategory(text) {
  const scores = {
    [CATEGORY.DECISION]:   DECISION_PATTERNS.filter(re => re.test(text)).length,
    [CATEGORY.CONSTRAINT]: CONSTRAINT_PATTERNS.filter(re => re.test(text)).length,
    [CATEGORY.GLOSSARY]:   GLOSSARY_PATTERNS.filter(re => re.test(text)).length,
    [CATEGORY.PRINCIPLE]:  PRINCIPLE_PATTERNS.filter(re => re.test(text)).length,
  };

  const max = Math.max(...Object.values(scores));
  if (max === 0) return CATEGORY.INBOX;
  // Priority order for ties: CONSTRAINT > GLOSSARY > PRINCIPLE > DECISION
  for (const cat of [CATEGORY.CONSTRAINT, CATEGORY.GLOSSARY, CATEGORY.PRINCIPLE, CATEGORY.DECISION]) {
    if (scores[cat] === max) return cat;
  }
}

/**
 * Extract a short heading from the candidate text (first sentence, ≤ 80 chars).
 */
function extractHeading(text) {
  const first = text.split(/[.\n]/)[0].trim();
  return first.length > 80 ? first.slice(0, 77) + "…" : first;
}

/**
 * Extract body: everything after the first sentence.
 */
function extractBody(text) {
  const idx = text.search(/[.\n]/);
  if (idx < 0) return "";
  return text.slice(idx + 1).trim();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify a single HarvestCandidate into an OntologyEntry (or null to reject).
 *
 * @param {import('./harvest-model.mjs').HarvestCandidate} candidate
 * @returns {import('./harvest-model.mjs').OntologyEntry | null}
 */
export function classifyCandidate(candidate) {
  const text = candidate.text.trim();

  // Hard reject: matches implementation-detail patterns
  for (const re of REJECT_PATTERNS) {
    if (re.test(text)) return null;
  }

  const confidence01 = scoreConfidence(text);

  // Very low confidence → outright reject (noise, not even worth inboxing)
  if (confidence01 < 0.1) return null;

  const category = confidence01 < 0.3 ? CATEGORY.INBOX : inferCategory(text);
  const confidence =
    confidence01 >= 0.6 ? CONFIDENCE.HIGH :
    confidence01 >= 0.3 ? CONFIDENCE.MEDIUM :
    CONFIDENCE.LOW;

  return {
    category,
    confidence,
    heading: extractHeading(text),
    body:    extractBody(text),
    tags:    [],
    sourceId: candidate.sourceId,
    turnIndex: candidate.turnIndex,
    reason: `score=${confidence01.toFixed(2)}`,
  };
}

/**
 * Classify an array of candidates, returning only non-null entries.
 *
 * @param {import('./harvest-model.mjs').HarvestCandidate[]} candidates
 * @returns {import('./harvest-model.mjs').OntologyEntry[]}
 */
export function classifyCandidates(candidates) {
  return candidates.map(classifyCandidate).filter(Boolean);
}
