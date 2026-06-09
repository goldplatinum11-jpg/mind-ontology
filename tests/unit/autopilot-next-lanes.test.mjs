import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const NEXT = resolve(REPO_ROOT, "NEXT-LANES.md");

const text = () => readFileSync(NEXT, "utf8");

describe("autopilot pack is recorded in NEXT-LANES (A12)", () => {
  it("NEXT-LANES has an autopilot integration pack section", () => {
    expect(text().toLowerCase()).toContain("autopilot integration pack");
  });

  it("the section links the autopilot docs it shipped", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-pack-v1.md");
    expect(t).toContain("mind-ontology-autopilot-reading-protocol-v1.md");
    expect(t).toContain("mind-ontology-autopilot-stop-policy-v1.md");
    expect(t).toContain("mind-ontology-autopilot-adoption-v1.md");
  });

  it("every doc the section links actually exists on disk (no dangling lane refs)", () => {
    const linked = [...text().matchAll(/docs\/([a-z0-9-]+\.md)/g)].map((m) => m[1]);
    expect(linked.length).toBeGreaterThan(0);
    for (const doc of new Set(linked)) {
      expect(existsSync(resolve(REPO_ROOT, "docs", doc)), `missing linked doc: ${doc}`).toBe(true);
    }
  });

  it("keeps the docs/tests-only, local-first framing for the follow-on lanes", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/local-first|no hosted sirt/);
    expect(lower).toMatch(/docs\/tests only|docs\/tests\/fixtures/);
  });
});
