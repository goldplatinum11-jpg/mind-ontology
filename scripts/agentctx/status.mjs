#!/usr/bin/env node

/**
 * mind-ontology status — one health roll-up for the ontology.
 *
 * Implements ADL W7 of the Workbench v1 design packet against
 * docs/workbench-w2-cli-spec.md §4. Four sections, each sourced verbatim from
 * its engine module — no re-derived logic:
 *
 *   validate — schema.mjs validateOntology()
 *   metrics  — metrics.mjs computeContextMetrics() over the representative
 *              tasks (the CQ question titles, operator ruling W2 §14.4)
 *   cq       — the cq answerability core (cq-core.mjs, gate per the W2 §6
 *              ratified amendment: required topics only)
 *   emit     — the emit --check core, result embedded verbatim (W1 §8:
 *              the emitted headers are the manifest)
 *
 * Report-command stream discipline (W2 §2.3): a negative verdict is a report
 * on stdout with exit 1; a hard error (broken ontology) is one stderr line,
 * empty stdout, exit 1 — no partial report.
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compileContext,
  readAgentctx,
  validateAgentctxSources,
} from "./compile.mjs";
import { evaluateCqs, parseCqs } from "./cq-core.mjs";
import { V1_TARGET_IDS, checkResultJson, checkTargets, renderCheckText } from "./emit.mjs";
import { computeContextMetrics } from "./metrics.mjs";
import { validateOntology } from "./schema.mjs";

// One-line degradation reason (W2 §4): a minimal ontology without cq.md is
// valid and must show green, so the cq-dependent sections skip instead of
// failing.
export const CQ_SKIP_REASON =
  ".agentctx/cq.md has no competency questions; add them (see the cq schema) to enable this section";

/**
 * Build the status report as data. The JSON shape is locked by the W7 guard
 * test; `sections.emit` is byte-for-byte the `emit --check --format json`
 * payload (one shape, two consumers).
 */
export function buildStatus(cwd) {
  validateAgentctxSources(cwd);
  const sources = readAgentctx(cwd);

  const report = validateOntology(cwd);
  const validate = { ok: report.ok, errors: report.errors, warnings: report.warnings };

  const cqDefs = parseCqs(sources);
  let metrics;
  let cq;
  if (cqDefs.length === 0) {
    metrics = { ok: true, skipped: true, reason: CQ_SKIP_REASON };
    cq = { ok: true, skipped: true, reason: CQ_SKIP_REASON };
  } else {
    metrics = {
      ok: true,
      tasks: cqDefs.map((def) => {
        const m = computeContextMetrics(compileContext({ sources, task: def.question }));
        return {
          task: def.question,
          selectedBlocks: m.selectedBlocks,
          omittedBlocks: m.omittedBlocks,
          selectionRatio: m.selectionRatio,
          taskMatched: m.taskMatched,
        };
      }),
    };
    const verdict = evaluateCqs(sources);
    cq = {
      ok: verdict.ok,
      total: verdict.total,
      answered: verdict.answered,
      unanswered: verdict.cqs
        .filter((c) => !c.answered)
        .map((c) => ({ question: c.question, required: c.required })),
    };
  }

  const checkResults = checkTargets({ cwd, targets: V1_TARGET_IDS, sources });
  const emit = checkResultJson(checkResults);

  const sections = { validate, metrics, cq, emit };
  const ok = Object.values(sections).every((s) => s.ok);
  return { ok, sections, checkResults };
}

export function renderStatusText(status) {
  const { validate, metrics, cq, emit } = status.sections;
  const lines = ["Mind Ontology status", ""];

  lines.push(
    `validate: ${validate.ok ? "OK" : "FAIL"} - ${validate.errors} error(s), ${validate.warnings} warning(s)`,
  );

  if (metrics.skipped) {
    lines.push(`metrics: SKIPPED - ${metrics.reason}`);
  } else {
    const matched = metrics.tasks.filter((t) => t.taskMatched).length;
    lines.push(
      `metrics: OK - ${metrics.tasks.length} representative task(s) compiled from cq.md question titles (${matched} matched beyond constraints)`,
    );
  }

  if (cq.skipped) {
    lines.push(`cq: SKIPPED - ${cq.reason}`);
  } else {
    lines.push(`cq: ${cq.ok ? "OK" : "FAIL"} - ${cq.answered} of ${cq.total} CQ(s) answered`);
    for (const u of cq.unanswered) {
      lines.push(`  UNANSWERED${u.required ? " (required)" : ""}  ${u.question}`);
    }
  }

  // The emit line is exactly the check core's frozen summary line
  // ("OK - n of n targets fresh" / "DRIFT - n of m targets need attention");
  // on drift the per-target detail lines follow, indented, verbatim.
  const checkLines = renderCheckText(status.checkResults).trimEnd().split("\n");
  const summary = checkLines.pop();
  lines.push(`emit: ${summary}`);
  if (!emit.ok) {
    for (const line of checkLines) {
      if (!line.startsWith("OK")) lines.push(`  ${line}`);
    }
  }

  lines.push("");
  if (status.ok) {
    lines.push("OK - every section healthy");
  } else {
    const unhealthy = Object.entries(status.sections)
      .filter(([, s]) => !s.ok)
      .map(([name]) => name);
    lines.push(`UNHEALTHY - sections needing attention: ${unhealthy.join(", ")}`);
  }
  return lines.join("\n") + "\n";
}

export function renderStatusJson(status) {
  return JSON.stringify({ ok: status.ok, sections: status.sections }, null, 2) + "\n";
}

export function parseStatusArgv(argv = process.argv.slice(2)) {
  const parsed = { format: "text", cwd: process.cwd(), help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--format") {
      const f = argv[++i] ?? "";
      if (f !== "text" && f !== "json") {
        throw new Error(`--format must be "text" or "json", got: ${f}`);
      }
      parsed.format = f;
    } else if (arg === "--cwd") {
      parsed.cwd = resolve(argv[++i] ?? parsed.cwd);
    } else if (arg === "-h" || arg === "--help") {
      parsed.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function printHelp() {
  return `mind-ontology status — one health roll-up for the ontology

Usage:
  mind-ontology status [options]

Options:
  --format text|json  Output format (default: text).
  --cwd <path>        Directory containing .agentctx/ (default: cwd).
  -h, --help          Show this help message.

Sections (each sourced verbatim from its engine module):
  validate  schema validation (errors fail; warnings do not)
  metrics   pack-focus metrics for the representative tasks (the cq.md
            question titles); skipped when there are no CQs
  cq        competency-question answerability (required topics gate the
            verdict; other unanswered CQs are advisory); skipped without CQs
  emit      emitted-target freshness (the emit --check verdict, embedded)

Exit 0 when every section is healthy; 1 otherwise. A broken ontology
(missing .agentctx/, missing or empty constraints.md) is a hard error:
one stderr line, no partial report.
`;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const options = parseStatusArgv();
    if (options.help) {
      process.stdout.write(printHelp());
      process.exit(0);
    }
    const status = buildStatus(options.cwd);
    process.stdout.write(
      options.format === "json" ? renderStatusJson(status) : renderStatusText(status),
    );
    process.exit(status.ok ? 0 : 1);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
