#!/usr/bin/env node

/**
 * mind-ontology adopt — guided, local-first adoption for an existing project.
 *
 * One command that plans the setup a project needs across every supported
 * client: Claude Code, Codex, Cursor, and the ChatGPT / Claude.ai paste-block.
 * It replaces the "remember the scattered commands" onboarding (init -> emit ->
 * agent-setup, per client) with a single entry point that says what will
 * happen, what needs manual action, and how to verify the result. Normative
 * contract: docs/mind-ontology-adopt-spec-v1.md.
 *
 * Default mode is a READ-ONLY plan: `mind-ontology adopt` inspects the project
 * and prints the plan it WOULD apply, writing nothing. `--write` is the single
 * gate to any file creation, and even then adopt only ever does safe, local,
 * create-or-refresh setup.
 *
 * Safety: adopt adds NO new authority. It composes the already-shipped emit,
 * agent-setup, and init --from-repo contracts and inherits their guarantees:
 *   - default mode writes nothing; --write is the single gate to file creation;
 *   - it writes only inside --cwd (never global user config / user memory);
 *   - it never overwrites or merges an existing config or an unmanaged /
 *     hand-edited artifact — such conflicts surface as `manual_required` and are
 *     reported honestly, never clobbered;
 *   - it automates no ChatGPT / Claude.ai UI (paste-block is always manual);
 *   - it emits no real endpoint URLs or credentials.
 *
 * Determinism: the plan is a pure function of (cwd's filesystem facts, the
 * requested targets). No timestamps, machine identity, network, or model calls.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_AGENTCTX_DIR, readAgentctx } from "./compile.mjs";
import { BOOTSTRAP_INSTRUCTION, buildSetupPlan } from "./agent-setup.mjs";
import {
  EMIT_TARGETS,
  PROFILES,
  SUPPORTED_TARGET_IDS,
  buildArtifact,
  classifyTarget,
} from "./emit.mjs";
import { initFromRepo } from "./init-from-repo.mjs";

export const ADOPT_VERSION = 1;

// Client registry. Object key order is the canonical `--targets all` expansion
// order (claude-code, codex, cursor, paste-block). `emitTarget` is the emit
// registry id the client reads as a static artifact; `setupTarget` is the
// agent-setup client whose MCP config file the client also needs, or null for
// emit-only clients (cursor, paste-block). `pasteOnly` marks the manual
// ChatGPT / Claude.ai target (no machine config, no UI automation).
export const ADOPT_TARGETS = {
  "claude-code": { label: "Claude Code", emitTarget: "claude-md", setupTarget: "claude-code" },
  codex: { label: "Codex", emitTarget: "agents-md", setupTarget: "codex" },
  cursor: { label: "Cursor", emitTarget: "cursor", setupTarget: null },
  "paste-block": {
    label: "ChatGPT / Claude.ai paste-block",
    emitTarget: "paste-block",
    setupTarget: null,
    pasteOnly: true,
  },
};

export const ADOPT_TARGET_IDS = Object.keys(ADOPT_TARGETS);

function allowedTargets() {
  return ADOPT_TARGET_IDS.map((id) => `"${id}"`).join(", ");
}

function badTargets(got) {
  return new Error(
    `--targets must be "all" or a comma list of ${allowedTargets()}, got: ${got}`,
  );
}

/**
 * Expand a raw --targets value into an ordered, deduped client id list.
 * `all` (only valid as the sole token) expands to the canonical order; an
 * explicit list preserves the order the operator typed and rejects unknown ids.
 * Throws badTargets on an empty value or an unknown id. Pure.
 */
export function expandTargets(raw) {
  const tokens = String(raw)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) throw badTargets("(empty)");
  if (tokens.length === 1 && tokens[0] === "all") return [...ADOPT_TARGET_IDS];

  const out = [];
  for (const tok of tokens) {
    if (!ADOPT_TARGETS[tok]) throw badTargets(tok);
    if (!out.includes(tok)) out.push(tok);
  }
  return out;
}

