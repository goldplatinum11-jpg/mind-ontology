import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-when-not-to-use-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot when-not-to-use v1 (A68)", () => {
  it("ships the when-not-to-use doc", () => {
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

  it("names the skip-the-pack cases", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/single-shot task/);
    expect(lower).toMatch(/no autonomous line/);
    expect(lower).toMatch(/no shared meaning/);
    expect(lower).toMatch(/purely exploratory|throwaway prototype/);
  });

  it("balances with the use-the-pack conditions", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/use the pack when/);
    expect(lower).toMatch(/multiple agents|long runway/);
    expect(lower).toMatch(/safety floor must be guaranteed/);
  });

  it("explains why honesty about fit matters", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/fits? everything fits nothing|honest about its shape/);
  });

  it("links vs-single-shot and non-goals", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-vs-single-shot-v1.md");
    expect(t).toContain("mind-ontology-autopilot-non-goals-v1.md");
  });
});
