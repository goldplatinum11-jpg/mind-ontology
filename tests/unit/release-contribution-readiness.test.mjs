import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => readFileSync(resolve(REPO_ROOT, p), "utf8");
const PKG = JSON.parse(read("package.json"));

// M26 — CONTRIBUTING is actionable AND keeps the license boundary fail-closed.
describe("CONTRIBUTING is ready and license-safe (M26)", () => {
  it("ships and cites the real local gates", () => {
    expect(existsSync(resolve(REPO_ROOT, "CONTRIBUTING.md"))).toBe(true);
    const c = read("CONTRIBUTING.md");
    for (const gate of ["agentctx:proof", "agentctx:validate", "agentctx:smoke", "npm test"]) {
      expect(c).toContain(gate);
      if (gate.startsWith("agentctx:")) expect(PKG.scripts[gate]).toBeTruthy();
    }
  });

  it("states the decided Apache-2.0 license and keeps publish gated", () => {
    const c = read("CONTRIBUTING.md").toLowerCase();
    expect(c).toContain("apache-2.0");
    expect(c).toContain("operator"); // publishing requires the explicit operator release decision
  });

  it("references no forbidden source repo", () => {
    for (const f of ["CONTRIBUTING.md", "RELEASE-CHECKLIST.md"]) {
      expect(read(f)).not.toMatch(/sirt-app-v2|sirt-codex-clones/);
    }
  });
});

// M27 — release checklist exists and points at gates that exist.
describe("release checklist is concrete (M27)", () => {
  it("ships and lists the validate/smoke gates plus the license block", () => {
    expect(existsSync(resolve(REPO_ROOT, "RELEASE-CHECKLIST.md"))).toBe(true);
    const r = read("RELEASE-CHECKLIST.md");
    expect(r).toContain("agentctx:smoke");
    expect(r).toContain("agentctx:validate");
    expect(r.toLowerCase()).toContain("fail-closed");
    expect(r).toContain("LICENSE"); // distribution gate names the license blocker
  });
});

// M28 — self-host deployment stays operator-owned; no live deploy is shipped or instructed as run.
describe("self-host deployment stays operator-owned (M28)", () => {
  it("the deployment plan distinguishes connector source from wrangler/deploy", () => {
    const d = read("docs/mind-ontology-selfhost-deployment-plan-v0.md");
    expect(d).toMatch(/deployment plan, not a deployment|deployment is still operator-owned/i);
    expect(d).toContain("connector/worker/");
    expect(d.toLowerCase()).not.toContain("no worker source");
    expect(d.toLowerCase()).toMatch(/no real `wrangler\.toml`|no live endpoint/);
    // wrangler/deploy appear only as out-of-scope, operator-later actions.
    expect(d).toMatch(/out of scope|operator executes later|operator explicitly deploys/i);
  });

  it("the quickstart tells users no deploy is required for the local path", () => {
    const qs = read("docs/mind-ontology-quickstart.md").toLowerCase();
    expect(qs).toContain("deploy");
    expect(qs).toMatch(/no hosted sirt account, database, deploy|do not run deploy/);
  });
});

// M29 — README states open-core positioning without overselling or claiming hosted availability.
describe("commercial positioning is honest (M29)", () => {
  it("frames open-core, local-first, hosted-closed without claiming hosted is available", () => {
    const readme = read("README.md");
    expect(readme).toContain("## Positioning");
    expect(readme.toLowerCase()).toContain("open-core");
    expect(readme.toLowerCase()).toContain("local-first");
    expect(readme).toMatch(/closed|not part of this repository/);
    // No claim that hosted SIRT is live/available now.
    expect(readme.toLowerCase()).not.toMatch(/hosted sirt is (now )?available/);
  });
});

// M30 — the worked examples include an end-to-end MCP transport example.
describe("public examples cover the MCP transport (M30)", () => {
  it("documents an MCP round-trip backed by the smoke test", () => {
    const ex = read("docs/mind-ontology-quickstart-examples-v0.md");
    expect(ex).toContain("agentctx:mcp");
    expect(ex).toContain("tools/list");
    expect(ex).toContain("mcp-server-smoke.test.mjs");
    expect(existsSync(resolve(REPO_ROOT, "tests/unit/mcp-server-smoke.test.mjs"))).toBe(true);
  });
});
