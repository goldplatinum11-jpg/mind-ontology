import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// M33 — lightweight relative-link / path audit over the docs, using only Node
// builtins. Every relative markdown link must resolve to a real file so docs
// can't silently rot. External (http) and pure-anchor (#) links are out of scope.

function markdownFiles() {
  const files = [];
  // Root-level docs.
  for (const name of readdirSync(REPO_ROOT)) {
    if (name.endsWith(".md")) files.push(resolve(REPO_ROOT, name));
  }
  // docs/ tree (recursive).
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith(".md")) files.push(p);
    }
  };
  walk(resolve(REPO_ROOT, "docs"));
  return files;
}

// Markdown inline links: [text](target). Capture the target.
const LINK_RE = /\[[^\]]*\]\(([^)]+)\)/g;

function relativeLinkTargets(text) {
  const targets = [];
  let m;
  while ((m = LINK_RE.exec(text)) !== null) {
    let target = m[1].trim();
    // Strip a title: [x](path "title")
    target = target.split(/\s+/)[0];
    if (!target) continue;
    if (/^(https?:|mailto:|#)/i.test(target)) continue; // external / anchor-only
    targets.push(target.replace(/#.*$/, "")); // drop any #anchor fragment
  }
  return targets;
}

describe("documentation relative links resolve (M33)", () => {
  it("every relative markdown link points at an existing file", () => {
    const dead = [];
    for (const file of markdownFiles()) {
      const baseDir = dirname(file);
      for (const target of relativeLinkTargets(readFileSync(file, "utf8"))) {
        if (!target) continue;
        const resolved = resolve(baseDir, target);
        if (!existsSync(resolved)) {
          dead.push(`${relative(REPO_ROOT, file)} -> ${target}`);
        }
      }
    }
    expect(dead, `dead links:\n${dead.join("\n")}`).toEqual([]);
  });

  it("no markdown link points into an excluded source tree", () => {
    const bad = [];
    for (const file of markdownFiles()) {
      for (const target of relativeLinkTargets(readFileSync(file, "utf8"))) {
        if (/(^|\/)docs\/operator\//.test(target) || /(^|\/)scripts\/operator\//.test(target)) {
          bad.push(`${relative(REPO_ROOT, file)} -> ${target}`);
        }
      }
    }
    expect(bad, `links into excluded trees:\n${bad.join("\n")}`).toEqual([]);
  });
});

// Cited repo file paths — `tests/...mjs`, `scripts/...mjs`, `src/...mjs` — show up
// in prose and backtick code spans, NOT as markdown links, so the link audit above
// never sees them. As examples / CLI / packaging / MCP-setup docs grow they cite
// real test and script files heavily; this guards those citations from rotting.
// The `operator/` tree lives outside the OSS surface (mirrored by the link rule
// above), and glob patterns like `tests/unit/*.test.mjs` are not concrete paths,
// so both are out of scope.
const CITED_PATH_RE = /\b((?:tests|scripts|src)\/[A-Za-z0-9._/-]+\.mjs)\b/g;

// A doc line may deliberately name an absent file to document the OSS extraction
// boundary (e.g. EXTRACTION-INVENTORY.md: "tests/unit/foo.test.mjs — EXCLUDED").
// Such a line asserts the file is gone, so presence-checking it is wrong. This
// keys on a semantic marker, so it protects any future boundary doc, while a
// plain stale citation (no marker) is still caught.
const EXCLUSION_MARKER_RE = /\b(excluded|removed|deleted)\b|no longer\b|does not exist/i;

function citedRepoPaths(text) {
  const paths = new Set();
  for (const line of text.split("\n")) {
    if (EXCLUSION_MARKER_RE.test(line)) continue; // deliberate absent-file citation
    let m;
    CITED_PATH_RE.lastIndex = 0;
    while ((m = CITED_PATH_RE.exec(line)) !== null) {
      const p = m[1];
      if (p.includes("*")) continue; // glob, not a concrete file
      if (/(^|\/)operator\//.test(p)) continue; // excluded tree, mirrors link rule
      paths.add(p);
    }
  }
  return paths;
}

describe("documentation cites real test and script files (M61)", () => {
  it("every cited tests/ scripts/ src/ .mjs path resolves to an existing file", () => {
    const dead = [];
    for (const file of markdownFiles()) {
      for (const p of citedRepoPaths(readFileSync(file, "utf8"))) {
        if (!existsSync(resolve(REPO_ROOT, p))) {
          dead.push(`${relative(REPO_ROOT, file)} -> ${p}`);
        }
      }
    }
    expect(dead, `citations to missing files:\n${dead.join("\n")}`).toEqual([]);
  });

  it("the citation audit actually scans real test-file references (guard against a dead regex)", () => {
    // If the matcher silently stops finding `tests/...test.mjs` citations, the
    // audit above would pass vacuously. Assert it sees the citations docs make.
    let total = 0;
    for (const file of markdownFiles()) {
      for (const p of citedRepoPaths(readFileSync(file, "utf8"))) {
        if (p.startsWith("tests/")) total += 1;
      }
    }
    expect(total).toBeGreaterThan(0);
  });
});
