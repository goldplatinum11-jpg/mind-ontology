import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const path = (rel) => resolve(REPO_ROOT, rel);

const PHASE_CLOSEOUTS = [
  "docs/mind-ontology-phase-2-closeout-v0.md",
  "docs/mind-ontology-phase-3-closeout-v0.md",
  "docs/mind-ontology-phase-4-closeout-v0.md",
  "docs/mind-ontology-phase-5-launch-readiness-closeout-v0.md",
];

const PHASE5_DOCS = [
  "docs/mind-ontology-public-readme-v0.md",
  "docs/mind-ontology-quickstart-examples-v0.md",
  "docs/mind-ontology-shared-ontology-demo-v0.md",
  "docs/mind-ontology-trust-security-model-v0.md",
  "docs/mind-ontology-versioning-release-checklist-v0.md",
  "docs/mind-ontology-contribution-guide-plan-v0.md",
  "docs/mind-ontology-commercial-positioning-v0.md",
];

const LAUNCH_COMMANDS = [
  "agentctx:init",
  "agentctx:compile",
  "agentctx:validate",
  "agentctx:metrics",
  "agentctx:smoke",
  "agentctx:mcp",
];

describe("launch readiness closeout (P5-PR08)", () => {
  it("every phase has a closeout", () => {
    for (const doc of PHASE_CLOSEOUTS) {
      expect(existsSync(path(doc)), `missing ${doc}`).toBe(true);
    }
  });

  it("every Phase 5 launch doc shipped", () => {
    for (const doc of PHASE5_DOCS) {
      expect(existsSync(path(doc)), `missing ${doc}`).toBe(true);
    }
  });

  it("every launch command exists in package.json", () => {
    const pkg = JSON.parse(readFileSync(path("package.json"), "utf8"));
    for (const cmd of LAUNCH_COMMANDS) {
      expect(pkg.scripts[cmd], `missing command ${cmd}`).toBeTruthy();
    }
  });

  it("the closeout records the contract and all five phases", () => {
    const text = readFileSync(path("docs/mind-ontology-phase-5-launch-readiness-closeout-v0.md"), "utf8");
    expect(text).toContain("get_context");
    expect(text).toContain("list_constraints");
    expect(text).toMatch(/five-phase|five phases/i);
  });
});
