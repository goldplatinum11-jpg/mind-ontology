import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// Every root that holds an autopilot-pack artifact.
const ROOTS = [
  "docs",
  "templates/mind-ontology/autopilot",
  "tests/fixtures/autopilot-line",
  "tests/fixtures/autopilot-roles",
  "tests/fixtures",
];

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

// Collect autopilot artifacts: anything under the autopilot dirs, plus
// docs/tests files whose name marks them as autopilot.
function autopilotFiles() {
  const files = new Set();
  for (const root of ROOTS) {
    const base = resolve(REPO_ROOT, root);
    for (const f of walk(base)) {
      const rel = relative(REPO_ROOT, f).replace(/\\/g, "/");
      const isAutopilotDir = rel.includes("/autopilot");
      const isAutopilotNamed = /autopilot/.test(rel);
      if (isAutopilotDir || isAutopilotNamed) files.add(rel);
    }
  }
  return [...files].sort();
}

const FILES = autopilotFiles();

// Patterns that never legitimately appear in ANY pack artifact, prose or not:
// a real hosted host, a private clone/workspace path, or an absolute user path.
const FORBIDDEN_ALL = [
  { name: "hosted host", re: /sirtai\.org|workers\.dev/i },
  { name: "private clone path", re: /sirt-app-v2|sirt-codex-clones|mind-ontology-dogfood/i },
  { name: "absolute user path", re: /c:\\\\users\\\\qmbqb|\/users\/qmbqb/i },
];

// A live credential would leak in a machine-readable config/data file, not in
// prose (docs legitimately *describe* "bearer token" / "authorization" as things
// they forbid). So the secret patterns apply only to non-Markdown artifacts.
const FORBIDDEN_DATA = [
  { name: "bearer token", re: /bearer\s+[a-z0-9._-]{8,}/i },
  { name: "authorization header value", re: /authorization"?\s*[:=]\s*["']?\S/i },
];

function patternsFor(rel) {
  return rel.endsWith(".md") ? FORBIDDEN_ALL : [...FORBIDDEN_ALL, ...FORBIDDEN_DATA];
}

describe("autopilot pack anti-leakage sweep (A19)", () => {
  it("discovers a non-trivial set of autopilot artifacts", () => {
    expect(FILES.length).toBeGreaterThanOrEqual(15);
  });

  it.each(FILES)("%s contains no hosted endpoint, secret, or private path", (rel) => {
    const text = readFileSync(resolve(REPO_ROOT, rel), "utf8");
    for (const { name, re } of patternsFor(rel)) {
      expect(re.test(text), `${rel} leaks: ${name}`).toBe(false);
    }
  });

  it("includes the key pack artifacts in the sweep (non-vacuous coverage)", () => {
    const joined = FILES.join("\n");
    expect(joined).toMatch(/docs\/mind-ontology-autopilot-pack-v1\.md/);
    expect(joined).toMatch(/templates\/mind-ontology\/autopilot\/autopilot-blocks\.md/);
    expect(joined).toMatch(/tests\/fixtures\/autopilot-line\/\.agentctx\/constraints\.md/);
  });
});
