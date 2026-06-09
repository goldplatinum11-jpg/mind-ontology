import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// M2 — distribution stays fail-closed until the OSS license is explicitly chosen.
// These tests are intentionally allowed to fail loudly once a real LICENSE lands:
// when that happens, update package.json to a concrete SPDX id and relax the guard
// in the same change so the boundary moves deliberately, not by accident.
describe("license boundary stays fail-closed (M2)", () => {
  it("documents the fail-closed decision", () => {
    expect(existsSync(resolve(REPO_ROOT, "LICENSE-DECISION.md"))).toBe(true);
    expect(existsSync(resolve(REPO_ROOT, "docs/mind-ontology-license-boundary.md"))).toBe(true);
  });

  it("ships no LICENSE file yet (no accidental OSS grant)", () => {
    for (const name of ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING"]) {
      expect(existsSync(resolve(REPO_ROOT, name)), `unexpected ${name} — set SPDX id and relax this guard deliberately`).toBe(false);
    }
  });

  it("package.json license points at the boundary doc, not an invented SPDX id", () => {
    const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));
    expect(pkg.license).toBe("SEE docs/mind-ontology-license-boundary.md");
    // Guard against a stray concrete identifier sneaking in before the decision.
    expect(/^(MIT|Apache-2\.0|GPL|AGPL|BSD)/i.test(pkg.license)).toBe(false);
  });

  it("LICENSE-DECISION and README agree the state is OPEN / not finalized", () => {
    const decision = readFileSync(resolve(REPO_ROOT, "LICENSE-DECISION.md"), "utf8");
    expect(decision).toContain("fail-closed");
    expect(decision.toLowerCase()).toContain("no oss license has been selected");
    const readme = readFileSync(resolve(REPO_ROOT, "README.md"), "utf8");
    expect(readme.toLowerCase()).toContain("fail-closed");
  });
});
