// Library doctor — lint a whole ontology library before you trust the router on it.
//
// When you grow from one box to many, the failure mode is misrouting: two boxes that
// fire on the same word, a duplicate id, an unloadable manifest. This audits the library
// deterministically and reports every problem (it does NOT throw on the first one, unlike
// scanLibrary), so authoring issues surface together with a clear why.

import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadManifest, MANIFEST_REL } from "./router.mjs";

// Inspect every `<libraryDir>/<id>/.agentctx/manifest.json`. Returns { ok, boxes, issues }
// where issues carry a level (error|warning), a code, and a message.
export function lintLibrary(libraryDir) {
  const root = resolve(libraryDir);
  const issues = [];
  if (!existsSync(root)) {
    return { ok: false, boxes: 0, issues: [{ level: "error", code: "no-library", message: `Library not found: ${root}` }] };
  }

  const names = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const loaded = [];
  for (const name of names) {
    if (!existsSync(resolve(join(root, name), MANIFEST_REL))) continue;
    try {
      loaded.push({ name, manifest: loadManifest(join(root, name)) });
    } catch (error) {
      issues.push({ level: "error", code: "bad-manifest", box: name, message: error.message });
    }
  }

  // Duplicate ids: routing returns an id, so two boxes sharing one is unresolvable.
  const idOwner = new Map();
  for (const { name, manifest } of loaded) {
    if (idOwner.has(manifest.id)) {
      issues.push({
        level: "error",
        code: "duplicate-id",
        message: `id "${manifest.id}" is used by both ${idOwner.get(manifest.id)} and ${name}`,
      });
    } else {
      idOwner.set(manifest.id, name);
    }
  }

  // Overlapping trigger signatures: the same trigger in two boxes makes any task carrying
  // it ambiguous — the #1 misroute risk as a library grows. Same normalization the router
  // keys on (lower-cased verbatim term).
  const triggerOwners = new Map();
  for (const { manifest } of loaded) {
    for (const trig of manifest.triggers) {
      const key = String(trig).toLowerCase();
      if (!triggerOwners.has(key)) triggerOwners.set(key, new Set());
      triggerOwners.get(key).add(manifest.id);
    }
  }
  for (const [trig, owners] of triggerOwners) {
    if (owners.size > 1) {
      issues.push({
        level: "warning",
        code: "overlapping-trigger",
        message: `trigger "${trig}" is shared by ${[...owners].sort().join(", ")} — tasks with it route ambiguously`,
      });
    }
  }

  return { ok: issues.every((i) => i.level !== "error"), boxes: loaded.length, issues };
}

export function renderLint(report, format = "text") {
  if (format === "json") {
    return JSON.stringify(report, null, 2) + "\n";
  }
  const lines = [];
  const errors = report.issues.filter((i) => i.level === "error").length;
  const warnings = report.issues.filter((i) => i.level === "warning").length;
  lines.push(`Library doctor: ${report.boxes} box(es), ${errors} error(s), ${warnings} warning(s)`);
  for (const issue of report.issues) {
    lines.push(`  [${issue.level}] ${issue.code}: ${issue.message}`);
  }
  if (report.issues.length === 0) lines.push("  clean — no issues.");
  return `${lines.join("\n")}\n`;
}

export function parseDoctorArgv(argv = process.argv.slice(2)) {
  const parsed = { format: "text" };
  const args = argv[0] === "doctor" ? argv.slice(1) : argv.slice(0);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--library") {
      const dir = args[++i];
      if (!dir || dir.startsWith("--")) throw new Error("--library requires a directory path");
      parsed.library = dir;
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

export function doctorHelp() {
  return `agentctx doctor — lint an ontology library for routing problems.

Usage:
  node scripts/agentctx/library-doctor.mjs doctor --library <dir> [--format json|text]

Reports: unloadable manifests, duplicate ids (errors), and overlapping trigger
signatures that would route ambiguously (warnings). Exit 1 if any error is found.
`;
}

const isDoctorMain = (() => {
  try {
    return process.argv[1] && resolve(process.argv[1]).endsWith("library-doctor.mjs");
  } catch {
    return false;
  }
})();

if (isDoctorMain) {
  try {
    const opts = parseDoctorArgv();
    if (opts.help) {
      process.stdout.write(doctorHelp());
      process.exit(0);
    }
    if (!opts.library) throw new Error("Missing required --library argument");
    const report = lintLibrary(opts.library);
    process.stdout.write(renderLint(report, opts.format));
    process.exit(report.ok ? 0 : 1);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
