import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-line-health-v1.md");
const PKG = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));
const text = () => readFileSync(DOC, "utf8");

describe("autopilot line health signals v1 (A78)", () => {
  it("ships the line-health doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });
  it("gives healthy and drifting signal sets", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/## healthy signals/);
    expect(lower).toMatch(/## drifting signals/);
    expect(lower).toMatch(/guards are green/);
    expect(lower).toMatch(/a guard is red/);
  });
  it("reads signals from local artifacts: guards, Result Pack, diff", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/result pack/);
    expect(lower).toMatch(/forbidden_scope_touched/);
    expect(lower).toMatch(/in scope|allowed write scope/);
  });
  it("cites only npm scripts that exist", () => {
    for (const s of new Set([...text().matchAll(/npm run ([a-z:]+)/g)].map((m) => m[1]))) {
      expect(PKG.scripts, `cited missing script: ${s}`).toHaveProperty(s);
    }
  });
  it("links observability and the reviewer quickstart", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-observability-v1.md");
    expect(t).toContain("mind-ontology-autopilot-reviewer-quickstart-v1.md");
  });
});
