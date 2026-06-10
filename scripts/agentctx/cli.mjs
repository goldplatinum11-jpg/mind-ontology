#!/usr/bin/env node

/**
 * mind-ontology — product-facing CLI wrapper.
 *
 * A thin dispatcher over the existing scripts/agentctx/* entry points. It owns
 * NO domain logic: each subcommand spawns the same script the matching
 * `agentctx:*` npm script already runs, forwarding argv verbatim and
 * propagating stdout/stderr and the exit code. This keeps every existing
 * `npm run agentctx:*` command and its behavior intact (backward compatible)
 * while giving the package a single, discoverable `bin` for local/private use.
 *
 *   mind-ontology compile  --task "..."   ->  scripts/agentctx/compile.mjs compile ...
 *   mind-ontology init                    ->  scripts/agentctx/init.mjs ...
 *   mind-ontology validate                ->  scripts/agentctx/schema.mjs ...
 *   mind-ontology metrics  --task "..."   ->  scripts/agentctx/metrics.mjs ...
 *   mind-ontology mcp                     ->  scripts/agentctx/mcp-server.mjs
 *   mind-ontology smoke                   ->  scripts/agentctx/acceptance-smoke.mjs
 *
 * Operator (Workbench) commands are born inside the wrapper and have no npm
 * alias by design (W2 §11: the agentctx:* namespace is frozen back-compat,
 * not a growth surface):
 *
 *   mind-ontology emit [--check]          ->  scripts/agentctx/emit.mjs ...
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PKG_PATH = resolve(SCRIPT_DIR, "../../package.json");

export const CLI_NAME = "mind-ontology";

// Subcommand -> the sibling script it delegates to. `prefix` is forwarded ahead
// of the user's args (compile.mjs reads a leading positional command token,
// mirroring `npm run agentctx:compile` => `node compile.mjs compile`). The
// `npmScript` field documents the backward-compatible alias each one wraps;
// operator commands set it to null — they predate nothing and the wrapper is
// their only spelling. `group` drives the two help-text headings (W2 §11).
export const COMMANDS = {
  compile: {
    script: "compile.mjs",
    prefix: ["compile"],
    npmScript: "agentctx:compile",
    group: "engine",
    summary: "Compile a task-scoped context pack from .agentctx/ sources.",
  },
  init: {
    script: "init.mjs",
    prefix: [],
    npmScript: "agentctx:init",
    group: "engine",
    summary: "Scaffold a starter .agentctx/ template into a project.",
  },
  validate: {
    script: "schema.mjs",
    prefix: [],
    npmScript: "agentctx:validate",
    group: "engine",
    summary: "Validate .agentctx/ sources against the ontology schema.",
  },
  metrics: {
    script: "metrics.mjs",
    prefix: [],
    npmScript: "agentctx:metrics",
    group: "engine",
    summary: "Report context-quality metrics for a compiled pack.",
  },
  mcp: {
    script: "mcp-server.mjs",
    prefix: [],
    npmScript: "agentctx:mcp",
    group: "engine",
    summary: "Run the agentctx MCP server (stdio JSON-RPC).",
  },
  smoke: {
    script: "acceptance-smoke.mjs",
    prefix: [],
    npmScript: "agentctx:smoke",
    group: "engine",
    summary: "Run the acceptance smoke checks.",
  },
  status: {
    script: "status.mjs",
    prefix: [],
    npmScript: null,
    group: "operator",
    summary: "One health roll-up: validate, metrics, CQ answerability, emit freshness.",
  },
  preview: {
    script: "preview.mjs",
    prefix: [],
    npmScript: null,
    group: "operator",
    summary: "Preview the pack an agent would see, with per-block provenance.",
  },
  cq: {
    script: "cq.mjs",
    prefix: [],
    npmScript: null,
    group: "operator",
    summary: "Report per-CQ answerability with the contributing blocks.",
  },
  emit: {
    script: "emit.mjs",
    prefix: [],
    npmScript: null,
    group: "operator",
    summary: "Emit static per-tool artifacts (AGENTS.md, CLAUDE.md) from .agentctx/.",
  },
  review: {
    script: "review.mjs",
    prefix: [],
    npmScript: null,
    group: "operator",
    summary: "Validate a worker Result Pack against its shape invariants.",
  },
};

const HELP_FLAGS = new Set(["help", "--help", "-h"]);
const VERSION_FLAGS = new Set(["--version", "-v"]);

export function readVersion() {
  try {
    const pkg = JSON.parse(readFileSync(PKG_PATH, "utf8"));
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export function buildHelp() {
  const rowsFor = (group) =>
    Object.entries(COMMANDS)
      .filter(([, spec]) => spec.group === group)
      .map(([name, spec]) => `  ${name.padEnd(10)} ${spec.summary}`);
  return `${CLI_NAME} — context compiler & MCP adapter for agent ontologies.

Usage:
  ${CLI_NAME} <command> [options]

Engine commands:
${rowsFor("engine").join("\n")}

Operator commands:
${rowsFor("operator").join("\n")}

Other:
  --help, -h        Show this help message.
  --version, -v     Print the package version.

Each command forwards its options to the underlying engine. Run a command with
--help for its own options, e.g. "${CLI_NAME} compile --help".

Backward compatibility: every engine command also remains available as its
original npm script (compile -> agentctx:compile, init -> agentctx:init,
validate -> agentctx:validate, metrics -> agentctx:metrics, mcp -> agentctx:mcp,
smoke -> agentctx:smoke). This wrapper adds no behavior of its own. Operator
commands have no npm alias; "${CLI_NAME} <command>" is their only spelling.
`;
}

export function unknownCommandMessage(name) {
  const known = Object.keys(COMMANDS).join(", ");
  return `Unknown command: ${name}\nRun "${CLI_NAME} --help" for the list of commands (${known}).`;
}

/**
 * Pure planner: turn argv into an action with no side effects, so it is fully
 * unit-testable. The entry point below executes the plan.
 */
export function planInvocation(argv) {
  const first = argv[0];

  if (first === undefined || HELP_FLAGS.has(first)) {
    return { kind: "help" };
  }
  if (VERSION_FLAGS.has(first)) {
    return { kind: "version" };
  }
  if (first.startsWith("-")) {
    return { kind: "error", message: unknownCommandMessage(first) };
  }

  const spec = COMMANDS[first];
  if (!spec) {
    return { kind: "error", message: unknownCommandMessage(first) };
  }

  return {
    kind: "spawn",
    command: first,
    script: spec.script,
    scriptPath: resolve(SCRIPT_DIR, spec.script),
    args: [...spec.prefix, ...argv.slice(1)],
  };
}

function run(argv) {
  const plan = planInvocation(argv);

  switch (plan.kind) {
    case "help":
      process.stdout.write(buildHelp());
      return 0;
    case "version":
      process.stdout.write(`${readVersion()}\n`);
      return 0;
    case "error":
      process.stderr.write(`${plan.message}\n`);
      return 1;
    case "spawn": {
      const result = spawnSync(
        process.execPath,
        [plan.scriptPath, ...plan.args],
        { stdio: "inherit" },
      );
      if (result.error) {
        process.stderr.write(`Failed to run "${plan.command}": ${result.error.message}\n`);
        return 1;
      }
      return result.status ?? 0;
    }
    default:
      process.stderr.write(`Internal error: unhandled plan ${plan.kind}\n`);
      return 1;
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  process.exit(run(process.argv.slice(2)));
}
