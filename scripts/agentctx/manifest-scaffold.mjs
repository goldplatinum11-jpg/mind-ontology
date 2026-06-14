// Manifest scaffolding — draft a box's `.agentctx/manifest.json` from its sources, so
// turning an ontology into a routable box is an edit, not a blank page.
//
// Deterministic and conservative: it pulls distinctive terms from the headings and
// project names an author already wrote (projects/glossary/identity/direction), drops
// generic structural words, and emits a DRAFT manifest plus the source of each suggested
// trigger. The author reviews and trims — the router only trusts hand-confirmed triggers.

import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parseMarkdownBlocks } from "./compile.mjs";

// Structural / template words that are never useful as routing triggers.
const GENERIC = new Set([
  "the", "a", "an", "and", "or", "of", "to", "for", "in", "on", "with", "is", "are", "be",
  "this", "that", "your", "you", "what", "which", "how", "when", "before", "after",
  "project", "projects", "active", "secondary", "archived", "current", "direction",
  "priorities", "posture", "product", "constraint", "constraints", "decision", "decisions",
  "glossary", "term", "architecture", "identity", "agent", "agents", "role", "roles",
  "example", "context", "pack", "portable", "style", "communication", "operator", "now",
  "starting", "should", "must", "avoid", "apply", "applies", "name", "status",
]);

const SOURCE_WEIGHT = { "project-name": 5, "glossary-term": 4, "project-title": 3, identity: 3, direction: 2 };

function readBlocks(agentctxDir, file) {
  const path = join(agentctxDir, file);
  if (!existsSync(path)) return [];
  return parseMarkdownBlocks(readFileSync(path, "utf8"), file);
}

// A term is useful if it carries at least one distinctive word — a non-generic ASCII
// word of length >= 3, or any non-ASCII (CJK) run (which has no word boundaries to trim).
function isUsefulTerm(term) {
  const words = term.toLowerCase().split(/[^a-z0-9À-￿]+/).filter(Boolean);
  return words.some((w) => /[^\x00-\x7f]/.test(w) || (w.length >= 3 && !GENERIC.has(w)));
}

export function scaffoldManifest(ontologyDir, opts = {}) {
  const limit = opts.limit ?? 12;
  const dir = resolve(ontologyDir);
  const agentctx = join(dir, ".agentctx");
  if (!existsSync(agentctx)) throw new Error(`No .agentctx/ in ${dir}`);

  const found = []; // { term, source }
  for (const b of readBlocks(agentctx, "projects.md")) {
    const m = b.body.match(/^\s*Name:\s*(.+)$/m);
    if (m) found.push({ term: m[1].trim(), source: "project-name" });
    found.push({ term: b.title.trim(), source: "project-title" });
  }
  for (const b of readBlocks(agentctx, "glossary.md")) found.push({ term: b.title.trim(), source: "glossary-term" });
  for (const b of readBlocks(agentctx, "identity.md")) found.push({ term: b.title.trim(), source: "identity" });
  for (const b of readBlocks(agentctx, "direction.md")) found.push({ term: b.title.trim(), source: "direction" });

  // Dedup case-insensitively, keep the highest-weighted source, drop generic terms.
  const byKey = new Map();
  for (const { term, source } of found) {
    if (!term || !isUsefulTerm(term)) continue;
    const key = term.toLowerCase();
    const prev = byKey.get(key);
    if (!prev || SOURCE_WEIGHT[source] > SOURCE_WEIGHT[prev.source]) byKey.set(key, { term, source });
  }

  const suggestions = [...byKey.values()].sort(
    (a, b) => SOURCE_WEIGHT[b.source] - SOURCE_WEIGHT[a.source] || (a.term < b.term ? -1 : a.term > b.term ? 1 : 0),
  );
  const triggers = suggestions.slice(0, limit).map((s) => s.term);
  // A manifest with no triggers is rejected by loadManifest, so emitting one would be a
  // trap. Fail clearly instead — the author needs distinctive content or hand-written
  // triggers (a placeholder/template ontology has nothing routable to draft from).
  if (triggers.length === 0) {
    throw new Error(
      `Could not derive any routing triggers from ${dir}. Add distinctive project names / glossary terms, or write the manifest triggers by hand.`,
    );
  }

  // Scopes: the distinct topic tags across blocks (a useful starting point, also draft).
  const tagSet = new Set();
  for (const file of ["projects.md", "direction.md"]) {
    for (const b of readBlocks(agentctx, file)) for (const t of b.tags) tagSet.add(t);
  }
  const scopes = [...tagSet].filter((t) => !GENERIC.has(t)).sort();

  const identityTitle = readBlocks(agentctx, "identity.md")[0]?.title?.trim();
  return {
    manifest: {
      id: basename(dir),
      name: identityTitle || basename(dir),
      triggers,
      scopes,
    },
    suggestions: suggestions.slice(0, limit),
    draft: true,
  };
}

export function renderScaffold(result, format = "text") {
  if (format === "json") return JSON.stringify(result.manifest, null, 2) + "\n";
  const lines = [];
  lines.push("# DRAFT manifest.json — review and trim the triggers before saving:");
  lines.push("");
  lines.push(JSON.stringify(result.manifest, null, 2));
  lines.push("");
  lines.push("# Suggested triggers (source):");
  for (const s of result.suggestions) lines.push(`  - ${s.term}  (${s.source})`);
  return `${lines.join("\n")}\n`;
}

export function parseScaffoldArgv(argv = process.argv.slice(2)) {
  const parsed = { format: "text" };
  const args = argv[0] === "scaffold" ? argv.slice(1) : argv.slice(0);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--cwd") {
      const dir = args[++i];
      if (!dir || dir.startsWith("--")) throw new Error("--cwd requires a directory path");
      parsed.cwd = dir;
    } else if (arg === "--format") {
      const f = args[++i];
      if (f !== "json" && f !== "text") throw new Error(`--format must be "json" or "text", got: ${f ?? ""}`);
      parsed.format = f;
    } else if (arg === "-h" || arg === "--help") {
      parsed.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

export function scaffoldHelp() {
  return `agentctx scaffold — draft a manifest.json from an ontology's existing sources.

Usage:
  node scripts/agentctx/manifest-scaffold.mjs scaffold --cwd <ontology-dir> [--format json|text]

Pulls distinctive terms from projects/glossary/identity/direction headings and project
names, drops generic words, and prints a DRAFT manifest. Review and trim the triggers,
then save it to <ontology-dir>/.agentctx/manifest.json.
`;
}

const isScaffoldMain = (() => {
  try {
    return process.argv[1] && resolve(process.argv[1]).endsWith("manifest-scaffold.mjs");
  } catch {
    return false;
  }
})();

if (isScaffoldMain) {
  try {
    const opts = parseScaffoldArgv();
    if (opts.help) {
      process.stdout.write(scaffoldHelp());
      process.exit(0);
    }
    const result = scaffoldManifest(opts.cwd ?? process.cwd());
    process.stdout.write(renderScaffold(result, opts.format));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
