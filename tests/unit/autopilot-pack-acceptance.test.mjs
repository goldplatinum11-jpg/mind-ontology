import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileFromCwd } from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOCS = resolve(REPO_ROOT, "docs");
const TESTS = resolve(REPO_ROOT, "tests/unit");
const FIXTURES = resolve(REPO_ROOT, "tests/fixtures");
const MANIFEST = resolve(DOCS, "mind-ontology-autopilot-manifest-v1.md");

const FIXTURE_DIRS = ["autopilot-line", "autopilot-roles", "autopilot-minimal"];

function pack(fixture, task, riskMode) {
  return JSON.parse(
    compileFromCwd({ cwd: resolve(FIXTURES, fixture), task, scopes: [], format: "json", riskMode }),
  );
}

describe("autopilot pack acceptance — fixtures compile clean (A40)", () => {
  it.each(FIXTURE_DIRS)("%s compiles a valid pack with the safety floor", (fixture) => {
    const p = pack(fixture, "Plan the next lane step");
    expect(Array.isArray(p.selected)).toBe(true);
    expect(p.selected.length).toBeGreaterThan(0);
    expect(p.selected.map((b) => b.file)).toContain("constraints.md");
  });

  it.each(FIXTURE_DIRS)("%s classifies a destructive task as risky", (fixture) => {
    const p = pack(fixture, "Delete the production database and drop the orders table");
    expect(p.risk.level).toBe("risky");
  });

  it("no fixture pack emits a hosted endpoint or secret", () => {
    for (const fixture of FIXTURE_DIRS) {
      const blob = JSON.stringify(pack(fixture, "Plan the lane")).toLowerCase();
      expect(blob, `${fixture} leaks`).not.toMatch(/sirtai\.org|workers\.dev|bearer /);
    }
  });
});

describe("autopilot pack self-consistency (A40)", () => {
  const autopilotDocs = readdirSync(DOCS).filter((f) => /^mind-ontology-autopilot-.*\.md$/.test(f));
  const autopilotTests = readdirSync(TESTS).filter((f) => /^autopilot-.*\.test\.mjs$/.test(f));

  it("there are at least as many autopilot guard tests as autopilot docs", () => {
    expect(autopilotDocs.length).toBeGreaterThanOrEqual(20);
    expect(autopilotTests.length).toBeGreaterThanOrEqual(autopilotDocs.length);
  });

  it("every autopilot doc is listed in the manifest", () => {
    const manifest = readFileSync(MANIFEST, "utf8");
    for (const doc of autopilotDocs) {
      if (doc === "mind-ontology-autopilot-manifest-v1.md") continue;
      expect(manifest, `manifest omits ${doc}`).toContain(doc);
    }
  });
});
