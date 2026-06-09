import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOCS = resolve(REPO_ROOT, "docs");
const DOC = resolve(DOCS, "mind-ontology-autopilot-common-mistakes-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot common mistakes v1 (A46)", () => {
  it("ships the common-mistakes quick reference", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("lists at least eight mistake -> fix bullets", () => {
    const bullets = (text().match(/\*\*[^*]+\*\*\s*→/g) || []).length;
    expect(bullets).toBeGreaterThanOrEqual(8);
  });

  it("each bullet pairs a mistake with a fix", () => {
    const t = text();
    expect((t.match(/\*Fix:\*/g) || []).length).toBeGreaterThanOrEqual(8);
  });

  it("every linked doc exists (the quick-ref points into the pack)", () => {
    const linked = [...text().matchAll(/\(([a-z0-9-]+\.md)\)/g)].map((m) => m[1]);
    for (const doc of new Set(linked)) {
      expect(existsSync(resolve(DOCS, doc)), `common-mistakes links missing doc: ${doc}`).toBe(true);
    }
  });

  it("condenses the failure-modes doc and links it", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-failure-modes-v1.md");
  });
});
