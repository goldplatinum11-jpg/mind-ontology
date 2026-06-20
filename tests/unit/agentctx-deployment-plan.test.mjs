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

  it("introduces no REAL wrangler/deploy config or committed secret (PR1 connector is example-only)", () => {
    // P3-PR06 (this plan doc) was plan-only and forbade a connector dir entirely.
    // The hosted connector lands in PR1 (connector/worker/ — see the
    // agentctx-hosted-connector-*.test.mjs suites), so the connector dir now
    // exists. The hard-stop that still holds: PR1 adds NO real deploy config and
    // NO committed secret — only a wrangler.toml.example template.
    expect(existsSync(resolve(REPO_ROOT, "wrangler.connector.toml"))).toBe(false);
    expect(existsSync(resolve(REPO_ROOT, "connector/worker/wrangler.toml"))).toBe(false);
    expect(existsSync(resolve(REPO_ROOT, "connector/worker/wrangler.toml.example"))).toBe(true);
  });
});
