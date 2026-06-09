import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// Every artifact that makes up the Autopilot Integration Pack v1.
const PACK_ARTIFACTS = [
  "docs/mind-ontology-autopilot-pack-v1.md",
  "docs/mind-ontology-autopilot-reading-protocol-v1.md",
  "docs/mind-ontology-autopilot-stop-policy-v1.md",
  "templates/mind-ontology/autopilot/autopilot-blocks.md",
];

const read = (rel) => readFileSync(resolve(REPO_ROOT, rel), "utf8");

describe("autopilot pack v1 cross-artifact consistency (A5)", () => {
  it("every pack artifact exists", () => {
    for (const rel of PACK_ARTIFACTS) {
      expect(existsSync(resolve(REPO_ROOT, rel)), `${rel} missing`).toBe(true);
    }
  });

  it("no artifact embeds a hosted endpoint, credential, or private clone path", () => {
    for (const rel of PACK_ARTIFACTS) {
      const lower = read(rel).toLowerCase();
      expect(lower, `${rel} leaks a host`).not.toMatch(/sirtai\.org|workers\.dev/);
      expect(lower, `${rel} leaks a secret`).not.toMatch(/bearer [a-z0-9]|authorization:\s*\S/);
      expect(lower, `${rel} leaks a private path`).not.toContain("sirt-app-v2");
    }
  });

  it("every artifact stays on the two read-only tools as its only surface", () => {
    for (const rel of PACK_ARTIFACTS) {
      const text = read(rel);
      expect(text, `${rel} omits get_context`).toContain("get_context");
      expect(text, `${rel} omits list_constraints`).toContain("list_constraints");
    }
  });

  it("no artifact re-frames Mind Ontology as a memory app", () => {
    // The wrong-axis failure is calling the constitution a memory app. An
    // artifact may *mention* the phrase only to reject it.
    for (const rel of PACK_ARTIFACTS) {
      const lower = read(rel).toLowerCase();
      const idx = lower.indexOf("memory app");
      if (idx === -1) continue;
      const window = lower.slice(Math.max(0, idx - 40), idx);
      expect(window, `${rel} affirms the memory-app framing`).toMatch(/not|never|isn't|is not/);
    }
  });

  it("the three docs cross-link to each other (anti-drift web)", () => {
    const frame = read("docs/mind-ontology-autopilot-pack-v1.md");
    const protocol = read("docs/mind-ontology-autopilot-reading-protocol-v1.md");
    const stop = read("docs/mind-ontology-autopilot-stop-policy-v1.md");
    expect(protocol).toContain("mind-ontology-autopilot-pack-v1.md");
    expect(stop).toContain("mind-ontology-autopilot-pack-v1.md");
    expect(frame).toMatch(/reading-protocol|stop-policy/);
  });
});
