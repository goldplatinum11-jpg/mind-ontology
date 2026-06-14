// Ontology router — layer ① of the three-layer model: pick the right ontology (box)
// for a task from a library of many, before the compiler picks blocks within it.
//
// Deterministic by construction (the product wedge): each box declares an explicit
// signature in `.agentctx/manifest.json` (author-written trigger terms), and routing
// is verbatim/token matching of the task against those signatures — no embeddings, no
// ML classifier. Same inputs always give the same box, with a why.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { tokenize } from "./compile.mjs";

export const MANIFEST_REL = ".agentctx/manifest.json";

// Load + validate one ontology manifest. Required: id, name, a non-empty triggers[]
// (the author-declared vocabulary the router keys on). scopes/description/excludeTerms
// are optional. Throws with a clear message on a missing/invalid manifest.
export function loadManifest(ontologyDir) {
  const path = resolve(ontologyDir, MANIFEST_REL);
  if (!existsSync(path)) throw new Error(`No ${MANIFEST_REL} in ${ontologyDir}`);
  let raw;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`Invalid JSON manifest: ${path}`);
  }
  for (const field of ["id", "name"]) {
    if (typeof raw[field] !== "string" || !raw[field].trim()) {
      throw new Error(`manifest ${path} is missing a non-empty "${field}"`);
    }
  }
  if (!Array.isArray(raw.triggers) || raw.triggers.length === 0) {
    throw new Error(`manifest ${path} needs a non-empty "triggers" array (the words that route to this box)`);
  }
  return {
    id: raw.id,
    name: raw.name,
    description: typeof raw.description === "string" ? raw.description : "",
    triggers: raw.triggers.map((t) => String(t)),
    scopes: Array.isArray(raw.scopes) ? raw.scopes.map((s) => String(s)) : [],
    excludeTerms: Array.isArray(raw.excludeTerms) ? raw.excludeTerms.map((t) => String(t)) : [],
    dir: resolve(ontologyDir),
  };
}

// Scan a library directory for `<libraryDir>/<id>/.agentctx/manifest.json`, in
// directory-name order (deterministic). Subdirectories without a manifest are skipped.
export function scanLibrary(libraryDir) {
  const root = resolve(libraryDir);
  if (!existsSync(root)) throw new Error(`Library directory not found: ${root}`);
  const names = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  const ontologies = [];
  const seenIds = new Set();
  for (const name of names) {
    const dir = join(root, name);
    if (!existsSync(resolve(dir, MANIFEST_REL))) continue;
    const m = loadManifest(dir);
    // ids must be unique within a library — routing returns an id, so a duplicate would
    // make `compile --library` ambiguous about which box actually matched.
    if (seenIds.has(m.id)) {
      throw new Error(`Duplicate ontology id "${m.id}" in ${root} — each box needs a unique id`);
    }
    seenIds.add(m.id);
    ontologies.push(m);
  }
  return ontologies;
}

export const DEFAULT_ROUTE_MIN_SCORE = 1;
export const DEFAULT_ROUTE_MARGIN = 2;

// Match a declared term against the task text. Non-ASCII (e.g. Japanese) terms and
// multi-word phrases match as a substring — there are no reliable word boundaries in
// CJK and a phrase is already specific. A single ASCII token must match on a word
// boundary, so a trigger like "API" does not fire inside "rapid" or "scraping".
export function phraseMatches(term, taskLower) {
  const t = String(term ?? "").toLowerCase();
  if (!t) return false;
  if ([...t].some((c) => c.charCodeAt(0) > 127) || /\s/.test(t)) return taskLower.includes(t);
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(taskLower);
}

