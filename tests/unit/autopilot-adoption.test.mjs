import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-adoption-v1.md");
const PKG = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));

const text = () => readFileSync(DOC, "utf8");

describe("autopilot adoption walkthrough v1 (A8)", () => {
  it("ships the adoption walkthrough doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("pins the top-of-doc Autopilot Integration Pack header back-link", () => {
    // The pack header back-link lives in the doc header, above the first
    // horizontal rule. Pin it structurally (scoped to the header, with the
    // exact link target) so the A-series pack frame can't silently drop off
    // the top of this doc without its owning public-surface test failing.
    const header = text().split("\n---")[0];
    expect(header).toContain(
      "Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).",
    );
  });

  it("walks the wiring sequence: scaffold, paste blocks, wire MCP, instruct, call, verify", () => {
    const lower = text().toLowerCase();
    for (const step of ["scaffold", "autopilot blocks", "wire the mcp", "one-line instruction", "first context call", "verify"]) {
      expect(lower, `missing step: ${step}`).toContain(step);
    }
  });

  it("only cites npm scripts that actually exist in package.json", () => {
    const cited = [...text().matchAll(/npm run ([a-z:]+)/g)].map((m) => m[1]);
    expect(cited.length).toBeGreaterThan(0);
    for (const script of cited) {
      expect(PKG.scripts, `cited missing script: ${script}`).toHaveProperty(script);
    }
  });

  it("keeps the two-tool surface and the canonical MCP entry", () => {
    const t = text();
    expect(t).toContain("get_context");
    expect(t).toContain("list_constraints");
    expect(t).toContain("scripts/agentctx/mcp-server.mjs");
  });

  it("makes the no-account / no-network / no-hosted promise explicit", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/no account/);
    expect(lower).toMatch(/no network/);
    expect(lower).toMatch(/off by default|fail-closed|opt-in/);
  });
});
