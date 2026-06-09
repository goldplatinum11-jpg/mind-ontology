import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-stop-policy-v1.md");
const TABLE = resolve(REPO_ROOT, "tests/fixtures/autopilot-stop-cases.json");

const cases = JSON.parse(readFileSync(TABLE, "utf8"));
const docLower = readFileSync(DOC, "utf8").toLowerCase();

// Split the doc at the invalid-conditions heading so we can prove each case
// lands on the correct side, not merely somewhere in the file.
const splitIdx = docLower.indexOf("## invalid stop conditions");
const validSection = docLower.slice(0, splitIdx);
const invalidSection = docLower.slice(splitIdx);

describe("autopilot stop-policy decision table (A11)", () => {
  it("the table is non-trivial on both sides", () => {
    expect(cases.valid_terminal_stops.length).toBeGreaterThanOrEqual(8);
    expect(cases.invalid_stops.length).toBeGreaterThanOrEqual(8);
  });

  it.each(cases.valid_terminal_stops)("valid stop '$id' appears in the doc's valid section", ({ doc_match }) => {
    expect(validSection).toContain(doc_match.toLowerCase());
  });

  it.each(cases.invalid_stops)("invalid stop '$id' appears in the doc's invalid section", ({ doc_match }) => {
    expect(invalidSection).toContain(doc_match.toLowerCase());
  });

  it("valid and invalid ids are disjoint (no condition is both)", () => {
    const validIds = new Set(cases.valid_terminal_stops.map((c) => c.id));
    const invalidIds = cases.invalid_stops.map((c) => c.id);
    for (const id of invalidIds) {
      expect(validIds.has(id), `${id} is classified both valid and invalid`).toBe(false);
    }
  });

  it("the doc splits cleanly into a valid and an invalid section", () => {
    expect(splitIdx).toBeGreaterThan(0);
    expect(validSection).toContain("## valid terminal stop conditions");
  });
});
