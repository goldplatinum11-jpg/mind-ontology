import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => readFileSync(resolve(REPO_ROOT, p), "utf8");
const PKG = JSON.parse(read("package.json"));

// M25 — the proof gate is the smallest viable validation and should be offered
// before the full suite.
describe("validation gates are presented smallest-first (M25)", () => {
  it("agentctx:proof is a single-file gate (fast, local)", () => {
    expect(PKG.scripts["agentctx:proof"]).toBeTruthy();
    expect(PKG.scripts["agentctx:proof"]).toMatch(/agentctx-proof\.test\.mjs/);
    // The full suite runs the whole tests/unit dir; proof runs one file.
    expect(PKG.scripts.test).toMatch(/tests\/unit\b/);
  });

  it("the README presents proof before the full test suite", () => {
    const readme = read("README.md");
    const proofAt = readme.indexOf("agentctx:proof");
    const fullAt = readme.indexOf("npm test");
    expect(proofAt).toBeGreaterThan(-1);
    expect(fullAt).toBeGreaterThan(-1);
    expect(proofAt).toBeLessThan(fullAt);
  });
});

// M24 — the quickstart must tell users when to run the acceptance smoke and
// reflect the real source surface.
describe("quickstart documents the smoke gate and real source files (M24)", () => {
  it("names agentctx:smoke and frames it as a one-command confidence check", () => {
    const qs = read("docs/mind-ontology-quickstart.md");
    expect(qs).toContain("agentctx:smoke");
    expect(qs.toLowerCase()).toContain("acceptance smoke");
    expect(PKG.scripts["agentctx:smoke"]).toBeTruthy();
  });

  it("lists the expanded source surface, not just the original four files", () => {
    const qs = read("docs/mind-ontology-quickstart.md");
    for (const f of ["cq.md", "identity.md", "agent-roles.md", "projects.md", "glossary.md"]) {
      expect(qs, `quickstart omits ${f}`).toContain(f);
    }
  });

  it("documents what the metrics mean (M23 doc)", () => {
    const qs = read("docs/mind-ontology-quickstart.md");
    expect(qs).toContain("selection ratio");
    expect(qs).toContain("agentctx:metrics");
  });
});
