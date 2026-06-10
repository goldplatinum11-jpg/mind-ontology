#!/usr/bin/env node

/**
 * mind-ontology preview — the pack an agent would see, with provenance.
 *
 * Implements ADL W6 of the Workbench v1 design packet against
 * docs/workbench-w2-cli-spec.md §5: preview is `compile` plus the W5
 * explain data, rendered for a human. Flag names, value sets, validation,
 * and error messages for --task / --scope / --risk / --cwd are identical to
 * compile's; --format takes the Workbench `text|json` vocabulary instead of
 * compile's `markdown|json` (W2 §2.1).
 *
 * Result-command stream discipline (W2 §2.3): the result goes to stdout only
 * on success; failures are one stderr line, exit 1, empty stdout.
 */

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  DEFAULT_RISK_MODE,
  RISK_MODES,
  compileContext,
  explainBlock,
  readAgentctx,
  renderContextPackJson,
  validateAgentctxSources,
} from "./compile.mjs";

export function parsePreviewArgv(argv = process.argv.slice(2)) {
  const parsed = {
    task: "",
    scopes: [],
    riskMode: DEFAULT_RISK_MODE,
    format: "text",
    cwd: process.cwd(),
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--task") {
      parsed.task = argv[++i] ?? "";
    } else if (arg === "--scope") {
      parsed.scopes.push(
        ...String(argv[++i] ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
    } else if (arg === "--risk") {
      const m = argv[++i] ?? "";
      if (!RISK_MODES.has(m)) {
        throw new Error(`--risk must be "auto", "safe", or "risky", got: ${m}`);
      }
      parsed.riskMode = m;
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
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function renderRisk(risk) {
  if (risk.mode !== "auto") return `${risk.level} (--risk ${risk.mode})`;
  return risk.signals.length > 0
    ? `${risk.level} (auto: ${risk.signals.join(", ")})`
    : `${risk.level} (auto)`;
}

function renderMarker(tuple) {
  if (tuple.reason === "scored") return `[scored ${tuple.score}]`;
  return `[${tuple.reason}]`;
}

/**
 * Deterministic human rendering (no timestamp — unlike the compile pack, a
 * preview is a screen, not a serialized artifact). Bytes are frozen by the
 * W6 snapshot test; machine consumers use --format json.
 */
export function renderPreviewText(pack) {
  const lines = [
    `Pack preview - task: "${pack.task}" | risk: ${renderRisk(pack.risk)} | scopes: ${
      pack.scopes.length > 0 ? pack.scopes.join(", ") : "(none)"
    }`,
  ];

  for (const file of pack.sourceFiles) {
    const blocks = pack.selected.filter((b) => b.file === file);
    if (blocks.length === 0) continue;
    lines.push("");
    lines.push(`.agentctx/${file}`);
    for (const block of blocks) {
      const tuple = explainBlock(block);
      lines.push(`  * ${tuple.heading}  ${renderMarker(tuple)}`);
    }
  }

  return lines.join("\n") + "\n";
}

export function runPreview(options) {
  validateAgentctxSources(options.cwd);
  const sources = readAgentctx(options.cwd);
  const pack = compileContext({
    sources,
    task: options.task,
    scopes: options.scopes,
    riskMode: options.riskMode,
  });
  return options.format === "json"
    ? renderContextPackJson(pack, { explain: true })
    : renderPreviewText(pack);
}

function printHelp() {
  return `mind-ontology preview — the pack an agent would see, with per-block provenance

Usage:
  mind-ontology preview --task "Fix OAuth bug" [options]

Options:
  --task <text>           Required. Task description to preview context for.
  --scope <csv>           Explicit scopes (comma-separated). Repeatable.
  --risk auto|safe|risky  Task-risk mode, same semantics as compile. Default: ${DEFAULT_RISK_MODE}.
  --format text|json      Output format (default: text). json is the compile
                          --format json object plus per-block explain data.
  --cwd <path>            Directory containing .agentctx/ (default: cwd).
  -h, --help              Show this help message.

Each selected block shows its source file, heading, and inclusion reason
(constraint | scored | risk-forced); risk-forced blocks are flagged so a risky
task's safety sweep is visible. The text rendering is for humans — machine
consumers should use --format json, or compile itself for the byte-stable pack.
`;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const options = parsePreviewArgv();
    if (options.help) {
      process.stdout.write(printHelp());
      process.exit(0);
    }
    if (!options.task) {
      throw new Error("Missing required --task argument");
    }
    process.stdout.write(runPreview(options));
    process.exit(0);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
