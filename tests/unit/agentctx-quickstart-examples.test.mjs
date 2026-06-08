import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { initAgentctx } from "../../scripts/agentctx/init.mjs";
import { compileFromCwd } from "../../scripts/agentctx/compile.mjs";
import { metricsFromCwd } from "../../scripts/agentctx/metrics.mjs";
import { validateOntology } from "../../scripts/agentctx/schema.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-quickstart-examples-v0.md");

const tempRoots = [];
function demo() {
  const cwd = mkdtempSync(resolve(tmpdir(), "agentctx-qs-"));
  tempRoots.push(cwd);
  initAgentctx({ cwd });
  return cwd;
}
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

describe("quickstart examples (P5-PR02)", () => {
  it("ships the examples doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("Example 1 — focused task: constraints always, a matched block", () => {
    const pack = JSON.parse(
      compileFromCwd({ cwd: demo(), task: "Decide which agent role handles code review", scopes: ["review"], format: "json" }),
    );
    expect(pack.selected.some((b) => b.score === "always")).toBe(true);
    expect(pack.selected.some((b) => b.reason === "matched")).toBe(true);
  });

  it("Example 2 — metrics: ratios below 1, scope covered", () => {
    const m = metricsFromCwd({ cwd: demo(), task: "Decide which agent role handles code review", scopes: ["review"] });
    expect(m.bodyRatio).toBeLessThan(1);
    expect(m.taskMatched).toBe(true);
    expect(m.scopesCovered).toBe(1);
  });

  it("Example 3 — risky task forces safety context", () => {
    const pack = JSON.parse(
      compileFromCwd({ cwd: demo(), task: "Delete the production database and drop the schema", scopes: [], format: "json" }),
    );
    expect(pack.risk.level).toBe("risky");
    expect(pack.selected.some((b) => b.reason === "risk-forced")).toBe(true);
  });

  it("Example 4 — unrelated task still gets constraints", () => {
    const m = metricsFromCwd({ cwd: demo(), task: "zzzz unrelated gibberish", scopes: [] });
    expect(m.taskMatched).toBe(false);
    expect(m.alwaysBlocks).toBeGreaterThanOrEqual(1);
  });

  it("Example 5 — the shipped template validates clean", () => {
    expect(validateOntology(demo()).ok).toBe(true);
  });
});
