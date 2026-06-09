import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RISK_PHRASES, RISK_WORDS, classifyTaskRisk } from "../../scripts/agentctx/risk.mjs";
import { RISK_MODES, SAFETY_TAGS } from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = readFileSync(resolve(REPO_ROOT, "docs/mind-ontology-task-risk-modes-v0.md"), "utf8");
const README = readFileSync(resolve(REPO_ROOT, "README.md"), "utf8");

// M9 — keep the product-facing risk doc honest against the actual classifier.
// If risk.mjs/compile.mjs change their words/phrases/tags/modes, these fail so the
// doc gets updated rather than silently drifting.
describe("task-risk-modes doc stays aligned with risk.mjs (M9)", () => {
  it("every risk word the doc enumerates really triggers a risky classification", () => {
    // Words the doc explicitly names as risk words (the prose list).
    const docWords = ["delete", "drop", "truncate", "destroy", "wipe", "purge", "overwrite", "migrate", "deploy", "irreversible", "uninstall", "downgrade", "revoke", "production", "prod"];
    for (const w of docWords) {
      expect(DOC.toLowerCase(), `doc word "${w}" not documented`).toContain(w);
      expect(RISK_WORDS.has(w), `risk word "${w}" missing from RISK_WORDS`).toBe(true);
      expect(classifyTaskRisk(`please ${w} it`).level, `"${w}" should classify risky`).toBe("risky");
    }
  });

  it("every risk phrase the doc lists is a real RISK_PHRASE that flags risky", () => {
    for (const phrase of RISK_PHRASES) {
      expect(DOC.toLowerCase(), `phrase "${phrase}" not in doc`).toContain(phrase);
      expect(classifyTaskRisk(`we will ${phrase} now`).level).toBe("risky");
    }
  });

  it("the safety-class tags the doc names match SAFETY_TAGS exactly", () => {
    for (const tag of SAFETY_TAGS) {
      expect(DOC, `safety tag "${tag}" not documented`).toContain(tag);
    }
  });

  it("documents all three risk modes that the compiler accepts", () => {
    for (const mode of RISK_MODES) {
      expect(DOC, `mode "${mode}" not documented`).toContain(mode);
    }
    // README shows a runnable risk example and the fail-closed live-write note.
    expect(README).toContain("--risk auto");
    expect(README.toLowerCase()).toContain("fails closed");
  });
});
