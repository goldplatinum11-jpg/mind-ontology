import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-pack-v1.md");

describe("autopilot pack v1 frame (A1)", () => {
  it("ships the autopilot pack frame doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("names Mind Ontology as a portable semantic constitution, not a memory app", () => {
    const text = readFileSync(DOC, "utf8").toLowerCase();
    expect(text).toContain("portable semantic constitution");
    // The frame must explicitly reject the memory-app framing.
    expect(text).toContain("not a memory app");
    expect(text).toMatch(/context compiler/);
  });

  it("draws the SIRT Brain and SIRT Runway boundary as hosted, out-of-pack layers", () => {
    const text = readFileSync(DOC, "utf8").toLowerCase();
    expect(text).toContain("sirt brain");
    expect(text).toContain("sirt runway");
    // Both hosted layers are described but never imported/embedded.
    expect(text).toMatch(/described only|never import|not import|stays out/);
  });

  it("commits to local-first, no-hosted-dependency operation", () => {
    const text = readFileSync(DOC, "utf8").toLowerCase();
    expect(text).toContain("local-first");
    expect(text).toMatch(/no account/);
    expect(text).toMatch(/off[- ]by[- ]default|fail-closed/);
  });

  it("names the two read-only tools that every agent line shares", () => {
    const text = readFileSync(DOC, "utf8");
    expect(text).toContain("get_context");
    expect(text).toContain("list_constraints");
  });
});
