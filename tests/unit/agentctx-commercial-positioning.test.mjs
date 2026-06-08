import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-commercial-positioning-v0.md");

describe("commercial positioning (P5-PR07)", () => {
  it("ships the positioning doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("draws the open-core line and the free/hosted split", () => {
    const text = readFileSync(DOC, "utf8").toLowerCase();
    expect(text).toContain("open-core");
    expect(text).toContain("free");
    expect(text).toContain("hosted");
    expect(text).toMatch(/stays free forever|free, forever|free forever/);
  });

  it("makes the no-crippleware / opt-in honesty commitments", () => {
    const text = readFileSync(DOC, "utf8").toLowerCase();
    expect(text).toContain("crippleware");
    expect(text).toContain("opt-in");
    expect(text).toMatch(/no surprise lock-in|lock-in/);
  });
});
