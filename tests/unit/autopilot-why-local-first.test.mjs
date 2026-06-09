import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-why-local-first-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot why local-first v1 (A43)", () => {
  it("ships the why-local-first doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("defines local-first and its benefits for a line", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/local-first means/);
    for (const benefit of ["trustable", "portable", "versioned", "cheap", "fail-safe"]) {
      expect(lower, `missing benefit: ${benefit}`).toContain(benefit);
    }
  });

  it("frames hosted as an opt-in add-on, not a prerequisite", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/optional,\s+fail-closed/);
    expect(lower).toMatch(/opt into|not a prerequisite|never required/);
  });

  it("links the spectrum and the two-tool rationale", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-minimal-vs-full-v1.md");
    expect(t).toContain("mind-ontology-autopilot-two-tool-vs-many-v1.md");
  });
});
