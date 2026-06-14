#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRiskLevel } from "./risk.mjs";
import { routeOntology, scanLibrary } from "./router.mjs";

export const DEFAULT_AGENTCTX_DIR = ".agentctx";
// Tags that mark a block as safety guidance. On a risky task these blocks are
// forced into the pack regardless of relevance score.
export const SAFETY_TAGS = new Set([
  "safety",
  "destructive",
  "security",
  "secrets",
  "irreversible",
]);
export const RISK_MODES = new Set(["auto", "safe", "risky"]);
export const DEFAULT_RISK_MODE = "auto";
// Source list, in output order. constraints.md is always included; every other
// file is scored and filtered per task. Files absent from a project's
// .agentctx/ simply contribute no blocks, so expanding this list never breaks
// a minimal project that only ships constraints.md.
export const SOURCE_FILES = [
  "constraints.md",
  "identity.md",
  "direction.md",
  "projects.md",
  "decisions.md",
  "architecture.md",
  "agent-roles.md",
  "glossary.md",
  "cq.md",
];
export const ALWAYS_INCLUDE_FILES = new Set(["constraints.md"]);
export const REQUIRED_SOURCE_FILES = ["constraints.md"];
export const DEFAULT_MAX_BLOCKS_PER_FILE = 1;
export const DEFAULT_MIN_SCORE = 2;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "build",
  "but",
  "by",
  "for",
  "from",
  "how",
  "if",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

