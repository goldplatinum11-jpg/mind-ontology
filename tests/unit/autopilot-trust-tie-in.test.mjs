import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-trust-tie-in-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot trust tie-in v1 (A41)", () => {
  it("ships the trust tie-in doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("ties trust to a small auditable surface and no hidden data flow", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/auditable/);
    expect(lower).toMatch(/no hidden data flow/);
    expect(lower).toMatch(/fail-closed/);
  });

  it("names the trust-breaks each closed by a guard", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/a write tool in the surface/);
    expect(lower).toMatch(/a hidden network call/);
    expect(lower).toMatch(/a credential in the repo/);
  });

  it("links the product trust model and the two-tool docs", () => {
    const t = text();
    expect(t).toContain("mind-ontology-trust-security-model-v0.md");
    expect(t).toContain("mind-ontology-autopilot-two-tool-contract-v1.md");
  });
});
