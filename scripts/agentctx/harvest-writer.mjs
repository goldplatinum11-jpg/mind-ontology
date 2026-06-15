/**
 * harvest-writer.mjs — Appends classified ontology entries to .agentctx/ files
 * with duplicate protection and provenance tracking.
 *
 * Target files per category:
 *   decision   → decisions.md
 *   constraint → constraints.md
 *   glossary   → glossary.md
 *   principle  → principles.md
 *   inbox      → inbox.md  (uncertain / low-confidence / contradicted)
 *
 * Provenance:
 *   .agentctx/sources/<sourceId>.jsonl  — one JSON line per written entry
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { CATEGORY, CONFIDENCE } from "./harvest-model.mjs";

// ---------------------------------------------------------------------------
// File mapping
// ---------------------------------------------------------------------------

const CATEGORY_FILE = {
  [CATEGORY.DECISION]:   "decisions.md",
  [CATEGORY.CONSTRAINT]: "constraints.md",
  [CATEGORY.GLOSSARY]:   "glossary.md",
  [CATEGORY.PRINCIPLE]:  "principles.md",
  [CATEGORY.INBOX]:      "inbox.md",
};

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

/**
 * Normalise a heading for duplicate comparison:
 * lowercase, collapse whitespace, strip leading punctuation.
 */
function normaliseHeading(h) {
  return h.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Extract all existing ## headings from a Markdown file.
 */
function existingHeadings(filePath) {
  if (!existsSync(filePath)) return new Set();
  const content = readFileSync(filePath, "utf8");
  const headings = new Set();
  for (const line of content.split("\n")) {
    const m = line.match(/^##\s+(.+)/);
    if (m) {
      // Strip inline #tags before normalising so duplicate check ignores tags
      const headingOnly = m[1].replace(/#\w+/g, "").trim();
      headings.add(normaliseHeading(headingOnly));
    }
  }
  return headings;
}

// ---------------------------------------------------------------------------
// Block rendering
// ---------------------------------------------------------------------------

/**
 * Render an OntologyEntry as a Markdown section to append.
 * Low/medium confidence entries get an HTML comment noting they were harvested.
 */
function renderBlock(entry, sourceLabel) {
  const tagStr = entry.tags && entry.tags.length > 0
    ? " " + entry.tags.map(t => `#${t}`).join(" ")
    : "";

  const note = entry.confidence !== CONFIDENCE.HIGH
    ? `\n<!-- harvested from: ${sourceLabel}; confidence: ${entry.confidence} -->`
    : "";

  const body = entry.body ? `\n${entry.body}\n` : "\n";

  return `\n## ${entry.heading}${tagStr}${note}${body}`;
}

// ---------------------------------------------------------------------------
// Provenance registry
// ---------------------------------------------------------------------------

function sourcesDir(agentctxDir) {
  return join(agentctxDir, "sources");
}

function provenancePath(agentctxDir, sourceId) {
  // Sanitise sourceId to safe filename
  const safe = sourceId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  return join(sourcesDir(agentctxDir), `${safe}.jsonl`);
}

function appendProvenance(agentctxDir, sourceId, entry, targetFile) {
  const dir = sourcesDir(agentctxDir);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const line = JSON.stringify({
    t: new Date().toISOString(),
    heading: entry.heading,
    category: entry.category,
    confidence: entry.confidence,
    targetFile,
    turnIndex: entry.turnIndex ?? null,
  });
  appendFileSync(provenancePath(agentctxDir, sourceId), line + "\n", "utf8");
}

// ---------------------------------------------------------------------------
// Source registry (sources/sources.jsonl) — one line per imported source
// ---------------------------------------------------------------------------

/**
 * Record that a HarvestSource was imported.
 *
 * @param {string} agentctxDir
 * @param {import('./harvest-model.mjs').HarvestSource} source
 */
export function recordSource(agentctxDir, source) {
  const dir = sourcesDir(agentctxDir);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const registryPath = join(dir, "sources.jsonl");
  const line = JSON.stringify({ ...source, recordedAt: new Date().toISOString() });
  appendFileSync(registryPath, line + "\n", "utf8");
}

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------

/**
 * Write a single OntologyEntry to the appropriate .agentctx/ file.
 *
 * @param {string} agentctxDir  Absolute path to the .agentctx/ directory.
 * @param {import('./harvest-model.mjs').OntologyEntry} entry
 * @param {string} sourceLabel  Human-readable label of the source (for comments).
 * @returns {import('./harvest-model.mjs').WritebackResult}
 */
export function writeEntry(agentctxDir, entry, sourceLabel = "imported") {
  const fileName = CATEGORY_FILE[entry.category] ?? CATEGORY_FILE[CATEGORY.INBOX];
  const targetFile = fileName;
  const filePath = join(agentctxDir, fileName);

  const headings = existingHeadings(filePath);
  const normHeading = normaliseHeading(entry.heading);

  if (headings.has(normHeading)) {
    return { written: false, duplicate: true, targetFile, heading: entry.heading };
  }

  try {
    // Create file with a minimal header if it doesn't exist yet
    if (!existsSync(filePath)) {
      const title = fileName.replace(".md", "").replace(/-/g, " ");
      writeFileSync(
        filePath,
        `# ${title.charAt(0).toUpperCase() + title.slice(1)}\n`,
        "utf8",
      );
    }

    const block = renderBlock(entry, sourceLabel);
    appendFileSync(filePath, block, "utf8");
    appendProvenance(agentctxDir, entry.sourceId, entry, targetFile);

    return { written: true, duplicate: false, targetFile, heading: entry.heading };
  } catch (err) {
    return {
      written: false,
      duplicate: false,
      targetFile,
      heading: entry.heading,
      error: err.message,
    };
  }
}

/**
 * Write multiple entries, returning an ImportSummary-compatible results array.
 *
 * @param {string} agentctxDir
 * @param {import('./harvest-model.mjs').OntologyEntry[]} entries
 * @param {string} sourceLabel
 * @returns {import('./harvest-model.mjs').WritebackResult[]}
 */
export function writeEntries(agentctxDir, entries, sourceLabel = "imported") {
  return entries.map(e => writeEntry(agentctxDir, e, sourceLabel));
}