// Route a task to one ontology. Returns the selected id (or null if nothing scores),
// an ambiguity flag, and the full ranked candidate list with per-box scores + reasons
// so the choice is always explainable. Never blends boxes.
export function routeOntology(task, scopes = [], ontologies = [], opts = {}) {
  const minScore = opts.minScore ?? DEFAULT_ROUTE_MIN_SCORE;
  const margin = opts.margin ?? DEFAULT_ROUTE_MARGIN;
  const taskLower = String(task ?? "").toLowerCase();
  const taskTokens = tokenize(`${task ?? ""} ${scopes.join(" ")}`);
  const scopeLower = scopes.map((s) => String(s).toLowerCase());

  const candidates = ontologies.map((o, order) => {
    let score = 0;
    let strong = false; // a trigger or scope hit — required for a box to be selectable
    const reasons = [];
    // Normalize optional fields so routing is robust to partial ontology objects
    // (loadManifest already fills these; this keeps the scorer defensive).
    const triggers = o.triggers ?? [];
    const declaredScopeList = o.scopes ?? [];
    const excludeTerms = o.excludeTerms ?? [];
    const name = o.name ?? "";
    const description = o.description ?? "";

    // Strong, language-aware signal: a declared trigger appears in the task. CJK and
    // multi-word triggers match as a substring; a single ASCII token matches on a word
    // boundary (phraseMatches) so "API" does not fire inside "rapid".
    for (const trig of triggers) {
      if (phraseMatches(trig, taskLower)) {
        score += 8;
        strong = true;
        reasons.push(`trigger:${trig}`);
      }
    }
    // Explicit scope declared by both the request and the box.
    const declaredScopes = new Set(declaredScopeList.map((s) => s.toLowerCase()));
    for (const s of scopeLower) {
      if (declaredScopes.has(s)) {
        score += 10;
        strong = true;
        reasons.push(`scope:${s}`);
      }
    }
    // Weaker token overlap for space-separated languages.
    const triggerTokens = new Set(triggers.flatMap((t) => tokenize(t)));
    const nameDescTokens = new Set(tokenize(`${name} ${description}`));
    for (const tok of taskTokens) {
      if (triggerTokens.has(tok)) score += 3;
      else if (nameDescTokens.has(tok)) score += 1;
    }
    // excludeTerms are a hard veto: if the task carries one, this box is never selected,
    // however well it otherwise scored. That is what makes them reliable for suppressing
    // a box on a shared generic word.
    let vetoed = false;
    for (const ex of excludeTerms) {
      if (phraseMatches(ex, taskLower)) {
        vetoed = true;
        reasons.push(`exclude:${ex}`);
      }
    }

    return { id: o.id, name: o.name, score, strong, vetoed, reasons, order, dir: o.dir };
  });

  // Deterministic order: non-vetoed first, then score desc, scan order, id alphabetical.
  candidates.sort((a, b) => {
    if (a.vetoed !== b.vetoed) return a.vetoed ? 1 : -1;
    return b.score - a.score || a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });

  // Only a box with a real signal (a trigger or scope hit) is selectable; a weak
  // name/description token overlap refines ranking but cannot pick a box on its own.
  const eligible = candidates.filter((c) => c.strong && !c.vetoed && c.score >= minScore);
  const top = eligible[0] ?? null;
  const second = eligible[1] ?? null;
  // Ambiguous when a real runner-up sits within `margin` of the top — we still pick the
  // top (never blend), but flag it so the operator sees the call was close.
  const ambiguous = Boolean(top && second && top.score - second.score < margin);

  return { selected: top ? top.id : null, ambiguous, candidates };
}

// --- CLI surface ---------------------------------------------------------------

// Parse `route` args: --library <dir> --task <text> [--scope a,b] [--format json|text].
// A leading "route" positional (forwarded by the cli wrapper) is tolerated.
export function parseRouteArgv(argv = process.argv.slice(2)) {
  const parsed = { format: "text", scopes: [] };
  const args = argv[0] === "route" ? argv.slice(1) : argv.slice(0);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--library") {
      const dir = args[++i];
      if (!dir || dir.startsWith("--")) throw new Error("--library requires a directory path");
      parsed.library = dir;
    }
    else if (arg === "--task") parsed.task = args[++i];
    else if (arg === "--scope") parsed.scopes = String(args[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg === "--format") {
      const f = args[++i];
      if (f !== "json" && f !== "text") throw new Error(`--format must be "json" or "text", got: ${f ?? ""}`);
      parsed.format = f;
    } else if (arg === "-h" || arg === "--help") parsed.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

export function renderRoute(result, format = "text") {
  if (format === "json") {
    return JSON.stringify(
      {
        selected: result.selected,
        ambiguous: result.ambiguous,
        candidates: result.candidates.map((c) => ({
          id: c.id,
          name: c.name,
          score: c.score,
          vetoed: Boolean(c.vetoed),
          reasons: c.reasons,
        })),
      },
      null,
      2,
    ) + "\n";
  }
  const lines = [];
  lines.push(`Selected box: ${result.selected ?? "(none — no box matched)"}${result.ambiguous ? "  [ambiguous]" : ""}`);
  lines.push("Ranked candidates:");
  for (const c of result.candidates) {
    lines.push(`  ${c.id} (score=${c.score})${c.reasons.length ? ` — ${c.reasons.join(", ")}` : ""}`);
  }
  return `${lines.join("\n")}\n`;
}

export function routeHelp() {
  return `agentctx route — pick the ontology (box) a task belongs to, from a library.

Usage:
  node scripts/agentctx/router.mjs route --library <dir> --task "..." [options]

Options:
  --library <dir>   Directory holding <id>/.agentctx/manifest.json boxes. Required.
  --task <text>     The task / conversation text to route. Required.
  --scope <csv>     Explicit scopes, weighted strongly (comma-separated).
  --format json|text  Output format. Default: text.
  -h, --help        Show this help.
`;
}

const isRouterMain = (() => {
  try {
    return process.argv[1] && resolve(process.argv[1]).endsWith("router.mjs");
  } catch {
    return false;
  }
})();

if (isRouterMain) {
  try {
    const opts = parseRouteArgv();
    if (opts.help) {
      process.stdout.write(routeHelp());
      process.exit(0);
    }
    if (!opts.library) throw new Error("Missing required --library argument");
    if (!opts.task) throw new Error("Missing required --task argument");
    const ontologies = scanLibrary(opts.library);
    const result = routeOntology(opts.task, opts.scopes, ontologies);
    process.stdout.write(renderRoute(result, opts.format));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
