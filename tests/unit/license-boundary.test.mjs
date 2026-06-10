import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => readFileSync(resolve(REPO_ROOT, p), "utf8");

// License DECIDED (2026-06-09): Apache-2.0. This guard now pins the landed
// license posture. Distribution is still gated separately (`private` stays true).
describe("license is landed as Apache-2.0", () => {
  it("ships the canonical Apache-2.0 LICENSE and a NOTICE", () => {
    expect(existsSync(resolve(REPO_ROOT, "LICENSE"))).toBe(true);
    const license = read("LICENSE");
    expect(license).toContain("Apache License");
    expect(license).toContain("Version 2.0");
    expect(existsSync(resolve(REPO_ROOT, "NOTICE"))).toBe(true);
  });

  it("package.json declares the Apache-2.0 SPDX id", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.license).toBe("Apache-2.0");
  });

  it("the decision doc and boundary doc agree on Apache-2.0", () => {
    const decision = read("LICENSE-DECISION.md");
    expect(decision).toContain("DECIDED");
    expect(decision).toContain("Apache-2.0");
    expect(existsSync(resolve(REPO_ROOT, "docs/mind-ontology-license-boundary.md"))).toBe(true);
  });

  it("publishing stays gated even though the license is chosen", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.private).toBe(true); // npm publish still refuses
    expect(pkg.version).toBe("0.1.0"); // first release prepared, unpublished
  });
});
