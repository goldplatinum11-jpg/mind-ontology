#!/usr/bin/env node

// Mind Ontology context quality metrics (Phase 2 / P2-PR08).
//
// The product promise is "the smallest context pack that still covers the
// task." These metrics make that measurable: how focused a compiled pack is
// (selection ratio, body compression), whether the task actually matched
// anything, and whether each requested scope was covered.
//
// computeContextMetrics() works on the rich pack from compileContext (which
// carries both selected and omitted block bodies).

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_MAX_BLOCKS_PER_FILE,
  DEFAULT_MIN_SCORE,
  compileContext,
  readAgentctx,
  validateAgentctxSources,
} from "./compile.mjs";

function round(n, places = 3) {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

function bodyBytes(blocks) {
  return blocks.reduce((sum, block) => sum + block.body.length, 0);
}

/**
 * Compute context-quality metrics from a compiled pack.
 * @param {object} pack result of compileContext (selected[] + omitted[]).
 */
export function computeContextMetrics(pack) {
  const selected = pack.selected ?? [];
  const omitted = pack.omitted ?? [];
  const totalBlocks = selected.length + omitted.length;
  const selectedBytes = bodyBytes(selected);
  const totalBytes = selectedBytes + bodyBytes(omitted);

  const matched = selected.filter((block) => block.reason === "matched");
  const always = selected.filter((block) => block.reason === "always");

  const scopes = pack.scopes ?? [];
  const scopeCoverage = scopes.map((scope) => ({
    scope,
    covered: selected.some((block) => block.tags.includes(String(scope).toLowerCase())),
  }));

  return {
    task: pack.task ?? "",
    scopes,
    selectedBlocks: selected.length,
    omittedBlocks: omitted.length,
    totalBlocks,
    // Lower is more focused: fraction of all blocks that made the pack.
    selectionRatio: round(totalBlocks > 0 ? selected.length / totalBlocks : 0),
    selectedBodyBytes: selectedBytes,
    totalBodyBytes: totalBytes,
    // Lower is more compression: fraction of all body bytes delivered.
    bodyRatio: round(totalBytes > 0 ? selectedBytes / totalBytes : 0),
    alwaysBlocks: always.length,
    matchedBlocks: matched.length,
    // Did the task/scope surface anything beyond the always-included constraints?
    taskMatched: matched.length > 0,
    scopeCoverage,
    scopesRequested: scopes.length,
    scopesCovered: scopeCoverage.filter((entry) => entry.covered).length,
  };
}

/**
 * Compile a project's pack and return its metrics.
 */
export function metricsFromCwd(options) {
  validateAgentctxSources(options.cwd);
  const sources = readAgentctx(options.cwd);
  const pack = compileContext({
    sources,
    task: options.task,
    scopes: options.scopes ?? [],
    maxBlocksPerFile: options.maxBlocksPerFile ?? DEFAULT_MAX_BLOCKS_PER_FILE,
    minScore: options.minScore ?? DEFAULT_MIN_SCORE,
  });
  return computeContextMetrics(pack);
}

export function renderMetrics(metrics) {
  const pct = (n) => `${round(n * 100, 1)}%`;
  const lines = [
    "Mind Ontology context quality metrics",
    "",
    `Task: ${metrics.task || "(none)"}`,
    `Scopes: ${metrics.scopes.length > 0 ? metrics.scopes.join(", ") : "(none)"}`,
    "",
    `  Blocks selected:    ${metrics.selectedBlocks} / ${metrics.totalBlocks} (selection ratio ${pct(metrics.selectionRatio)})`,
    `  Body delivered:     ${metrics.selectedBodyBytes} / ${metrics.totalBodyBytes} bytes (body ratio ${pct(metrics.bodyRatio)})`,
    `  Always-included:    ${metrics.alwaysBlocks}`,
    `  Task-matched:       ${metrics.matchedBlocks} (${metrics.taskMatched ? "matched" : "no match beyond constraints"})`,
    `  Scopes covered:     ${metrics.scopesCovered} / ${metrics.scopesRequested}`,
    "",
  ];
  return lines.join("\n");
}

function parseArgs(argv) {
  const out = { cwd: process.cwd(), task: "", scopes: [], format: "text" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--cwd") out.cwd = resolve(argv[++i] ?? out.cwd);
    else if (arg === "--task") out.task = argv[++i] ?? "";
    else if (arg === "--scope") {
      out.scopes.push(
        ...String(argv[++i] ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
    } else if (arg === "--format") out.format = argv[++i] ?? "text";
  }
  return out;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (!options.task) throw new Error("Missing required --task argument");
    const metrics = metricsFromCwd(options);
    process.stdout.write(
      options.format === "json"
        ? `${JSON.stringify(metrics, null, 2)}\n`
        : renderMetrics(metrics),
    );
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