export function parseAdoptArgv(argv = process.argv.slice(2)) {
  const parsed = {
    targetsRaw: "all",
    write: false,
    format: "text",
    cwd: process.cwd(),
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--targets") {
      parsed.targetsRaw = String(argv[++i] ?? "");
    } else if (arg === "--write") {
      parsed.write = true;
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
      throw new Error(
        `Unknown argument: ${arg}. Run "mind-ontology adopt --help" for the list of options.`,
      );
    }
  }

  if (parsed.help) return parsed;
  parsed.targets = expandTargets(parsed.targetsRaw);
  return parsed;
}

// Whether a STALE artifact can be re-emitted against the target/profile RECORDED
// in its header (the same reproducibility gate emit --reconcile applies). An
// unreproducible STALE (header records an unknown profile / unsupported target)
// is NOT auto-repaired by adopt — it becomes a conflict, so adopt never invents
// a profile that could silently change the artifact's scope.
function staleReproducible(cls) {
  return Boolean(
    EMIT_TARGETS[cls.recordedTarget]?.supported && PROFILES[cls.recordedProfile],
  );
}

// Map an emit classification to an adopt disposition:
//   create   -> artifact MISSING; a fresh emit writes it.
//   refresh  -> artifact STALE and reproducible; re-emit against the recorded
//               profile (so a `full` artifact stays `full`).
//   fresh    -> artifact OK; nothing to do.
//   conflict -> UNMANAGED / HAND-EDITED / unreproducible STALE; adopt refuses to
//               clobber it and surfaces a manual step instead.
function emitDisposition(cls) {
  switch (cls.status) {
    case "missing":
      return "create";
    case "ok":
      return "fresh";
    case "stale":
      return staleReproducible(cls) ? "refresh" : "conflict";
    default:
      return "conflict"; // unmanaged / hand-edited
  }
}

function emitDetail(cls, emitTarget, path) {
  switch (cls.status) {
    case "missing":
      return `emit ${path} (${emitTarget}); not present yet`;
    case "ok":
      return `${path} (${emitTarget}) already fresh; leave untouched`;
    case "stale":
      return staleReproducible(cls)
        ? `re-emit ${path} (${emitTarget}); sources changed since last emit`
        : `${path} (${emitTarget}) records a target/profile no longer reproducible; re-emit explicitly with a known profile`;
    case "unmanaged":
      return `${path} (${emitTarget}) is a headerless hand-written file; adopt will not overwrite it`;
    case "hand-edited":
      return `${path} (${emitTarget}) was hand-edited after generation; adopt will not overwrite it`;
    default:
      return `${path} (${emitTarget})`;
  }
}

function emitConflictManualStep(cls, emitTarget, path) {
  switch (cls.status) {
    case "unmanaged":
      return `${path} (${emitTarget}) is UNMANAGED (headerless); adopt will not overwrite it. Move its content into .agentctx/ sources, then: mind-ontology emit --force --target ${emitTarget}`;
    case "hand-edited":
      return `${path} (${emitTarget}) is HAND-EDITED; adopt will not overwrite it. Move the edit into the .agentctx/ source, then: mind-ontology emit --target ${emitTarget}`;
    default: // unreproducible stale
      return `${path} (${emitTarget}) records a target/profile no longer reproducible; adopt will not guess a profile. Re-emit it explicitly with a known profile.`;
  }
}

/**
 * Analyze a project and produce the adoption plan as data (NO writes). Reads
 * only the filesystem facts the determinism invariant names: `.agentctx/`
 * presence, each emit target's classification, and each config file's presence.
 */
