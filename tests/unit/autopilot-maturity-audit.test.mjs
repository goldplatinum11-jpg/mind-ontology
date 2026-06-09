import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-maturity-audit-v1.md");

const text = () => readFileSync(DOC, "utf8");

// Pull every guard-test path the audit table cites.
function citedGuards() {
  return [...text().matchAll(/`(tests\/unit\/[a-z0-9-]+\.test\.mjs)`/g)].map((m) => m[1]);
}

describe("autopilot pack maturity self-audit v1 (A64)", () => {
  it("ships the maturity-audit doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("enumerates at least eight structural guarantees", () => {
    // Table rows shaped "| N | guarantee | `test` |".
    const rows = (text().match(/^\|\s*\d+\s*\|/gm) || []).length;
    expect(rows).toBeGreaterThanOrEqual(8);
  });

  it("every guard test the audit cites actually exists on disk", () => {
    const guards = citedGuards();
    expect(guards.length).toBeGreaterThanOrEqual(8);
    for (const g of new Set(guards)) {
      expect(existsSync(resolve(REPO_ROOT, g)), `audit cites missing guard: ${g}`).toBe(true);
    }
  });

  it("frames maturity as the inability to drift, mechanically enforced", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/inability to drift/);
    expect(lower).toMatch(/mechanically enforced/);
  });

  it("links versioning and extending", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-versioning-v1.md");
    expect(t).toContain("mind-ontology-autopilot-extending-v1.md");
  });
});
