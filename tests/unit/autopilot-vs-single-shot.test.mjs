import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-vs-single-shot-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot vs single-shot agent v1 (A45)", () => {
  it("ships the comparison doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("contrasts the two shapes on duration, context, safety, stopping", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/single-shot agent/);
    expect(lower).toMatch(/autopilot runway/);
    expect(lower).toMatch(/re-read per step|re-read.*step/);
    expect(lower).toMatch(/valid terminal boundary|continues until/);
  });

  it("explains why a runway needs the pack — re-reading not one-shot", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/re-reading, not one-shot/);
    expect(lower).toMatch(/continue, don't return|continue, dont return/);
  });

  it("concedes single-shot is right for one-answer tasks", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/single-shot is the right call|simpler, correct choice/);
    expect(lower).toMatch(/does not force a runway/);
  });

  it("links safe-continuation and the lane lifecycle", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-safe-continuation-v1.md");
    expect(t).toContain("mind-ontology-autopilot-lane-lifecycle-v1.md");
  });
});
