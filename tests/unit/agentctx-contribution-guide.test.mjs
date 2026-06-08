import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-contribution-guide-plan-v0.md");

describe("contribution guide plan (P5-PR06)", () => {
  it("ships the contribution guide", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("states the core contribution principles", () => {
    const text = readFileSync(DOC, "utf8").toLowerCase();
    expect(text).toContain("structure before code");
    expect(text).toContain("one bounded pr per lane");
    expect(text).toContain("every change ships a test");
    expect(text).toMatch(/no secret|credential-free/);
  });

  it("cites a local gate of commands that exist", () => {
    const text = readFileSync(DOC, "utf8");
    const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));
    for (const script of ["agentctx:smoke", "agentctx:validate"]) {
      expect(text).toContain(script);
      expect(pkg.scripts[script]).toBeTruthy();
    }
  });
});
