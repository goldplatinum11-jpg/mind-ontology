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

  it("pins the load-bearing in-scope / hosted-SIRT scoping rule", () => {
    // Whitespace-normalized so the rule survives the doc's line wrapping.
    const text = readFileSync(DOC, "utf8").replace(/\s+/g, " ");
    // Local + file-based is in scope; the four hosted criteria stay out. The
    // loose `stays out` match elsewhere would survive a weakening of these
    // criteria — this pins each one so the boundary cannot quietly soften.
    expect(text).toContain("anything local and file-based is in scope");
    expect(text).toContain(
      "running a service, storing data, executing writes, or isolating tenants",
    );
    expect(text).toContain("hosted SIRT and stays out");
  });

  it("pins the no-SIRT-dependency portability guarantee", () => {
    const text = readFileSync(DOC, "utf8").replace(/\s+/g, " ");
    // The pack must compile and ship with zero hosted coupling.
    expect(text).toContain(
      "compiles and ships without any SIRT package, endpoint, credential, or network call",
    );
  });
});
