import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-hosted-auth-tenant-boundary-v0.md");

describe("hosted auth & tenant boundary (P4-PR04)", () => {
  it("ships the boundary doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("pins the OSS-side guarantees that later lanes depend on", () => {
    const text = readFileSync(DOC, "utf8").toLowerCase();
    expect(text).toContain("fail-closed");
    expect(text).toContain("one workspace per credential");
    expect(text).toMatch(/no credential|holds.*no.*credential|never committed/);
    expect(text).toContain("local-first");
  });

  it("carries no real credential or endpoint value", () => {
    const raw = readFileSync(DOC, "utf8");
    expect(raw).not.toMatch(/\bbearer\s+[A-Za-z0-9._-]{12,}/i);
    expect(raw).not.toMatch(/https:\/\/[a-z0-9-]+\.workers\.dev/i);
  });
});
