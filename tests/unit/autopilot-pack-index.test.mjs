import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const INDEX = resolve(REPO_ROOT, "docs/mind-ontology.md");

describe("autopilot pack is discoverable from the docs index (A6)", () => {
  it("the docs index links the three autopilot docs so they are not orphans", () => {
    const text = readFileSync(INDEX, "utf8");
    expect(text).toContain("mind-ontology-autopilot-pack-v1.md");
    expect(text).toContain("mind-ontology-autopilot-reading-protocol-v1.md");
    expect(text).toContain("mind-ontology-autopilot-stop-policy-v1.md");
  });

  it("the index frames the autopilot pack as local-first / no hosted SIRT", () => {
    const text = readFileSync(INDEX, "utf8").toLowerCase();
    const idx = text.indexOf("autopilot integration");
    expect(idx).toBeGreaterThan(-1);
    // The section blurb keeps the local-first framing near the heading.
    const section = text.slice(idx, idx + 400);
    expect(section).toMatch(/local-first|no hosted/);
  });
});
