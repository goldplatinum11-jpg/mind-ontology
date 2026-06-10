#!/usr/bin/env node

/**
 * mind-ontology review — Result Pack shape verdict for the controller.
 *
 * Implements ADL W9 of the Workbench v1 design packet against
 * docs/workbench-w2-cli-spec.md §9: validates a worker Result Pack against
 * the five invariants in result-pack.mjs (the same module the shape guard
 * test runs), prints the guard tests to re-run, and echoes the controller
 * checklist with an honest verdict column — `machine` only for what shape
 * validation actually covered.
 *
 * Per the operator's packet ruling (Q8): v1 validates shape only and PRINTS
 * the guard-test commands; it does not run them.
 *
 * Report-command stream discipline (W2 §2.3): shape violations are a report
 * on stdout, exit 1. Hard errors (missing --pack, unreadable path, invalid
 * JSON) are one stderr line, empty stdout, exit 1. `review` takes no --cwd:
 * its one input is the explicit --pack path (W2 §2.1).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONTROLLER_CHECKLIST,
  INVARIANTS,
  guardTestsOf,
  validateResultPack,
} from "./result-pack.mjs";

export function parseReviewArgv(argv = process.argv.slice(2)) {
  const parsed = { pack: null, format: "text", help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--pack") {
      parsed.pack = argv[++i] ?? "";
    } else if (arg === "--format") {
      const f = argv[++i] ?? "";
      if (f !== "text" && f !== "json") {
        throw new Error(`--format must be "text" or "json", got: ${f}`);
      }
      parsed.format = f;
    } else if (arg === "-h" || arg === "--help") {
      parsed.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

export function loadResultPack(path) {
  let raw;
  try {
    raw = readFileSync(resolve(path), "utf8");
  } catch {
    throw new Error(`Cannot read Result Pack: ${path}`);
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Result Pack is not valid JSON: ${path}`);
  }
}

export function reviewPack(pack) {
  const { ok, violations } = validateResultPack(pack);
  return {
    ok,
    schema: typeof pack.schema === "string" ? pack.schema : null,
    lane: typeof pack.lane === "string" ? pack.lane : null,
    violations,
    guard_tests: guardTestsOf(pack),
    checklist: CONTROLLER_CHECKLIST.map(({ item, title, verdict }) => ({ item, title, verdict })),
  };
}

export function renderReviewText(review, packPath) {
  const lines = [`Result Pack review - ${packPath}`, ""];

  for (const { invariant, title } of INVARIANTS) {
    const failures = review.violations.filter((v) => v.invariant === invariant);
    if (failures.length === 0) {
      lines.push(`PASS  ${invariant}. ${title}`);
    } else {
      for (const failure of failures) {
        lines.push(`FAIL  ${invariant}. ${title} - ${failure.message}`);
      }
    }
  }

  lines.push("");
  if (review.guard_tests.length > 0) {
    lines.push("Guard tests to re-run (proof, not prose):");
    for (const test of review.guard_tests) {
      lines.push(`  npx vitest run ${test}`);
    }
  } else {
    lines.push("Guard tests to re-run: none named by the pack.");
  }

  lines.push("");
  lines.push("Controller checklist (machine = covered by shape validation; manual = your call):");
  for (const { item, title, verdict } of review.checklist) {
    lines.push(`  ${verdict.padEnd(8)} ${item}. ${title}`);
  }

  lines.push("");
  lines.push(
    review.ok
      ? "OK - pack valid; the manual checklist items remain the controller's call"
      : `INVALID - ${review.violations.length} violation(s); send back to the worker with the failed invariant(s)`,
  );
  return lines.join("\n") + "\n";
}

export function renderReviewJson(review) {
  return JSON.stringify(review, null, 2) + "\n";
}

function printHelp() {
  return `mind-ontology review — validate a worker Result Pack (shape only)

Usage:
  mind-ontology review --pack <path> [options]

Options:
  --pack <path>       Required. Path to the Result Pack JSON file (resolved
                      against the process cwd; review reads nothing else).
  --format text|json  Output format (default: text).
  -h, --help          Show this help message.

Checks the five shape invariants (required keys & types; no forbidden-scope
write admitted; no hosted leakage; non-empty adls_completed each naming a
guard test; self-consistent stop state), prints the named guard tests as
ready-to-paste commands, and echoes the controller checklist marking what
shape validation covered (machine) versus what stays the human's call
(manual). v1 prints the guard-test commands; it does not run them.
Exit 0 only when every invariant passes.
`;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const options = parseReviewArgv();
    if (options.help) {
      process.stdout.write(printHelp());
      process.exit(0);
    }
    if (!options.pack) {
      throw new Error("Missing required --pack argument");
    }
    const pack = loadResultPack(options.pack);
    const review = reviewPack(pack);
    process.stdout.write(
      options.format === "json" ? renderReviewJson(review) : renderReviewText(review, options.pack),
    );
    process.exit(review.ok ? 0 : 1);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
