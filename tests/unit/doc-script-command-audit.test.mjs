import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function markdownFiles() {
  const files = [];
  for (const name of readdirSync(REPO_ROOT)) {
    if (name.endsWith(".md")) files.push(resolve(REPO_ROOT, name));
  }
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

// A doc audit gap the link / anchor / npm-run audits don't cover: docs frequently
// cite `node scripts/agentctx/<x>.mjs` invocations. If a script is renamed or moved,
// those citations rot silently. Audit every cited repo-relative `node scripts/...`
// path and require the file to exist.
//
// Only repo-relative paths under scripts/ are audited; absolute paths and the
// documented `/ABSOLUTE/PATH/TO/...` placeholder are intentionally out of scope.
const NODE_SCRIPT_RE = /node\s+(scripts\/[a-zA-Z0-9_./-]+\.(?:mjs|cjs|js))\b/g;

describe("doc node-script citations resolve to real files", () => {
  it("every cited `node scripts/...` path points at an existing script", () => {
    const dead = [];
    const seen = new Set();
    for (const file of markdownFiles()) {
      const text = readFileSync(file, "utf8");
      let m;
      NODE_SCRIPT_RE.lastIndex = 0;
      while ((m = NODE_SCRIPT_RE.exec(text)) !== null) {
        const rel = m[1];
        const key = `${file}::${rel}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!existsSync(resolve(REPO_ROOT, rel))) {
          dead.push(`${relative(REPO_ROOT, file)}: node ${rel} (script does not exist)`);
        }
      }
    }
    expect(dead, `citations to missing scripts:\n${dead.join("\n")}`).toEqual([]);
  });

  it("actually scans real citations (guards the regex against silently matching nothing)", () => {
    // Self-check: the audit must find the known real citations, so a regex that quietly
    // matches zero lines can never give a false green.
    let count = 0;
    for (const file of markdownFiles()) {
      const text = readFileSync(file, "utf8");
      NODE_SCRIPT_RE.lastIndex = 0;
      while (NODE_SCRIPT_RE.exec(text) !== null) count++;
    }
    expect(count, "expected at least one `node scripts/...` citation in the docs").toBeGreaterThan(0);
  });
});
