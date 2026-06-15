#!/usr/bin/env node
/**
 * harvest-session.mjs — Claude Code Stop hook entry point.
 *
 * Receives the Stop hook JSON payload on stdin and harvests ontology
 * candidates from the session transcript into .agentctx/.
 *
 * Called automatically by Claude Code when a session ends, if the Stop hook
 * is configured (see: mind-ontology setup).
 *
 * Stdin payload (from Claude Code):
 *   {
 *     "session_id": "...",
 *     "transcript_path": "/path/to/.claude/projects/.../<session>.jsonl",
 *     "cwd": "/path/to/project",
 *     "hook_event_name": "Stop",
 *     ...
 *   }
 *
 * Exit codes:
 *   0  success (or silently skipped — no .agentctx/ found)
 *   1  parse/write error (logged to stderr)
 */

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseClaudeSession } from "./harvest-claude-session.mjs";
import { classifyCandidates } from "./harvest-classifier.mjs";
import { recordSource, writeEntries } from "./harvest-writer.mjs";

// ---------------------------------------------------------------------------
// Find .agentctx/ walking up from cwd
// ---------------------------------------------------------------------------

function findAgentctx(startDir) {
  let dir = resolve(startDir);
  // Walk up at most 10 levels
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, ".agentctx");
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, "..");
    if (parent === dir) break; // filesystem root
    dir = parent;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  // Read stdin (the Stop hook payload)
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.stderr.write("harvest-session: invalid JSON on stdin\n");
    process.exit(1);
  }

  const transcriptPath = payload.transcript_path;
  const cwd = payload.cwd ?? process.cwd();

  if (!transcriptPath) {
    process.stderr.write("harvest-session: no transcript_path in payload\n");
    process.exit(1);
  }

  if (!existsSync(transcriptPath)) {
    // Transcript may not be flushed yet; silently exit
    process.exit(0);
  }

  // Find .agentctx/ — if none, this project isn't using mind-ontology; skip silently
  const agentctxDir = findAgentctx(cwd);
  if (!agentctxDir) {
    process.exit(0);
  }

  // Parse → classify → write
  let parsed;
  try {
    parsed = parseClaudeSession(transcriptPath);
  } catch (err) {
    process.stderr.write(`harvest-session: parse error — ${err.message}\n`);
    process.exit(1);
  }

  const { source, candidates } = parsed;
  const entries = classifyCandidates(candidates);

  if (entries.length === 0) {
    process.stdout.write(`harvest-session: 0 entries from ${transcriptPath} (nothing durable found)\n`);
    process.exit(0);
  }

  try {
    recordSource(agentctxDir, source);
    const results = writeEntries(agentctxDir, entries, source.label);
    const written = results.filter(r => r.written).length;
    const dups = results.filter(r => r.duplicate).length;
    process.stdout.write(
      `harvest-session: ${written} written, ${dups} duplicates from ${transcriptPath}\n`,
    );
  } catch (err) {
    process.stderr.write(`harvest-session: write error — ${err.message}\n`);
    process.exit(1);
  }
}

run();
