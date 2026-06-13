import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-checkpoint-cadence-v1.md");
const PKG = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));

const text = () => readFileSync(DOC, "utf8");

describe("autopilot checkpoint cadence v1 (A30)", () => {
  it("ships the checkpoint-cadence doc", () => {
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

  it("states the core rule: a checkpoint is not a stop", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/a checkpoint is not a stop|checkpoint is a save point, not a terminal stop/);
    expect(lower).toMatch(/invalid stop conditions|continue/);
  });

  it("covers when to checkpoint and what a checkpoint does", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/coherent batch/);
    expect(lower).toMatch(/bump the\s+checkpoint counter|bump the checkpoint counter/);
    expect(lower).toMatch(/refresh the uncommitted-changes/);
  });

  it("cites only npm scripts that exist", () => {
    for (const script of new Set([...text().matchAll(/npm run ([a-z:]+)/g)].map((m) => m[1]))) {
      expect(PKG.scripts, `cited missing script: ${script}`).toHaveProperty(script);
    }
  });

  it("links the stop policy, result pack, and scope discipline", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-stop-policy-v1.md");
    expect(t).toContain("mind-ontology-autopilot-result-pack-v1.md");
    expect(t).toContain("mind-ontology-autopilot-scope-discipline-v1.md");
  });
});
