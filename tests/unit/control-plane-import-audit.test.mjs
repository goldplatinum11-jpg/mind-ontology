import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// M34 — prove the product imports NO SIRT operator / control-plane code. The
// standalone extraction excluded scripts/operator, runner/controller/launcher/
// watcher infrastructure, and app src/. This audit fails if any product or test
// module reaches back into that excluded surface.

function jsFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const p = resolve(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(mjs|js|cjs)$/.test(entry.name)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

// import ... from "X"  |  require("X")  |  import("X")
const IMPORT_RE = /(?:import\s[^"';]*from\s*|import\s*|require\s*\(\s*|import\s*\(\s*)["']([^"']+)["']/g;

const FORBIDDEN_IMPORT = /(^|\/)operator(\/|$)|(^|\/)src(\/|$)|runner|controller|launcher|watcher|phase-a-packet/i;

function importsOf(text) {
  const out = [];
  let m;
  while ((m = IMPORT_RE.exec(text)) !== null) out.push(m[1]);
  return out;
}

describe("product imports no SIRT control-plane (M34)", () => {
  it("no scripts/ or tests/ module imports from an excluded control-plane path", () => {
    const offenders = [];
    for (const dir of ["scripts", "tests"]) {
      for (const file of jsFiles(resolve(REPO_ROOT, dir))) {
        for (const spec of importsOf(readFileSync(file, "utf8"))) {
          if (FORBIDDEN_IMPORT.test(spec)) {
            offenders.push(`${relative(REPO_ROOT, file)} imports "${spec}"`);
          }
        }
      }
    }
    expect(offenders, `control-plane imports:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("no package.json script invokes an excluded operator/control-plane script", () => {
    const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));
    for (const [name, cmd] of Object.entries(pkg.scripts ?? {})) {
      expect(/scripts\/operator|phase-a-packet|runner|controller|launcher|watcher/i.test(cmd), `script "${name}" runs control-plane: ${cmd}`).toBe(false);
    }
  });

  it("the scripts/ tree contains no operator/ directory", () => {
    const top = readdirSync(resolve(REPO_ROOT, "scripts"), { withFileTypes: true });
    expect(top.some((e) => e.isDirectory() && e.name === "operator")).toBe(false);
  });
});
