#!/usr/bin/env node

/**
 * mind-ontology cq — per-CQ answerability report.
 *
 * Implements ADL W8 of the Workbench v1 design packet against
 * docs/workbench-w2-cli-spec.md §6: for each competency question in
 * .agentctx/cq.md, compile a pack using the rendered question title as the
 * task and report whether the pack answers it, and from which blocks. The
 * predicate lives in cq-core.mjs (shared with `status`) and is deterministic
 * and purely structural/lexical — no language model.
 *
 * Gate strength (W2 §6 ratified amendment): an unanswered CQ on a required
 * topic (#context / #safety) exits 1; every other unanswered CQ is an
 * advisory UNANSWERED line that does not fail the gate.
 *
 * Report-command stream discipline (W2 §2.3): unanswered CQs are a report on
 * stdout (exit 1 only when the gate fails); hard errors (missing cq.md, bad
 * --id, broken ontology) are one stderr line, empty stdout, exit 1.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_AGENTCTX_DIR,
  readAgentctx,
  validateAgentctxSources,
} from "./compile.mjs";
import { CQ_SOURCE_FILE, evaluateCqs, parseCqs } from "./cq-core.mjs";

export function parseCqArgv(argv = process.argv.slice(2)) {
  const parsed = { id: null, format: "text", cwd: process.cwd(), help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--id") {
      // Range validation happens in runCq, where N is known (the W2 §10
      // message names the valid range).
      parsed.id = argv[++i] ?? "";
    } else if (arg === "--format") {
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
      throw new Error(`Unknown argument: ${arg}. Run "mind-ontology cq --help" for the list of options.`);
    }
  }
  return parsed;
}

export function renderCqText(verdict) {
  const lines = [];
  for (const cq of verdict.cqs) {
    if (cq.answered) {
      lines.push(`ANSWERED    ${cq.id}. ${cq.question}`);
      lines.push(
        `              answered by: ${cq.answered_by
          .map((b) => `${b.sourceFile} / ${b.heading}`)
          .join(", ")}`,
      );
    } else {
      lines.push(
        `UNANSWERED  ${cq.id}. ${cq.question} (${cq.required ? "required" : "advisory"})`,
      );
    }
  }
  lines.push("");
  const requiredUnanswered = verdict.cqs.filter((cq) => !cq.answered && cq.required).length;
  lines.push(
    verdict.ok
      ? `OK - ${verdict.answered} of ${verdict.total} CQ(s) answered`
      : `FAIL - ${requiredUnanswered} required CQ(s) unanswered (${verdict.answered} of ${verdict.total} answered)`,
  );
  return lines.join("\n") + "\n";
}

export function renderCqJson(verdict) {
  return (
    JSON.stringify(
      {
        ok: verdict.ok,
        total: verdict.total,
        answered: verdict.answered,
        cqs: verdict.cqs,
      },
      null,
      2,
    ) + "\n"
  );
}

export function runCq(options) {
  validateAgentctxSources(options.cwd);
  if (!existsSync(resolve(options.cwd, DEFAULT_AGENTCTX_DIR, CQ_SOURCE_FILE))) {
    throw new Error(
      "Missing .agentctx/cq.md. Add competency questions (see the cq schema) before running cq.",
    );
  }
  const sources = readAgentctx(options.cwd);
  const total = parseCqs(sources).length;

  let id = null;
  if (options.id !== null) {
    const n = Number(options.id);
    if (!Number.isInteger(n) || n < 1 || n > total) {
      throw new Error(
        `--id must be between 1 and ${total}, got: ${options.id}. Run "mind-ontology cq --cwd <path>" without --id to list the questions and their ids.`,
      );
    }
    id = n;
  }

  const verdict = evaluateCqs(sources, { id });
  return {
    exitCode: verdict.ok ? 0 : 1,
    stdout: options.format === "json" ? renderCqJson(verdict) : renderCqText(verdict),
  };
}

function printHelp() {
  return `mind-ontology cq — competency-question answerability report

Usage:
  mind-ontology cq [options]

Options:
  --id <n>            Restrict the run and the verdict to one CQ (1-based
                      source order; ids renumber when cq.md is reordered).
  --format text|json  Output format (default: text).
  --cwd <path>        Directory containing .agentctx/ (default: cwd).
  -h, --help          Show this help message.

For each CQ in .agentctx/cq.md the question title is compiled as a task and
the pack is checked structurally for an answering block (a scored match, or a
block sharing one of the CQ's topic tags — never a cq.md block itself).
Unanswered CQs on required topics (#context / #safety) fail the gate (exit 1);
other unanswered CQs are advisory lines. Missing cq.md is a hard error — use
status for an aggregate view that tolerates its absence.
`;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const options = parseCqArgv();
    if (options.help) {
      process.stdout.write(printHelp());
      process.exit(0);
    }
    const result = runCq(options);
    process.stdout.write(result.stdout);
    process.exit(result.exitCode);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
