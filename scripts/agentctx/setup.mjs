#!/usr/bin/env node
/**
 * setup.mjs — mind-ontology setup
 *
 * Configures automatic ontology harvesting from Claude Code sessions by
 * writing a Stop hook to .claude/settings.json in the project directory.
 *
 * After setup, every time Claude Code stops in this project the session
 * transcript is automatically harvested into .agentctx/ — no manual
 * `import` command needed.
 *
 * Usage:
 *   mind-ontology setup [--cwd <dir>] [--dry-run] [--remove]
 *
 * Flags:
 *   --cwd <dir>   Project root with .agentctx/ (default: process.cwd())
 *   --dry-run     Show what would be written without writing
 *   --remove      Remove the harvest-session hook (undo setup)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const HARVEST_SESSION_SCRIPT = resolve(SCRIPT_DIR, "harvest-session.mjs");

// The hook command: node <absolute-path-to-harvest-session.mjs>
// Using the absolute path makes the hook work regardless of shell PATH.
function hookCommand() {
  // Normalise to forward slashes for cross-platform JSON clarity
  return `node "${HARVEST_SESSION_SCRIPT.replace(/\\/g, "/")}"`;
}

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { cwd: null, dryRun: false, remove: false };
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === "--cwd" && argv[i + 1])  { args.cwd = argv[++i]; }
    else if (a === "--dry-run")         { args.dryRun = true; }
    else if (a === "--remove")          { args.remove = true; }
    i++;
  }
  return args;
}

// ---------------------------------------------------------------------------
// Settings.json helpers
// ---------------------------------------------------------------------------

const HOOK_MARKER = "mind-ontology-harvest-session";

/** Read .claude/settings.json, return parsed object (or {} if missing). */
function readSettings(settingsPath) {
  if (!existsSync(settingsPath)) return {};
  try {
    return JSON.parse(readFileSync(settingsPath, "utf8"));
  } catch {
    return {};
  }
}

/** True if the Stop hooks array already contains our harvest-session hook. */
function hasHook(settings) {
  const stopHooks = settings?.hooks?.Stop ?? [];
  return stopHooks.some(group =>
    (group.hooks ?? []).some(h =>
      h.type === "command" && h.command?.includes(HOOK_MARKER),
    ),
  );
}

/**
 * Return a copy of settings with the harvest-session hook added to Stop hooks.
 * Idempotent — if the hook is already present, returns settings unchanged.
 */
function addHook(settings) {
  if (hasHook(settings)) return settings;
  const updated = structuredClone(settings);
  updated.hooks ??= {};
  updated.hooks.Stop ??= [];
  updated.hooks.Stop.push({
    hooks: [
      {
        type: "command",
        // Embed the marker so we can detect/remove it later
        command: `${hookCommand()} # ${HOOK_MARKER}`,
      },
    ],
  });
  return updated;
}

/**
 * Return a copy of settings with the harvest-session hook removed.
 */
function removeHook(settings) {
  if (!hasHook(settings)) return settings;
  const updated = structuredClone(settings);
  if (Array.isArray(updated?.hooks?.Stop)) {
    updated.hooks.Stop = updated.hooks.Stop.filter(
      group => !(group.hooks ?? []).some(h =>
        h.type === "command" && h.command?.includes(HOOK_MARKER),
      ),
    );
    if (updated.hooks.Stop.length === 0) delete updated.hooks.Stop;
    if (Object.keys(updated.hooks).length === 0) delete updated.hooks;
  }
  return updated;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function run(argv) {
  const args = parseArgs(argv);
  const cwd = args.cwd ? resolve(args.cwd) : process.cwd();
  const agentctxDir = join(cwd, ".agentctx");
  const claudeDir = join(cwd, ".claude");
  const settingsPath = join(claudeDir, "settings.json");

  if (!existsSync(agentctxDir)) {
    process.stderr.write(
      `setup: no .agentctx/ found in ${cwd}\n` +
      `Run "mind-ontology init" first.\n`,
    );
    process.exit(1);
  }

  const current = readSettings(settingsPath);

  if (args.remove) {
    const updated = removeHook(current);
    if (updated === current && !hasHook(current)) {
      process.stdout.write("setup --remove: no harvest-session hook found (nothing to remove)\n");
      return;
    }
    if (!args.dryRun) {
      writeFileSync(settingsPath, JSON.stringify(updated, null, 2) + "\n", "utf8");
    }
    process.stdout.write(
      `setup${args.dryRun ? " [DRY RUN]" : ""}: removed harvest-session Stop hook from ${settingsPath}\n`,
    );
    return;
  }

  if (hasHook(current)) {
    process.stdout.write(`setup: harvest-session hook already present in ${settingsPath}\n`);
    return;
  }

  const updated = addHook(current);

  if (!args.dryRun) {
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(updated, null, 2) + "\n", "utf8");
  }

  process.stdout.write(
    `setup${args.dryRun ? " [DRY RUN]" : ""}: Stop hook written to ${settingsPath}\n` +
    `  command: ${hookCommand()}\n` +
    `  effect:  every Claude Code session in ${cwd} will auto-harvest into .agentctx/\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run(process.argv.slice(2));
}

export { addHook, hasHook, hookCommand, HOOK_MARKER, removeHook };
