import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-trust-security-model-v0.md");

describe("trust & security model (P5-PR04)", () => {
  it("ships the trust & security doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("states each core property", () => {
    const text = readFileSync(DOC, "utf8").toLowerCase();
    for (const property of ["local-first", "read-only", "fail-closed", "opt-in", "proposal-only", "risk-aware"]) {
      expect(text, `missing property: ${property}`).toContain(property);
    }
  });

  it("references the enforcing tests/tools so the claims are backed", () => {
    const text = readFileSync(DOC, "utf8");
    expect(text).toContain("agentctx-no-leakage-audit");
    expect(text).toContain("agentctx:validate");
  });

  it("the enforcing artifacts it cites actually exist", () => {
    expect(existsSync(resolve(REPO_ROOT, "tests/unit/agentctx-no-leakage-audit.test.mjs"))).toBe(true);
    const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));
    expect(pkg.scripts["agentctx:validate"]).toBeTruthy();
  });
});