export function parseArgv(argv = process.argv.slice(2)) {
  const parsed = {
    command: "compile",
    cwd: process.cwd(),
    task: "",
    scopes: [],
    format: "markdown",
    maxBlocksPerFile: DEFAULT_MAX_BLOCKS_PER_FILE,
    minScore: DEFAULT_MIN_SCORE,
    riskMode: DEFAULT_RISK_MODE,
    explain: false,
  };

  const args = [...argv];
  if (args[0] && !args[0].startsWith("-")) {
    parsed.command = args.shift();
  }

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--task") {
      parsed.task = args[++i] ?? "";
    } else if (arg === "--scope") {
      parsed.scopes.push(...splitCsv(args[++i] ?? ""));
    } else if (arg === "--cwd") {
      parsed.cwd = resolve(args[++i] ?? parsed.cwd);
    } else if (arg === "--max-blocks-per-file") {
      const n = Number(args[++i]);
      if (Number.isInteger(n) && n > 0) parsed.maxBlocksPerFile = n;
    } else if (arg === "--min-score") {
      const n = Number(args[++i]);
      if (Number.isFinite(n) && n >= 0) parsed.minScore = n;
    } else if (arg === "--format") {
      const f = args[++i] ?? "";
      if (f !== "markdown" && f !== "json" && f !== "compact") {
        throw new Error(`--format must be "markdown", "json", or "compact", got: ${f}`);
      }
      parsed.format = f;
    } else if (arg === "--risk") {
      const m = args[++i] ?? "";
      if (!RISK_MODES.has(m)) {
        throw new Error(`--risk must be "auto", "safe", or "risky", got: ${m}`);
      }
      parsed.riskMode = m;
    } else if (arg === "--explain") {
      parsed.explain = true;
    } else if (arg === "--rich-scoring") {
      parsed.richScoring = true;
    } else if (arg === "--max-tokens") {
      const raw = args[++i];
      const n = Number(raw);
      if (!Number.isInteger(n) || n <= 0) {
        throw new Error(`--max-tokens must be a positive integer, got: ${raw ?? ""}`);
      }
      parsed.maxTokens = n;
    } else if (arg === "--library") {
      const dir = args[++i];
      if (!dir || dir.startsWith("--")) {
        throw new Error("--library requires a directory path");
      }
      parsed.library = dir;
    } else if (arg === "-h" || arg === "--help") {
      parsed.command = "help";
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

export function tokenize(input) {
  return Array.from(
    new Set(
      String(input)
        .toLowerCase()
        .replace(/[`"'()[\]{}:;,.!?/\\|]+/g, " ")
        .split(/\s+/)
        .map((word) => word.trim())
        .filter((word) => word.length >= 3 && !STOP_WORDS.has(word)),
    ),
  );
}

export function parseMarkdownBlocks(markdown, file) {
  const lines = String(markdown).replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let current = {
    file,
    title: "Preamble",
    heading: "",
    tags: [],
    bodyLines: [],
    index: 0,
  };

  const pushCurrent = () => {
    const body = current.bodyLines.join("\n").trim();
    if (!body && !current.heading) return;
    blocks.push({
      file: current.file,
      title: current.title,
      heading: current.heading,
      tags: current.tags,
      body,
      index: current.index,
    });
  };

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      pushCurrent();
      const rawTitle = heading[1].trim();
      const tags = Array.from(rawTitle.matchAll(/#([A-Za-z0-9_-]+)/g)).map((m) =>
        m[1].toLowerCase()
      );
      const title = rawTitle.replace(/\s+#[A-Za-z0-9_-]+/g, "").trim();
      current = {
        file,
        title,
        heading: rawTitle,
        tags,
        bodyLines: [],
        index: blocks.length,
      };
    } else if (!line.startsWith("# ")) {
      current.bodyLines.push(line);
    }
  }

  pushCurrent();
  return blocks;
}

export function readAgentctx(cwd = process.cwd()) {
  const dir = resolve(cwd, DEFAULT_AGENTCTX_DIR);
  const sources = {};

  for (const file of SOURCE_FILES) {
    const path = resolve(dir, file);
    sources[file] = existsSync(path) ? readFileSync(path, "utf8") : "";
  }

  return sources;
}

export function validateAgentctxSources(cwd = process.cwd()) {
  const dir = resolve(cwd, DEFAULT_AGENTCTX_DIR);

  if (!existsSync(dir)) {
    throw new Error(
      `Missing ${DEFAULT_AGENTCTX_DIR}/ in ${cwd}. Run "npm run agentctx:init -- --cwd ${JSON.stringify(cwd)}" to scaffold starter files.`,
    );
  }

  for (const file of REQUIRED_SOURCE_FILES) {
    const path = resolve(dir, file);
    if (!existsSync(path)) {
      throw new Error(
        `Missing required Mind Ontology source: ${DEFAULT_AGENTCTX_DIR}/${file}. Run "npm run agentctx:init -- --cwd ${JSON.stringify(cwd)}" or add the file manually.`,
      );
    }

    if (!readFileSync(path, "utf8").trim()) {
      throw new Error(
        `Required Mind Ontology source is empty: ${DEFAULT_AGENTCTX_DIR}/${file}. Add at least one ## constraint block before compiling.`,
      );
    }
  }

  return { dir, required: REQUIRED_SOURCE_FILES };
}

export function scoreBlock(block, taskTokens, scopes = [], opts = {}) {
  const scopeSet = new Set(scopes.map((scope) => scope.toLowerCase()));
  const headingTokens = tokenize(`${block.title} ${block.tags.join(" ")}`);
  const bodyTokens = tokenize(block.body);
  let score = 0;

  for (const scope of scopeSet) {
    if (block.tags.includes(scope)) score += 8;
    if (headingTokens.includes(scope)) score += 5;
    if (bodyTokens.includes(scope)) score += 2;
  }

  for (const token of taskTokens) {
    if (block.tags.includes(token)) score += 6;
    if (headingTokens.includes(token)) score += 4;
    if (bodyTokens.includes(token)) score += 1;
  }

  // Opt-in richer scoring (default OFF → identical to the legacy score above, so
  // the minimal/safe-task behavior stays byte-for-byte). When enabled, a heading
  // hit is treated as a stronger relevance signal than a body hit: matching the
  // block's title/tags earns an extra boost so the block that *names* the topic
  // breaks ties over one that only mentions it in passing. (Recency was scoped
  // out: blocks carry no reliable per-block date signal to rank on.)
  if (opts.richScoring) {
    for (const scope of scopeSet) {
      if (headingTokens.includes(scope)) score += 3;
    }
    for (const token of taskTokens) {
      if (headingTokens.includes(token)) score += 2;
    }
  }

  return score;
}

// Dependency-free token estimate. ~4 chars/token is the rough GPT-family ratio;
// good enough to keep a pack inside a budget without pulling in a tokenizer.
export function estimateTokens(text) {
  return Math.ceil(String(text).length / 4);
}
// Estimate a block's cost as its compact rendering (`## file / title` + body) — the
// agent-facing context the budget is meant to bound. This is exact for `--format
// compact`; markdown/json add human-facing display overhead (headers, per-block
// Source/Reason/Tags, the Omitted list) that the budget intentionally does not count.
export function estimateBlockTokens(block) {
  return estimateTokens(`## ${block.file} / ${block.title}\n${block.body}`);
}

// Retention priority when a token budget forces a choice. constraints (always) and
// risk-forced safety blocks are mandatory (never dropped, only counted); everything
// else is ranked so the most decision-critical sources survive a tight budget.
const BUDGET_PRIORITY = {
  "cq.md": 2,
  "direction.md": 3,
  "decisions.md": 4,
  "projects.md": 5,
  "architecture.md": 6,
  "identity.md": 7,
  "agent-roles.md": 8,
  "glossary.md": 9,
};
function isSafetyBlock(block) {
  return block.tags.some((tag) => SAFETY_TAGS.has(tag));
}
function blockBudgetPriority(block, risky) {
  if (block.reason === "always") return 0;
  // On a risky task every safety block ranks with the risk-forced ones — the risk
  // mode exists to keep safety guidance, so a tight budget must not demote it.
  if (block.reason === "risk-forced" || (risky && isSafetyBlock(block))) return 1;
  return BUDGET_PRIORITY[block.file] ?? 10;
}
function isMandatoryBlock(block, risky) {
  if (block.reason === "always" || block.reason === "risk-forced") return true;
  // A safety block that surfaced on a risky task (even via normal scoring) is never
  // dropped to fit a budget; that would defeat the risk mode's safety guarantee.
  return risky && isSafetyBlock(block);
}

// Reduce `selected` to fit `maxTokens`, block-by-block (never mid-block truncation).
// Mandatory blocks are always kept; over-budget non-mandatory blocks move to omitted
// with reason "budget". If the mandatory blocks alone exceed the budget, constraints
// are still kept and overBudget is flagged (the one allowed budget overrun). Returns
// the survivors in their original selected order plus budget metadata.
export function applyTokenBudget(selected, omitted, maxTokens, risky = false) {
  const ordered = [...selected].sort((a, b) => {
    const pa = blockBudgetPriority(a, risky);
    const pb = blockBudgetPriority(b, risky);
    if (pa !== pb) return pa - pb;
    const sa = a.score === Infinity ? Number.MAX_SAFE_INTEGER : a.score;
    const sb = b.score === Infinity ? Number.MAX_SAFE_INTEGER : b.score;
    if (sb !== sa) return sb - sa;
    return a.index - b.index;
  });

  const keptRefs = new Set();
  const dropped = [];
  let used = 0;
  let overBudget = false;

  for (const block of ordered) {
    const cost = estimateBlockTokens(block);
    if (isMandatoryBlock(block, risky)) {
      keptRefs.add(block);
      used += cost;
      if (used > maxTokens) overBudget = true;
    } else if (used + cost <= maxTokens) {
      keptRefs.add(block);
      used += cost;
    } else {
      dropped.push({ ...block, reason: "budget" });
    }
  }

  return {
    selected: selected.filter((block) => keptRefs.has(block)),
    omitted: [...omitted, ...dropped],
    estimatedTokens: used,
    overBudget,
  };
}

export function compileContext({
  sources,
  task,
  scopes = [],
  maxBlocksPerFile = DEFAULT_MAX_BLOCKS_PER_FILE,
  minScore = DEFAULT_MIN_SCORE,
  riskMode = DEFAULT_RISK_MODE,
  richScoring = false,
  maxTokens = null,
  now = new Date(),
}) {
  const taskTokens = tokenize(`${task} ${scopes.join(" ")}`);
  const selected = [];
  let omitted = [];

  for (const file of SOURCE_FILES) {
    const blocks = parseMarkdownBlocks(sources[file] ?? "", file);

    if (ALWAYS_INCLUDE_FILES.has(file)) {
      selected.push(...blocks.map((block) => ({ ...block, score: Infinity, reason: "always" })));
      continue;
    }

    const scored = blocks
      .map((block) => ({ ...block, score: scoreBlock(block, taskTokens, scopes, { richScoring }) }))
      .sort((a, b) => b.score - a.score || a.index - b.index);
    const matches = scored.filter((block) => block.score >= minScore).slice(0, maxBlocksPerFile);

    selected.push(...matches.map((block) => ({ ...block, reason: "matched" })));
    omitted.push(...scored.slice(matches.length));
  }

  // Task-risk modes (P2-PR09): on a risky task, force any safety-tagged block
  // that was not already selected into the pack, regardless of its score.
  const risk = resolveRiskLevel(riskMode, task, scopes);
  if (risk.level === "risky") {
    const isSafety = (block) => block.tags.some((tag) => SAFETY_TAGS.has(tag));
    const forced = omitted.filter(isSafety).map((block) => ({ ...block, reason: "risk-forced" }));
    if (forced.length > 0) {
      selected.push(...forced);
      omitted = omitted.filter((block) => !isSafety(block));
    }
  }

  // Token budget (opt-in): only when maxTokens is set do we touch selected/omitted,
  // so an unset budget leaves the pack byte-for-byte identical to before.
  let budget = null;
  let finalSelected = selected;
  if (maxTokens !== null && maxTokens !== undefined) {
    const result = applyTokenBudget(selected, omitted, maxTokens, risk.level === "risky");
    finalSelected = result.selected;
    omitted = result.omitted;
    budget = { maxTokens, estimatedTokens: result.estimatedTokens, overBudget: result.overBudget };
  }

  return {
    task,
    scopes,
    generatedAt: now.toISOString(),
    selected: finalSelected,
    omitted,
    sourceFiles: SOURCE_FILES,
    risk,
    ...(budget ? { budget } : {}),
  };
}

// W5 — the per-block provenance tuple the Workbench surfaces (W2 §5).
// Maps the compiler's internal inclusion reasons onto the spec enum:
// "always" -> "constraint", "matched" -> "scored", "risk-forced" stays.
// `score` is the lexical score for scored inclusion and null otherwise —
// constraint and risk-forced blocks are included regardless of score, so
// reporting one would imply a selection mechanism that did not run.
export const EXPLAIN_REASONS = Object.freeze({
  always: "constraint",
  matched: "scored",
  "risk-forced": "risk-forced",
});

export function explainBlock(block) {
  return {
    sourceFile: block.file,
    heading: block.title,
    score: block.reason === "matched" ? block.score : null,
    reason: EXPLAIN_REASONS[block.reason],
  };
}

function renderExplainLine(block) {
  const e = explainBlock(block);
  return `Explain: sourceFile=${e.sourceFile} heading="${e.heading}" score=${e.score === null ? "null" : e.score} reason=${e.reason}`;
}

export function renderContextPack(pack, options = {}) {
  const lines = [
    "# agentctx context pack",
    "",
    `Task: ${pack.task || "(none)"}`,
    `Scopes: ${pack.scopes.length > 0 ? pack.scopes.join(", ") : "(none)"}`,
    `Risk: ${pack.risk ? pack.risk.level : "safe"}${
      pack.risk && pack.risk.signals.length > 0 ? ` (${pack.risk.signals.join(", ")})` : ""
    }`,
    `Generated: ${pack.generatedAt}`,
    "",
  ];
  if (pack.routedTo) {
    lines.push(`Routed to: ${pack.routedTo.selected}${pack.routedTo.ambiguous ? " (ambiguous)" : ""}`, "");
  }
  if (pack.budget) {
    lines.push(
      `Budget: ${pack.budget.estimatedTokens}/${pack.budget.maxTokens} tokens${
        pack.budget.overBudget ? " (over budget — mandatory blocks exceed the limit)" : ""
      }`,
      "",
    );
  }
  lines.push("## Included Context", "");

  for (const block of pack.selected) {
    const reason = block.reason === "always" ? "always included" : `${block.reason}; score=${block.score}`;
    lines.push(`### ${block.file} / ${block.title}`);
    lines.push("");
    lines.push(`Source: ${block.file}`);
    lines.push(`Reason: ${reason}`);
    if (options.explain) lines.push(renderExplainLine(block));
    if (block.tags.length > 0) lines.push(`Tags: ${block.tags.map((tag) => `#${tag}`).join(" ")}`);
    lines.push("");
    lines.push(block.body);
    lines.push("");
  }

  lines.push("## Omitted Context");
  lines.push("");
  const omitted = pack.omitted.filter((block) => block.score > 0);
  if (omitted.length === 0) {
    lines.push("No positive-scoring blocks were omitted.");
  } else {
    for (const block of omitted.slice(0, 10)) {
      const why = block.reason === "budget" ? ", omitted: budget" : "";
      lines.push(`- ${block.file} / ${block.title} (score=${block.score}${why})`);
    }
  }

  return `${lines.join("\n").trim()}\n`;
}

export function renderContextPackJson(pack, options = {}) {
  return (
    JSON.stringify(
      {
        task: pack.task,
        scopes: pack.scopes,
        generatedAt: pack.generatedAt,
        selected: pack.selected.map((b) => ({
          file: b.file,
          title: b.title,
          tags: b.tags,
          score: b.score === Infinity ? "always" : b.score,
          reason: b.reason,
          body: b.body,
          ...(options.explain ? { explain: explainBlock(b) } : {}),
        })),
        omittedCount: pack.omitted.length,
        sourceFiles: pack.sourceFiles,
        risk: pack.risk ?? { level: "safe", mode: "auto", signals: [] },
        ...(pack.budget
          ? {
              budget: pack.budget,
              budgetOmitted: pack.omitted
                .filter((b) => b.reason === "budget")
                .map((b) => ({
                  file: b.file,
                  title: b.title,
                  score: b.score === Infinity ? "always" : b.score,
                })),
            }
          : {}),
        ...(pack.routedTo ? { routedTo: pack.routedTo } : {}),
      },
      null,
      2,
    ) + "\n"
  );
}

// Compact rendering: the answer blocks and nothing else. No generated timestamp,
// no per-block Source/Reason/Tags metadata, no Omitted section — just the task, a
// one-line risk note when the task is risky, and each included block's heading +
// body. Built for token-tight prompt budgets where the markdown ceremony is waste.
export function renderContextPackCompact(pack) {
  const lines = [`# context pack: ${pack.task || "(none)"}`];
  if (pack.risk && pack.risk.level === "risky") {
    lines.push(`Risk: risky${pack.risk.signals.length > 0 ? ` (${pack.risk.signals.join(", ")})` : ""}`);
  }
  lines.push("");
  for (const block of pack.selected) {
    lines.push(`## ${block.file} / ${block.title}`);
    lines.push(block.body);
    lines.push("");
  }
  return `${lines.join("\n").trim()}\n`;
}

export function compileFromCwd(options) {
  // Layer ① (opt-in): when a library is given, route the task to one box first, then
  // compile that box. Without --library this is byte-for-byte the single-ontology path.
  let cwd = options.cwd;
  let routedTo = null;
  if (options.library) {
    const ontologies = scanLibrary(options.library);
    const routed = routeOntology(options.task, options.scopes ?? [], ontologies);
    if (!routed.selected) {
      throw new Error(
        `No ontology in ${options.library} matched the task. Add trigger terms to a box's manifest, or check the task wording.`,
      );
    }
    cwd = ontologies.find((o) => o.id === routed.selected).dir;
    routedTo = {
      selected: routed.selected,
      ambiguous: routed.ambiguous,
      candidates: routed.candidates.map((c) => ({ id: c.id, score: c.score })),
    };
  }

  validateAgentctxSources(cwd);
  const sources = readAgentctx(cwd);
  const pack = compileContext({
    sources,
    task: options.task,
    scopes: options.scopes,
    maxBlocksPerFile: options.maxBlocksPerFile,
    minScore: options.minScore,
    riskMode: options.riskMode,
    richScoring: options.richScoring === true,
    maxTokens: options.maxTokens ?? null,
  });
  if (routedTo) pack.routedTo = routedTo;
  const render = { explain: options.explain === true };
  if (options.format === "json") return renderContextPackJson(pack, render);
  if (options.format === "compact") return renderContextPackCompact(pack);
  return renderContextPack(pack, render);
}

function splitCsv(value) {
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function printHelp() {
  return `agentctx compile — compile a task-scoped context pack from .agentctx/ source files.

Usage:
  node scripts/agentctx/compile.mjs compile --task "Fix OAuth bug" [options]
  npm run agentctx:compile -- --task "Fix OAuth bug" --scope auth

Options:
  --task <text>                 Required. Task description to compile context for.
  --scope <csv>                 Explicit scopes (comma-separated), e.g. auth,frontend.
                                Scope tokens are weighted higher than task tokens.
  --format markdown|json|compact
                                Output format. Default: markdown.
                                json = machine-readable; compact = answer blocks
                                only (no metadata/omitted), for tight token budgets.
  --cwd <path>                  Directory containing .agentctx/. Default: cwd.
  --max-blocks-per-file <n>     Max blocks selected from each scored file. Default: ${DEFAULT_MAX_BLOCKS_PER_FILE}.
  --min-score <n>               Minimum relevance score for block selection. Default: ${DEFAULT_MIN_SCORE}.
  --risk auto|safe|risky        Task-risk mode. Default: ${DEFAULT_RISK_MODE}. "auto" classifies the
                                task; on a risky task (delete/drop/migrate/deploy/etc.) safety-tagged
                                blocks are forced into the pack regardless of score.
  --explain                     Add per-block provenance (sourceFile, heading, score,
                                reason: constraint|scored|risk-forced) to the output.
                                Without this flag the output is byte-identical to before.
  --rich-scoring                Opt in to richer ranking signals: a task/scope hit in a
                                block's heading/tags earns an extra boost over a body-only
                                hit. Off by default; the default ranking is unchanged.
  --max-tokens <n>              Fit the pack inside a rough token budget. constraints and
                                risk-forced safety blocks are always kept; lower-priority
                                blocks are dropped (reason: budget) to fit. The budget counts
                                the context content (exact for --format compact); markdown
                                and json add human-facing display overhead. Off by default;
                                without it the pack is unchanged.
  --library <dir>               Route across a library of boxes first: pick the ontology
                                whose manifest triggers best match the task, then compile it
                                (see the route command). Without it, compile the single
                                .agentctx/ at --cwd unchanged.
  -h, --help                    Show this help message.

Source files (under .agentctx/):
  constraints.md                Always fully included. Non-negotiable invariants.
  identity.md, direction.md,    Scored and filtered per task. Blocks with score >= min-score
  projects.md, decisions.md,    are included, up to max-blocks-per-file per file.
  architecture.md,              Files absent from a project's .agentctx/ are skipped.
  agent-roles.md, glossary.md,
  cq.md

Examples:
  # Compile context for an auth task with explicit scope
  npm run agentctx:compile -- --task "Implement OAuth PKCE flow" --scope auth,security

  # Machine-readable JSON output for piping
  npm run agentctx:compile -- --task "Add MCP tool wrapper" --format json | jq .selected[].title

  # Show what context an AI agent would receive for a positioning question
  npm run agentctx:compile -- --task "Position agentctx against CLAUDE.md"
`;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const options = parseArgv();
    if (options.command === "help") {
      process.stdout.write(printHelp());
      process.exit(0);
    }
    if (options.command !== "compile") {
      throw new Error(`Unknown command: ${options.command}`);
    }
    if (!options.task) {
      throw new Error("Missing required --task argument");
    }
    process.stdout.write(compileFromCwd(options));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
