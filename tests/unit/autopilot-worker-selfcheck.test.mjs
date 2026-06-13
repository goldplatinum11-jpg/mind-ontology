import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-worker-selfcheck-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot worker self-check v1 (A24)", () => {
  it("ships the worker self-check doc", () => {
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

  it("centres faithful reporting over optimistic closeout", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/faithful reporting/);
    expect(lower).toMatch(/optimistic closeout/);
  });

  it("covers in-scope confirmation, guard pairing, gates, and truthful change list", () => {
    const lower = text().toLowerCase();
    for (const item of ["in-scope", "guard", "gates", "uncommitted changes", "lockfile clean"]) {
      expect(lower, `self-check omits: ${item}`).toContain(item);
    }
  });

  it("repeats the invalid-stop rule so the worker keeps going", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/not.*stop conditions|continue to the next adl/);
    expect(lower).toMatch(/commit denied|tests passed/);
  });

  it("is the explicit mirror of the controller checklist and stays local", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-controller-checklist-v1.md");
    expect(t.toLowerCase()).toMatch(/mirror/);
    expect(t.toLowerCase()).toMatch(/no hosted call|local and mechanical/);
  });
});
