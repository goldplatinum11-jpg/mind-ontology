import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-reviewer-quickstart-v1.md");
const PKG = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));

const text = () => readFileSync(DOC, "utf8");

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
});