export function analyzeAdoption({ cwd, targets }) {
  const agentctxPresent = existsSync(resolve(cwd, DEFAULT_AGENTCTX_DIR));
  const sources = readAgentctx(cwd); // tolerant: "" for any missing source file
  const units = [];
  const manualSteps = [];
  const warnings = [];

  // Sources unit — relevant only when `.agentctx/` is absent. In a read-only
  // plan it is a `create` the operator gets via `--write`; the warning states
  // the scaffold will run first.
  if (!agentctxPresent) {
    units.push({
      kind: "init-from-repo",
      target: null,
      path: `${DEFAULT_AGENTCTX_DIR}/`,
      disposition: "create",
      detail: "scaffold a populated .agentctx/ draft from this repository (init --from-repo)",
    });
    warnings.push(
      ".agentctx/ not found; adopt --write will scaffold a draft first with: mind-ontology init --from-repo",
    );
  }

  const seenEmit = new Set();
  for (const id of targets) {
    const spec = ADOPT_TARGETS[id];
    const emitTarget = spec.emitTarget;
    const emitSpec = EMIT_TARGETS[emitTarget];
    seenEmit.add(emitTarget);

    // Emit unit. With sources absent every artifact is freshly created after the
    // scaffold, so synthesize a MISSING classification rather than classifying
    // against empty sources.
    const cls = agentctxPresent
      ? classifyTarget({ cwd, target: emitTarget, sources })
      : { status: "missing" };
    const disposition = emitDisposition(cls);
    units.push({
      kind: "emit",
      target: id,
      emit_target: emitTarget,
      path: emitSpec.path,
      disposition,
      class: cls.status,
      recordedTarget: cls.recordedTarget ?? null,
      recordedProfile: cls.recordedProfile ?? null,
      detail: emitDetail(cls, emitTarget, emitSpec.path),
    });
    if (disposition === "conflict") {
      manualSteps.push(emitConflictManualStep(cls, emitTarget, emitSpec.path));
    }

    // Config unit (claude-code / codex only). Create-only: an existing config
    // file is a conflict adopt never overwrites or merges.
    if (spec.setupTarget) {
      const setupPlan = buildSetupPlan({ cwd, target: spec.setupTarget });
      const configExists = existsSync(resolve(cwd, setupPlan.configPath));
      units.push({
        kind: "config",
        target: id,
        setup_target: spec.setupTarget,
        path: setupPlan.configPath,
        disposition: configExists ? "conflict" : "create",
        detail: configExists
          ? `${setupPlan.configPath} already exists; adopt will not overwrite or merge it`
          : `create ${setupPlan.configPath} (${spec.label} MCP config)`,
      });
      if (configExists) {
        manualSteps.push(
          `${setupPlan.configPath} (${spec.label}) already exists; adopt will not overwrite it. Merge the agentctx server block by hand: mind-ontology agent-setup --target ${spec.setupTarget} --print`,
        );
      } else {
        // The bootstrap instruction belongs in the NON-generated instruction
        // layer — never the emit-owned artifact.
        const home =
          spec.setupTarget === "claude-code"
            ? "CLAUDE.local.md (per-user) or your Claude Code user memory"
            : "your user-level Codex guidance (e.g. ~/.codex/AGENTS.md)";
        manualSteps.push(
          `Paste the Mind Ontology bootstrap instruction into ${home} — not into the generated ${emitSpec.path}. Get it with: mind-ontology agent-setup --target ${spec.setupTarget} --print`,
        );
      }
      // Carry the agent-setup server-not-found advisory through, deduped.
      const serverWarn = setupPlan.warnings.find((w) => w.includes("MCP server script not found"));
      if (serverWarn && !warnings.includes(serverWarn)) warnings.push(serverWarn);
    }

    // paste-block is always a manual step (no machine config, no UI automation).
    if (spec.pasteOnly) {
      manualSteps.push(
        `Paste ${emitSpec.path} into your ChatGPT / Claude.ai project instructions (manual; adopt automates no UI). After editing .agentctx/, re-emit and re-paste.`,
      );
    }
  }

  // Verify commands name the emit targets the selected clients map to, in emit
  // registry order (W1 §2): agents-md, claude-md, cursor, paste-block.
  const emitTargets = SUPPORTED_TARGET_IDS.filter((t) => seenEmit.has(t));
  const verifyCommands = [
    "mind-ontology validate",
    "mind-ontology status",
    `mind-ontology emit --check --target ${emitTargets.join(",")}`,
  ];

  return {
    cwd,
    targets,
    agentctxPresent,
    units,
    manualSteps,
    warnings,
    verifyCommands,
    emitTargets,
  };
}

