import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-principles-applied-v1.md");
const text = () => readFileSync(DOC, "utf8");

describe("autopilot principles applied v1 (A76)", () => {
  it("ships the worked-lane doc", () => {
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
  it("walks one lane and ties each step to a named principle", () => {
    const lower = text().toLowerCase();
    for (const p of [
      "local-first",
      "two read-only tools",
      "right-axis read",
      "mechanical enforcement",
      "safe continuation",
      "opt-in hosted",
    ]) {
      expect(lower, `worked lane omits principle: ${p}`).toContain(p);
    }
  });
  it("shows the risky step re-reads constraints before the destructive write", () => {
    const t = text();
    expect(t).toContain("list_constraints()");
    expect(t.toLowerCase()).toMatch(/before that write|destructive/);
  });
  it("ends a green checkpoint by continuing, not stopping", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/checkpoint, not a finish line/);
    expect(lower).toMatch(/continues to the next adl/);
  });
  it("links the principles and lane lifecycle", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-principles-v1.md");
    expect(t).toContain("mind-ontology-autopilot-lane-lifecycle-v1.md");
  });
});
