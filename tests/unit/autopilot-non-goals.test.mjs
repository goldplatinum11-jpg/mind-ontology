import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-non-goals-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot pack non-goals v1 (A53)", () => {
  it("ships the non-goals doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("names the deliberate non-goals", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/store\s+durable memory/);
    expect(lower).toMatch(/provide\s+a write path/);
    expect(lower).toMatch(/graph\s+or vector store/);
    expect(lower).toMatch(/autonomy controller/);
    expect(lower).toMatch(/require\s+a hosted dependency/);
    expect(lower).toMatch(/add\s+a third tool/);
  });

  it("frames each non-goal as a deliberate boundary, not a missing feature", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/deliberately does not|deliberate boundary/);
    expect(lower).toMatch(/none is a missing feature|not a missing feature/);
  });

  it("links the two-tool contract and the manifest", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-two-tool-contract-v1.md");
    expect(t).toContain("mind-ontology-autopilot-manifest-v1.md");
  });
});
