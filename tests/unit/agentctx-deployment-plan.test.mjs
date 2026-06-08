import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-selfhost-deployment-plan-v0.md");

describe("self-host deployment plan (P3-PR06)", () => {
  it("ships the deployment plan doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("is plan-only and states it adds no runtime/secret", () => {
    const text = readFileSync(DOC, "utf8");
    expect(text).toContain("PLAN ONLY");
    expect(text.toLowerCase()).toContain("ships no runtime");
    expect(text.toLowerCase()).toMatch(/no secret|never committed/);
  });

  it("keeps the read-only two-operation boundary", () => {
    const text = readFileSync(DOC, "utf8");
    expect(text).toContain("get_context");
    expect(text).toContain("list_constraints");
    expect(text.toLowerCase()).toContain("read-only");
  });

  it("does NOT introduce any wrangler/deploy config file in the repo", () => {
    // Guard the hard-stop: this lane must not add a Worker config alongside the doc.
    expect(existsSync(resolve(REPO_ROOT, "wrangler.connector.toml"))).toBe(false);
    expect(existsSync(resolve(REPO_ROOT, "connector"))).toBe(false);
  });
});
