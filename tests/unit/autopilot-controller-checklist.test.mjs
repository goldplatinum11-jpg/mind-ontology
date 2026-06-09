import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-controller-checklist-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot controller review checklist v1 (A23)", () => {
  it("ships the controller checklist doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("covers the load-bearing review items", () => {
    const lower = text().toLowerCase();
    for (const item of [
      "write scope respected",
      "forbidden_scope_touched",
      "guard",
      "validate",
      "leakage",
      "lockfile clean",
    ]) {
      expect(lower, `checklist omits: ${item}`).toContain(item);
    }
  });

  it("makes forbidden-scope a hard reject, not a fixable nit", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/hard stop|reject/);
  });

  it("frames the review as local/mechanical, no hosted call", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/local and mechanical|mechanical/);
    expect(lower).toMatch(/no hosted sirt call|files alone|without.*hosted/);
  });

  it("cites only npm scripts that exist and links the worker self-check mirror", () => {
    const t = text();
    const PKG = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));
    for (const script of new Set([...t.matchAll(/npm run ([a-z:]+)/g)].map((m) => m[1]))) {
      expect(PKG.scripts, `cited missing script: ${script}`).toHaveProperty(script);
    }
    expect(t).toContain("mind-ontology-autopilot-worker-selfcheck-v1.md");
  });
});
