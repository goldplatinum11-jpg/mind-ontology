import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-reviewer-quickstart-v1.md");
const WALKTHROUGH = resolve(
  REPO_ROOT,
  "docs/mind-ontology-autopilot-result-pack-walkthrough-v1.md",
);
const PKG = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));

const text = () => readFileSync(DOC, "utf8");

// Slice [from, to) by heading text so ordering is measured only inside the
// review-steps section of each doc, not against field listings elsewhere.
const section = (body, from, to) => {
  const start = body.indexOf(from);
  if (start === -1) return "";
  const rest = body.slice(start + from.length);
  const end = to ? rest.indexOf(to) : -1;
  return end === -1 ? rest : rest.slice(0, end);
};

// The canonical controller review sequence, as anchors that appear in both
// docs' review sections. Sorting each section's anchors by first-match index
// must reproduce this exact order.
const REVIEW_ORDER = [
  /forbidden_scope_touched/i,
  /validation/i,
  /guard_test/i,
  /uncommitted_changes/i,
  /stop-state/i,
];

const orderOf = (sectionText) =>
  REVIEW_ORDER.map((re) => ({ re, idx: sectionText.search(re) }))
    .sort((a, b) => a.idx - b.idx)
    .map((e) => e.re.source);

describe("autopilot reviewer quickstart v1 (A72)", () => {
  it("ships the reviewer quickstart doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("gives a five-step review in order, forbidden-scope first", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/forbidden scope first/);
    expect(lower.indexOf("forbidden scope first")).toBeLessThan(lower.indexOf("gates green"));
    expect(lower).toMatch(/re-run one guard/);
    expect(lower).toMatch(/diff matches/);
    expect(lower).toMatch(/stop-state honest/);
  });

  it("cites only npm scripts that exist", () => {
    for (const s of new Set([...text().matchAll(/npm run ([a-z:]+)/g)].map((m) => m[1]))) {
      expect(PKG.scripts, `cited missing script: ${s}`).toHaveProperty(s);
    }
  });

  it("frames the review as mechanical, checking artifacts not narration", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/mechanical/);
    expect(lower).toMatch(/artifacts, not\s+narration/);
  });

  it("links the controller checklist and the walkthrough", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-controller-checklist-v1.md");
    expect(t).toContain("mind-ontology-autopilot-result-pack-walkthrough-v1.md");
  });

  it("presents the same controller review order as the walkthrough reading order", () => {
    // Cross-doc consistency: the quickstart's five-minute review and the
    // walkthrough's "Reading order for a controller" must encode one sequence,
    // so a controller reading either doc follows the same checks in the same
    // order. Each section is sliced and its anchors sorted by position.
    const quickstart = section(text(), "## The five-minute review", "## Why this is fast");
    const walkthrough = section(
      readFileSync(WALKTHROUGH, "utf8"),
      "## Reading order for a controller",
      null,
    );

    expect(quickstart, "quickstart review section not found").not.toBe("");
    expect(walkthrough, "walkthrough reading-order section not found").not.toBe("");

    for (const re of REVIEW_ORDER) {
      expect(quickstart.search(re), `quickstart omits ${re.source}`).toBeGreaterThanOrEqual(0);
      expect(walkthrough.search(re), `walkthrough omits ${re.source}`).toBeGreaterThanOrEqual(0);
    }

    const canonical = REVIEW_ORDER.map((re) => re.source);
    expect(orderOf(quickstart)).toEqual(canonical);
    expect(orderOf(walkthrough)).toEqual(canonical);
  });
});
