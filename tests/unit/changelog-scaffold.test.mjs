import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => readFileSync(resolve(REPO_ROOT, p), "utf8");

// M49 — a Keep-a-Changelog scaffold that stays honest while pre-release.
describe("CHANGELOG scaffold (M49)", () => {
  it("ships in Keep a Changelog format with an Unreleased section", () => {
    expect(existsSync(resolve(REPO_ROOT, "CHANGELOG.md"))).toBe(true);
    const c = read("CHANGELOG.md");
    expect(c.toLowerCase()).toContain("keep a changelog");
    expect(c).toContain("## [Unreleased]");
  });

  it("ties versioning to the additive-vs-breaking policy", () => {
    const c = read("CHANGELOG.md");
    expect(c).toContain("mind-ontology-versioning-release-checklist-v0.md");
    expect(c.toLowerCase()).toContain("breaking");
    expect(c.toLowerCase()).toContain("additive");
    expect(c.toLowerCase()).toContain("semantic versioning");
  });

  it("does not claim a published release while pre-release/unlicensed", () => {
    const c = read("CHANGELOG.md");
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.version).toBe("0.0.0");
    expect(pkg.private).toBe(true);
    // No dated release headings like "## [1.0.0] - 2026-..." yet.
    expect(/^##\s*\[\d+\.\d+\.\d+\]/m.test(c)).toBe(false);
    expect(c.toLowerCase()).toContain("pre-release");
  });
});
