import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-lane-lifecycle-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot lane lifecycle v1 (A44)", () => {
  it("ships the lane lifecycle doc", () => {
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

  it("names the five phases in order", () => {
    const lower = text().toLowerCase();
    const order = ["open", "work", "checkpoint", "handoff", "close"];
    let last = -1;
    for (const phase of order) {
      // Headings are "### N. Phase".
      const idx = lower.search(new RegExp(`###\\s*\\d+\\.\\s*${phase}`));
      expect(idx, `phase heading missing/out of order: ${phase}`).toBeGreaterThan(last);
      last = idx;
    }
  });

  it("maps each phase to a governing pack doc", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-reading-protocol-v1.md");
    expect(t).toContain("mind-ontology-autopilot-checkpoint-cadence-v1.md");
    expect(t).toContain("mind-ontology-autopilot-controller-checklist-v1.md");
    expect(t).toContain("mind-ontology-autopilot-stop-policy-v1.md");
  });

  it("distinguishes checkpoint from close (the common mistake)", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/checkpoint is a save point, not a stop|difference between \*checkpoint\* and \*close\*/);
    expect(lower).toMatch(/valid terminal stop/);
  });
});
