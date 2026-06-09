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
