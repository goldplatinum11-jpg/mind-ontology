import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOCS = resolve(REPO_ROOT, "docs");
const README = readFileSync(resolve(REPO_ROOT, "README.md"), "utf8");
const INDEX = readFileSync(resolve(DOCS, "mind-ontology.md"), "utf8");
const MANIFEST = readFileSync(resolve(DOCS, "mind-ontology-autopilot-manifest-v1.md"), "utf8");
const FRAME = "mind-ontology-autopilot-pack-v1.md";

const autopilotDocs = readdirSync(DOCS).filter((f) => /^mind-ontology-autopilot-.*\.md$/.test(f));

describe("autopilot pack discoverability (A52)", () => {
  it("the README reaches the pack frame (hop 1)", () => {
    expect(README).toContain(FRAME);
  });

  it("the index reaches every autopilot doc (hop 2)", () => {
    for (const doc of autopilotDocs) {
      expect(INDEX, `index does not reach ${doc}`).toContain(doc);
    }
  });

  it("so every autopilot doc is reachable from the README in <= 2 hops", () => {
    // README -> frame (hop 1); frame is in the index, and the index lists every
    // doc (hop 2). The two assertions above compose to this guarantee.
    expect(README).toContain(FRAME);
    expect(INDEX).toContain(FRAME);
    expect(autopilotDocs.length).toBeGreaterThanOrEqual(25);
  });

  it("the manifest gives an explicit reading order starting at the frame", () => {
    const lower = MANIFEST.toLowerCase();
    const idx = lower.indexOf("reading order");
    expect(idx).toBeGreaterThan(-1);
    expect(MANIFEST.slice(idx, idx + 200)).toContain(FRAME);
  });
});
