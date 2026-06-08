import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-thin-connector-strategy-v0.md");

describe("thin connector strategy (P3-PR04)", () => {
  it("ships the strategy doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("pins the boundary decisions that later HTTP/deploy lanes depend on", () => {
    const text = readFileSync(DOC, "utf8").toLowerCase();
    // The same two operations, no new capability.
    expect(text).toContain("get_context");
    expect(text).toContain("list_constraints");
    // Both hosted surfaces.
    expect(text).toContain("remote");
    expect(text).toContain("gpt action");
    // Core safety boundary.
    expect(text).toContain("read-only");
    expect(text).toContain("self-hosted");
    expect(text).toMatch(/no credential|no secret|without credential/);
  });

  it("defers HTTP design and deployment to later lanes", () => {
    const text = readFileSync(DOC, "utf8");
    expect(text).toContain("P3-PR05");
    expect(text).toContain("P3-PR06");
  });
});
