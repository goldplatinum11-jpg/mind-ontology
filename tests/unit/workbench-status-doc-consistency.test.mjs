import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => readFileSync(resolve(REPO_ROOT, p), "utf8").replace(/\r\n/g, "\n");

const WORKBENCH_SURFACES = [
  ["emit", "scripts/agentctx/emit.mjs", "tests/unit/emit-golden.test.mjs"],
  ["preview", "scripts/agentctx/preview.mjs", "tests/unit/preview-command.test.mjs"],
  ["status", "scripts/agentctx/status.mjs", "tests/unit/status-command.test.mjs"],
  ["cq", "scripts/agentctx/cq.mjs", "tests/unit/cq-command.test.mjs"],
  ["review", "scripts/agentctx/review.mjs", "tests/unit/review-command.test.mjs"],
];

describe("Workbench status docs match the shipped CLI surface", () => {
  it("every shipped Workbench command has an implementation and a guard suite", () => {
    for (const [name, script, test] of WORKBENCH_SURFACES) {
      expect(existsSync(resolve(REPO_ROOT, script)), `${name} implementation is missing`).toBe(true);
      expect(existsSync(resolve(REPO_ROOT, test)), `${name} guard test is missing`).toBe(true);
    }
  });

  it("public status docs say the Workbench CLI is shipped, not still design-only", () => {
    for (const doc of [
      "docs/product-status.md",
      "docs/mind-ontology.md",
      "docs/mind-ontology-workbench-design-v1.md",
    ]) {
      const text = read(doc);
      for (const marker of ["status", "preview", "cq", "emit", "review"]) {
        expect(text, `${doc} does not name the shipped Workbench command ${marker}`).toContain(
          marker,
        );
      }
      expect(text.toLowerCase(), `${doc} must state the Workbench CLI is shipped`).toContain(
        "shipped",
      );
    }
  });

  it("W1/W2 specs point to shipped implementation files instead of stale no-code claims", () => {
    const w1 = read("docs/workbench-w1-emit-target-spec.md");
    const w2 = read("docs/workbench-w2-cli-spec.md");

    expect(w1).toContain("scripts/agentctx/emit.mjs");
    expect(w2).toContain("scripts/agentctx/status.mjs");
    expect(w2).toContain("preview.mjs");
    expect(w2).toContain("cq.mjs");
    expect(w2).toContain("review.mjs");

    for (const stale of [
      "Nothing here ships code",
      "Engine implementation is W3+ and ships nothing here",
    ]) {
      expect(w1, `W1 spec reintroduced stale claim: ${stale}`).not.toContain(stale);
      expect(w2, `W2 spec reintroduced stale claim: ${stale}`).not.toContain(stale);
    }
  });
});
