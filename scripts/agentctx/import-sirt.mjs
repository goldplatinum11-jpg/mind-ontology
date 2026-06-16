#!/usr/bin/env node
/**
 * import-sirt.mjs — mind-ontology import-sirt
 *
 * Fetches SIRT nodes via the SIRT MCP API and runs them through the
 * harvester pipeline, writing classified entries to .agentctx/.
 *
 * Requires: SIRT_API_KEY environment variable.
 *
 * Usage:
 *   mind-ontology import-sirt [--cwd <dir>] [--dry-run] [--format json]
 *                             [--limit <n>] [--query <str>]
 *
 * Flags:
 *   --cwd <dir>     Project root containing .agentctx/ (default: process.cwd())
 *   --dry-run       Run the pipeline but do not write any files
 *   --format json   Output machine-readable JSON summary
 *   --limit <n>     Max SIRT nodes to fetch (default: 50)
 *   --query <str>   Semantic filter passed to sirt_nodes_list
 */

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { classifyCandidates } from "./harvest-classifier.mjs";
import { recordSource, writeEntries } from "./harvest-writer.mjs";
import { createSirtClient, parseSirtNodes } from "./harvest-sirt.mjs";

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { cwd: null, dryRun: false, format: "text", limit: 50, query: null };
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === "--cwd" && argv[i + 1])    { args.cwd = argv[++i]; }
    else if (a === "--dry-run")           { args.dryRun = true; }
    else if (a === "--format" && argv[i + 1]) { args.format = argv[++i]; }
    else if (a === "--limit" && argv[i + 1])  { args.limit = Number(argv[++i]); }
    else if (a === "--query" && argv[i + 1])  { args.query = argv[++i]; }
    i++;
  }
  return args;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run(argv) {
  const args = parseArgs(argv);

  const apiKey = process.env.SIRT_API_KEY;
  if (!apiKey) {
    process.stderr.write(
      "import-sirt: SIRT_API_KEY environment variable is not set.\n" +
      "Set it in your shell or .claude/settings.json env block and retry.\n",
    );
    process.exit(1);
  }

  const cwd = args.cwd ? resolve(args.cwd) : process.cwd();
  const agentctxDir = join(cwd, ".agentctx");

  if (!existsSync(agentctxDir)) {
    process.stderr.write(
      `import-sirt: no .agentctx/ found in ${cwd}\n` +
      `Run "mind-ontology init" first.\n`,
    );
    process.exit(1);
  }

  // Fetch nodes from SIRT
  let nodes;
  try {
    const client = createSirtClient(apiKey);
    nodes = await client.listNodes({
      limit: args.limit,
      query: args.query ?? undefined,
    });
  } catch (err) {
    process.stderr.write(`import-sirt: SIRT fetch error — ${err.message}\n`);
    process.exit(1);
  }

  const importedAt = new Date().toISOString();
  const parsed = parseSirtNodes(nodes, importedAt);

  let totalCandidates = 0;
  let totalWritten = 0;
  let totalDuplicates = 0;
  let totalInboxed = 0;
  let totalRejected = 0;
  const allResults = [];

  for (const { source, candidates } of parsed) {
    totalCandidates += candidates.length;

    const entries = classifyCandidates(candidates);
    const rejected = candidates.length - entries.length;
    totalRejected += rejected;

    const inboxed = entries.filter(e => e.category === "inbox").length;
    totalInboxed += inboxed;

    if (!args.dryRun) {
      recordSource(agentctxDir, source);
      const results = writeEntries(agentctxDir, entries, source.label);
      for (const r of results) {
        if (r.written) totalWritten++;
        if (r.duplicate) totalDuplicates++;
      }
      allResults.push(...results);
    } else {
      totalWritten += entries.filter(e => e.category !== "inbox").length;
    }
  }

  const summary = {
    ok: true,
    dryRun: args.dryRun,
    nodesProcessed: parsed.length,
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

  const dr = args.dryRun ? " [DRY RUN]" : "";
  process.stdout.write(`import-sirt${dr}: fetched ${nodes.length} nodes from SIRT\n`);
  process.stdout.write(`  nodes:      ${summary.nodesProcessed}\n`);
  process.stdout.write(`  candidates: ${summary.candidatesFound}\n`);
  process.stdout.write(`  written:    ${summary.entriesWritten}\n`);
  process.stdout.write(`  duplicates: ${summary.duplicatesSkipped}\n`);
  process.stdout.write(`  inboxed:    ${summary.inboxed} (→ .agentctx/inbox.md)\n`);
  process.stdout.write(`  rejected:   ${summary.rejected} (implementation details filtered)\n`);
}

run(process.argv.slice(2));
