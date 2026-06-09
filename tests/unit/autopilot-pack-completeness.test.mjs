import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOCS = resolve(REPO_ROOT, "docs");
const INDEX = resolve(DOCS, "mind-ontology.md");
const FRAME = "mind-ontology-autopilot-pack-v1.md";

// Auto-discover every autopilot doc so a new one cannot land unindexed/orphaned.
const AUTOPILOT_DOCS = readdirSync(DOCS)
  .filter((f) => /^mind-ontology-autopilot-.*\.md$/.test(f))
  .sort();

const indexText = readFileSync(INDEX, "utf8");

describe("autopilot pack completeness (A25)", () => {
  it("discovers the full set of autopilot docs", () => {
    expect(AUTOPILOT_DOCS).toContain(FRAME);
    expect(AUTOPILOT_DOCS.length).toBeGreaterThanOrEqual(9);
  });

  it.each(AUTOPILOT_DOCS)("%s is linked from the docs index", (doc) => {
    expect(indexText, `index does not link ${doc}`).toContain(doc);
  });

  it.each(AUTOPILOT_DOCS.filter((d) => d !== FRAME))(
    "%s cross-links back to the pack frame",
    (doc) => {
      const text = readFileSync(resolve(DOCS, doc), "utf8");
      expect(text, `${doc} does not link back to the frame`).toContain(FRAME);
    },
  );

  it("the frame is reachable and names itself as the pack entry point", () => {
    const frame = readFileSync(resolve(DOCS, FRAME), "utf8").toLowerCase();
    expect(frame).toContain("autopilot integration pack");
    expect(frame).toMatch(/portable semantic constitution/);
  });

  it("the index's autopilot section keeps the local-first framing", () => {
    const lower = indexText.toLowerCase();
    const idx = lower.indexOf("autopilot integration");
    expect(idx).toBeGreaterThan(-1);
    expect(lower.slice(idx, idx + 400)).toMatch(/local-first|no hosted/);
  });
});
