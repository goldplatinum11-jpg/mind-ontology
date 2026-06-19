#!/usr/bin/env node
// Build a deploy-time snapshot of a project's .agentctx/ sources.
//
// The hosted Worker has no filesystem, so it serves a bundled JSON snapshot
// instead of reading .agentctx/ directly. Run this in Node (which DOES have a
// filesystem) before bundling/deploying the Worker:
//
//   node connector/worker/scripts/build-agentctx-snapshot.mjs \
//        --cwd <project-with-.agentctx> --out connector/worker/agentctx.snapshot.json
//
// It reuses the engine's readAgentctx so the snapshot is exactly what the local
// stdio server would read — no second reader. PR1 ships only the EXAMPLE
// snapshot; an operator regenerates a real one for their own workspace.

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { readAgentctx } from "../../../scripts/agentctx/compile.mjs";
import { buildSnapshot } from "../lib/source-snapshot.mjs";

function parseArgs(argv) {
  let cwd = process.cwd();
  let out = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--cwd") cwd = argv[++i];
    else if (arg === "--out") out = argv[++i];
    else throw new Error(`Unknown argument: ${arg}. Usage: --cwd <dir> --out <file>`);
  }
  if (!out) throw new Error('Missing required --out <file>. Run with --cwd <dir> --out <snapshot.json>.');
  return { cwd, out };
}

function main() {
  const { cwd, out } = parseArgs(process.argv.slice(2));
  const sources = readAgentctx(resolve(cwd));
  const snapshot = buildSnapshot(sources);
  writeFileSync(out, JSON.stringify(snapshot, null, 2) + "\n");
  const nonEmpty = Object.values(snapshot.sources).filter((c) => c.trim()).length;
  console.log(
    `WROTE ${out} — ${Object.keys(snapshot.sources).length} source slots (${nonEmpty} non-empty) from ${resolve(cwd, ".agentctx")}`,
  );
}

main();
