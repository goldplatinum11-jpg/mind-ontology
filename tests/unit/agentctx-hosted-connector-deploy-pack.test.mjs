import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const WORKER = resolve(REPO_ROOT, "connector/worker");
const read = (rel) => readFileSync(resolve(WORKER, rel), "utf8");

const REAL_URL = /https:\/\/[a-z0-9.-]+\.(workers\.dev|com|net|org|io)\//i;
const BEARER_LITERAL = /bearer\s+[A-Za-z0-9._-]{12,}/i;

describe("hosted connector deploy pack (PR3 — no deploy, no credential)", () => {
  it("commits no real wrangler config or credential files — only the .example template", () => {
    expect(existsSync(resolve(WORKER, "wrangler.toml.example"))).toBe(true);
    for (const forbidden of ["wrangler.toml", ".dev.vars", ".env", ".env.local", "agentctx.snapshot.json"]) {
      expect(existsSync(resolve(WORKER, forbidden)), `${forbidden} must not be committed`).toBe(false);
    }
  });

  it("ships the snapshot build and local smoke scripts via package.json", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.scripts["build:snapshot"]).toMatch(/build-agentctx-snapshot\.mjs/);
    expect(pkg.scripts.smoke).toMatch(/smoke-local\.mjs/);
    expect(existsSync(resolve(WORKER, "scripts/build-agentctx-snapshot.mjs"))).toBe(true);
    expect(existsSync(resolve(WORKER, "scripts/smoke-local.mjs"))).toBe(true);
  });

  it("the local smoke harness drives the connector and performs no real deploy/network", () => {
    const smoke = read("scripts/smoke-local.mjs");
    expect(smoke).toContain("createConnector");
    expect(smoke).toContain("/health");
    expect(smoke).toContain("/mcp");
    expect(smoke).toContain("/get_context");
    // No process spawning, no wrangler/deploy invocation, no real network call in
    // the smoke path (it only exercises the in-process connector handler).
    expect(smoke).not.toMatch(/from\s+["']node:child_process["']|execSync|spawnSync|\bspawn\(|wrangler\s+(deploy|secret)/i);
    expect(smoke).not.toMatch(/fetch\(\s*["']https?:\/\//i);
  });

  it("the deploy pack ships no real endpoint URL or credential value", () => {
    for (const rel of ["README.md", "wrangler.toml.example", "package.json", "scripts/smoke-local.mjs", "scripts/build-agentctx-snapshot.mjs"]) {
      const raw = read(rel);
      expect(raw, `${rel} embeds a real endpoint host`).not.toMatch(REAL_URL);
      expect(raw, `${rel} embeds a real bearer token`).not.toMatch(BEARER_LITERAL);
    }
  });

  it("the README documents operator-only credential setup with placeholders, and never implies the repo hosts a live endpoint", () => {
    const readme = read("README.md");
    // Operator step: bearer as a Worker secret, not committed.
    expect(readme).toContain("CONNECTOR_BEARER_TOKEN");
    expect(readme).toMatch(/never commit|never be committed|not in any committed file/i);
    // Placeholder host only.
    expect(readme).toContain("https://YOUR-CONNECTOR-HOST.example");
    // States the repo hosts nothing.
    expect(readme).toMatch(/repo hosts nothing|operator-gated|out of scope/i);
  });

  it("the wrangler example is a template only (no account id / route / secret)", () => {
    const w = read("wrangler.toml.example");
    expect(w).toMatch(/example only/i);
    expect(w).not.toMatch(/account_id\s*=\s*["'][0-9a-f]{8,}/i);
    expect(w).not.toMatch(/CONNECTOR_BEARER_TOKEN\s*=\s*["']/); // never an inline value
  });
});
