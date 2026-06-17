import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-result-pack-v1.md");

const text = () => readFileSync(DOC, "utf8");

// Direct public-surface owner test for the Result Pack shape doc.
//
// The doc already has two owners: the A14 shape guard pins its documented
// surface against the example fixture, and the A31 walkthrough pins the
// annotated example. Neither held the doc's own top-of-doc pack header
// back-link, so the A25 aggregate owner-test coverage carried this doc in its
// shrink-only KNOWN_PENDING ledger. This is the direct owner test the A25 rule
// derives by slug (result-pack -> autopilot-result-pack.test.mjs); pinning the
// exact header link here is what lets that ledger entry be delisted.
describe("autopilot result-pack doc — top-of-doc pack header (A25)", () => {
  it("ships the result-pack shape doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("pins the top-of-doc Autopilot Integration Pack header back-link", () => {
    // Scope the assertion to the doc header (above the first horizontal rule)
    // and hold the exact link target, so the A-series pack frame can't silently
    // drop off the top of this doc without its direct owner test failing.
    const header = text().split("\n---")[0];
    expect(header).toContain(
      "Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).",
    );
  });

  it("keeps the local-first, no-hosted-ingest framing", () => {
    const t = text();
    expect(t).toContain("machine-checkable with local tools alone");
    expect(t).toContain("no hosted SIRT ingest is required");
  });

  it("documents the clean-handoff scope invariant", () => {
    const t = text();
    expect(t).toContain("forbidden_scope_touched");
    expect(t).toMatch(/must be `false`/);
  });

  it("names the shared runtime guard and its location", () => {
    const t = text();
    expect(t).toContain("validateResultPack");
    expect(t).toContain("scripts/agentctx/result-pack.mjs");
  });

  it("points at its sibling shape test and example fixture", () => {
    const t = text();
    expect(t).toContain("tests/unit/autopilot-result-pack-shape.test.mjs");
    expect(t).toContain("tests/fixtures/autopilot-result-pack.example.json");
  });
});