// Per-mode status verb for one unit disposition. `fresh` skips, `conflict`
// becomes manual_required, and a create/refresh is `planned` in a read-only
// plan or `written` once applied (the apply path lands in the next lane).
export function statusForMode(disposition, mode) {
  if (disposition === "fresh") return "skipped";
  if (disposition === "conflict") return "manual_required";
  return mode === "write" ? "written" : "planned";
}

/**
 * The adoption plan as the locked machine shape (adopt spec). `ok` reports the
 * command ran and produced a faithful plan; it is NOT flipped by a
 * `manual_required` outcome (that is reported in manual_steps).
 */
export function adoptJson(analysis, mode) {
  return {
    ok: true,
    mode,
    cwd: analysis.cwd,
    targets: analysis.targets,
    actions: analysis.units.map((u) => {
      const action = {
        kind: u.kind,
        target: u.target,
        path: u.path,
        status: statusForMode(u.disposition, mode),
        detail: u.detail,
      };
      if (u.emit_target) action.emit_target = u.emit_target;
      return action;
    }),
    manual_steps: analysis.manualSteps,
    verify_commands: analysis.verifyCommands,
    warnings: analysis.warnings,
  };
}

const TEXT_LABEL = {
  planned: "PLAN",
  written: "WROTE",
  skipped: "SKIP",
  manual_required: "MANUAL",
};

export function renderAdoptText(analysis, mode) {
  const n = analysis.targets.length;
  const lines = [
    `mind-ontology adopt — ${mode} (${n} client${n === 1 ? "" : "s"}: ${analysis.targets.join(", ")})`,
    "",
    "ACTIONS",
  ];
  for (const u of analysis.units) {
    const status = statusForMode(u.disposition, mode);
    const where = u.target ? `${u.path} (${u.target})` : u.path;
    lines.push(`  ${TEXT_LABEL[status].padEnd(7)}${where.padEnd(40)} ${u.detail}`);
  }

  if (analysis.manualSteps.length > 0) {
    lines.push("", "MANUAL STEPS");
    for (const step of analysis.manualSteps) lines.push(`  - ${step}`);
  }

  lines.push("", "VERIFY");
  for (const cmd of analysis.verifyCommands) lines.push(`  ${cmd}`);

  if (analysis.warnings.length > 0) {
    lines.push("", "WARNINGS");
    for (const w of analysis.warnings) lines.push(`  - ${w}`);
  }

  lines.push("");
  if (mode === "plan") {
    lines.push("Read-only plan — nothing written.");
  } else {
    const applied = analysis.units.filter(
      (u) => statusForMode(u.disposition, mode) === "written",
    ).length;
    const manualCount = analysis.units.filter(
      (u) => statusForMode(u.disposition, mode) === "manual_required",
    ).length;
    lines.push(
      `Done — ${applied} action(s) applied${manualCount > 0 ? `; ${manualCount} manual step(s) remain` : ""}.`,
    );
  }
  return lines.join("\n") + "\n";
}

function render(analysis, mode, format) {
  const stdout =
    format === "json"
      ? JSON.stringify(adoptJson(analysis, mode), null, 2) + "\n"
      : renderAdoptText(analysis, mode);
  return { exitCode: 0, stdout, stderr: "" };
}

/**
 * Apply one emit unit's write (create or refresh). STALE refresh rebuilds
 * against the RECORDED target/profile so a `full` artifact stays `full`; a
 * create emits the requested target at the default profile. Mirrors emit's own
 * write (mkdir + writeFileSync); the conflict classes never reach here.
 */
