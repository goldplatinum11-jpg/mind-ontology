import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-versioning-release-checklist-v0.md");

describe("versioning & release checklist (P5-PR05)", () => {
  it("ships the doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("distinguishes breaking from additive and lists a release checklist", () => {
    const text = readFileSync(DOC, "utf8").toLowerCase();
    expect(text).toContain("breaking");
    expect(text).toContain("additive");
    expect(text).toContain("release checklist");
    expect(text).toContain("deprecation");
  });

  it("cites the release-gate commands that exist", () => {
    const text = readFileSync(DOC, "utf8");
    const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));
    for (const script of ["agentctx:smoke", "agentctx:validate"]) {
      expect(text).toContain(script);
      expect(pkg.scripts[script], `cited missing script ${script}`).toBeTruthy();
    }
  });
});
