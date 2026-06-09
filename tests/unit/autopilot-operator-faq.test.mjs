import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOCS = resolve(REPO_ROOT, "docs");
const DOC = resolve(DOCS, "mind-ontology-autopilot-operator-faq-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot operator FAQ v1 (A42)", () => {
  it("ships the operator FAQ doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("answers the load-bearing pre-wiring questions", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/do i need an account/);
    expect(lower).toMatch(/what can the agent actually do/);
    expect(lower).toMatch(/when does the line stop/);
    expect(lower).toMatch(/how do i review/);
  });

  it("every linked answer doc actually exists (FAQ is a map into the pack)", () => {
    const linked = [...text().matchAll(/\(([a-z0-9-]+\.md)\)/g)].map((m) => m[1]);
    expect(linked.length).toBeGreaterThanOrEqual(6);
    for (const doc of new Set(linked)) {
      expect(existsSync(resolve(DOCS, doc)), `FAQ links missing doc: ${doc}`).toBe(true);
    }
  });

  it("keeps the no-account / no hosted framing", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/no hosted sirt account|local and file-based|no account/);
  });
});
