import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Consolidated no-leak / placeholder audit for the ENTIRE hosted-connector
// surface (Phase 12). Individual connector tests scan their own files; this one
// walks the whole connector tree + the client-setup manifests so a real endpoint
// or credential cannot slip in via any new file. The connector hosts nothing and
// commits no real host/token — every endpoint is the placeholder.

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SCAN_DIRS = ["connector/worker", "docs/agentctx-setup"];

// Leak vectors that must NEVER be committed in the connector surface:
const WORKERS_DEV = /[a-z0-9-]+\.workers\.dev/i; // the Cloudflare deploy host
const REAL_BEARER = /bearer\s+[A-Za-z0-9._-]{12,}/i; // a real bearer value
const CF_ACCOUNT_ID = /account[_-]?id\s*[:=]\s*["']?[0-9a-f]{16,}/i; // CF account id
const PLACEHOLDER_HOST = "YOUR-CONNECTOR-HOST.example";

function walk(relDir) {
  const out = [];
  const abs = resolve(REPO_ROOT, relDir);
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const childRel = `${relDir}/${entry.name}`;
    const childAbs = resolve(REPO_ROOT, childRel);
    if (statSync(childAbs).isDirectory()) out.push(...walk(childRel));
    else out.push(childRel);
  }
  return out;
}

const FILES = SCAN_DIRS.flatMap(walk);

describe("hosted connector — no-leak / placeholder audit (Phase 12)", () => {
  it("scans a non-trivial set of connector-surface files", () => {
    expect(FILES.length).toBeGreaterThanOrEqual(8);
  });

  it("commits no Cloudflare workers.dev host anywhere in the connector surface", () => {
    for (const f of FILES) {
      expect(readFileSync(resolve(REPO_ROOT, f), "utf8"), `${f} embeds a *.workers.dev host`).not.toMatch(WORKERS_DEV);
    }
  });

  it("commits no real bearer token value", () => {
    for (const f of FILES) {
      expect(readFileSync(resolve(REPO_ROOT, f), "utf8"), `${f} embeds a real bearer token`).not.toMatch(REAL_BEARER);
    }
  });

  it("commits no Cloudflare account id", () => {
    for (const f of FILES) {
      expect(readFileSync(resolve(REPO_ROOT, f), "utf8"), `${f} embeds a Cloudflare account id`).not.toMatch(CF_ACCOUNT_ID);
    }
  });

  it("the client connector endpoints are the placeholder host only", () => {
    for (const m of [
      "docs/agentctx-setup/claude-ai-connector.example.json",
      "docs/agentctx-setup/chatgpt-connector.example.json",
      "docs/agentctx-setup/mind-ontology-connector.openapi.json",
    ]) {
      const raw = readFileSync(resolve(REPO_ROOT, m), "utf8");
      expect(raw, `${m} must use the placeholder host`).toContain(PLACEHOLDER_HOST);
      // Whatever http(s) URL it points at must be the placeholder, not a live host.
      for (const url of raw.match(/https?:\/\/[^\s"'`]+/gi) ?? []) {
        expect(url, `${m} points at a non-placeholder URL: ${url}`).toContain(PLACEHOLDER_HOST);
      }
    }
  });

  it("wrangler.toml.example carries no real account/route/secret value", () => {
    const w = readFileSync(resolve(REPO_ROOT, "connector/worker/wrangler.toml.example"), "utf8");
    expect(w).not.toMatch(/account_id\s*=\s*["'][0-9a-f]/i);
    expect(w).not.toMatch(/^\s*route\s*=\s*["']https?:/im);
    expect(w).not.toMatch(/CONNECTOR_BEARER_TOKEN\s*=\s*["']/);
  });
});