function writeEmitUnit(cwd, sources, unit) {
  const target = unit.class === "stale" ? unit.recordedTarget : unit.emit_target;
  const profile = unit.class === "stale" ? unit.recordedProfile : "default";
  const build = buildArtifact({ sources, target, profile });
  const path = resolve(cwd, build.path);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, build.artifact, "utf8");
}

/**
 * Execute one adopt invocation. Plan mode never touches the filesystem. Write
 * mode scaffolds sources once (if absent), then applies every safe create /
 * refresh; conflicts are reported, never clobbered. Returns
 * { exitCode, stdout, stderr }.
 */
export function runAdopt(options) {
  if (!options.write) {
    const analysis = analyzeAdoption({ cwd: options.cwd, targets: options.targets });
    return render(analysis, "plan", options.format);
  }

  // Write mode. Scaffold sources first (once) so the emit targets have something
  // to compile from; an existing `.agentctx/` is never re-scanned or overwritten.
  const scaffolded = !existsSync(resolve(options.cwd, DEFAULT_AGENTCTX_DIR));
  if (scaffolded) {
    initFromRepo({ cwd: options.cwd });
  }

  const analysis = analyzeAdoption({ cwd: options.cwd, targets: options.targets });

  // analyzeAdoption records the sources unit only when `.agentctx/` is absent;
  // after the scaffold it is present, so re-attach the init action (now applied)
  // at the front for an honest write report.
  if (scaffolded) {
    analysis.units.unshift({
      kind: "init-from-repo",
      target: null,
      path: `${DEFAULT_AGENTCTX_DIR}/`,
      disposition: "create",
      detail: "scaffolded a populated .agentctx/ draft from this repository (init --from-repo)",
    });
  }

  const sources = readAgentctx(options.cwd);
  for (const u of analysis.units) {
    if (u.kind === "emit" && (u.disposition === "create" || u.disposition === "refresh")) {
      writeEmitUnit(options.cwd, sources, u);
    } else if (u.kind === "config" && u.disposition === "create") {
      const setupPlan = buildSetupPlan({ cwd: options.cwd, target: u.setup_target });
      const path = resolve(options.cwd, setupPlan.configPath);
      // Create-only guard (race-safe): never overwrite a config that appeared.
      if (!existsSync(path)) {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, setupPlan.configContent, "utf8");
      }
    }
  }

  return render(analysis, "write", options.format);
}

function printHelp() {
  return `mind-ontology adopt — guided, local-first adoption for an existing project

Usage:
  mind-ontology adopt [options]

Plans (and with --write applies) the setup a project needs across the supported
clients: Claude Code, Codex, Cursor, and the ChatGPT / Claude.ai paste-block.
Default mode is a READ-ONLY plan; --write is the single gate to file creation.

Options:
  --targets <list>     "all" (default) or a comma list of: claude-code, codex,
                       cursor, paste-block. "all" expands in that order.
  --write              Apply the plan. Without it, adopt writes nothing.
  --format text|json   Output format (default: text).
  --cwd <path>         Project root to adopt (default: cwd).
  -h, --help           Show this help message.

adopt never overwrites or merges an existing config or an unmanaged / hand-edited
artifact — such conflicts surface as manual steps. It automates no ChatGPT /
Claude.ai UI (paste-block is always a manual paste). See:
docs/mind-ontology-adopt-spec-v1.md and docs/cli-errors.md.
`;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const options = parseAdoptArgv();
    if (options.help) {
      process.stdout.write(printHelp());
      process.exit(0);
    }
    const result = runAdopt(options);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.exitCode);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

// Re-exported for tests: the bootstrap instruction adopt points at (it lives
// verbatim in agent-setup; adopt only names where to paste it).
export { BOOTSTRAP_INSTRUCTION };
