#!/usr/bin/env node
/**
 * import.mjs — mind-ontology import <path>
 *
 * Imports a ChatGPT exported conversations.json (or single conversation JSON)
 * and runs the harvester pipeline:
 *   parse → classify → write to .agentctx/
 *
 * Uncertain / low-confidence / contradicted entries land in inbox.md for
 * human review. Implementation details are filtered out silently.
 *
 * Usage:
 *   mind-ontology import ./conversations.json [--cwd <dir>] [--dry-run] [--format json]
 *
 * Flags:
 *   --cwd <dir>     Project root containing .agentctx/ (default: process.cwd())
 *   --dry-run       Run the pipeline but do not write any files
 *   --format json   Output machine-readable JSON summary
 */

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseChatGPTFile } from "./harvest-chatgpt.mjs";
import { classifyCandidates } from "./harvest-classifier.mjs";
import { recordSource, writeEntries } from "./harvest-writer.mjs";

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { cwd: null, dryRun: false, format: "text", file: null };
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === "--cwd" && argv[i + 1]) { args.cwd = argv[++i]; }
    else if (a === "--dry-run")        { args.dryRun = true; }
    else if (a === "--format" && argv[i + 1]) { args.format = argv[++i]; }
    else if (!a.startsWith("--"))      { args.file = a; }
    i++;
  }
  return args;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function run(argv) {
  const args = parseArgs(argv);

  if (!args.file) {
    process.stderr.write(
      "Usage: mind-ontology import <path> [--cwd <dir>] [--dry-run] [--format json]\n",
    );
    process.exit(1);
  }

  const filePath = resolve(args.file);
  if (!existsSync(filePath)) {
    process.stderr.write(`import: file not found: ${filePath}\n`);
    process.exit(1);
  }

  const cwd = args.cwd ? resolve(args.cwd) : process.cwd();
  const agentctxDir = join(cwd, ".agentctx");

  if (!existsSync(agentctxDir)) {
    process.stderr.write(
      `import: no .agentctx/ found in ${cwd}\n` +
      `Run "mind-ontology init" first.\n`,
    );
    process.exit(1);
  }

  // Parse
  let parsed;
  try {
    parsed = parseChatGPTFile(filePath);
  } catch (err) {
    process.stderr.write(`import: parse error — ${err.message}\n`);
    process.exit(1);
  }

  let totalCandidates = 0;
  let totalWritten = 0;
  let totalDuplicates = 0;
  let totalInboxed = 0;
  let totalRejected = 0;
  const allResults = [];

  for (const { source, candidates } of parsed) {
    totalCandidates += candidates.length;

    // Classify
    const entries = classifyCandidates(candidates);
    const rejected = candidates.length - entries.length;
    totalRejected += rejected;

    const inboxed = entries.filter(e => e.category === "inbox").length;
    totalInboxed += inboxed;

    // Write (or dry-run)
    if (!args.dryRun) {
      recordSource(agentctxDir, source);
      const results = writeEntries(agentctxDir, entries, source.label);
      for (const r of results) {
        if (r.written) totalWritten++;
        if (r.duplicate) totalDuplicates++;
      }
      allResults.push(...results);
    } else {
      // In dry-run, count as if we would write
      totalWritten += entries.filter(e => e.category !== "inbox").length;
    }
  }

  const summary = {
    ok: true,
    dryRun: args.dryRun,
    sourcesProcessed: parsed.length,
    candidatesFound: totalCandidates,
    entriesWritten: totalWritten,
    duplicatesSkipped: totalDuplicates,
    inboxed: totalInboxed,
    rejected: totalRejected,
  };

  if (args.format === "json") {
    process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
    return;
  }

  // Text output
  const dr = args.dryRun ? " [DRY RUN]" : "";
  process.stdout.write(`import${dr}: ${filePath}\n`);
  process.stdout.write(`  sources:    ${summary.sourcesProcessed}\n`);
  process.stdout.write(`  candidates: ${summary.candidatesFound}\n`);
  process.stdout.write(`  written:    ${summary.entriesWritten}\n`);
  process.stdout.write(`  duplicates: ${summary.duplicatesSkipped}\n`);
  process.stdout.write(`  inboxed:    ${summary.inboxed} (→ .agentctx/inbox.md)\n`);
  process.stdout.write(`  rejected:   ${summary.rejected} (implementation details filtered)\n`);
}

run(process.argv.slice(2));
