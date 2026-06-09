import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initAgentctx } from "../../scripts/agentctx/init.mjs";
import { compileFromCwd } from "../../scripts/agentctx/compile.mjs";
import { metricsFromCwd, renderMetrics } from "../../scripts/agentctx/metrics.mjs";

const tempRoots = [];
function project() {
  const dir = mkdtempSync(join(tmpdir(), "agentctx-ux-"));
  tempRoots.push(dir);
  initAgentctx({ cwd: dir });
  return dir;
}
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

const TASK = "Implement the agentctx compile CLI with task and scope flags";

// M22 — the compile output a user reads must carry the structure the quickstart promises.
describe("compile markdown UX contract (M22)", () => {
  it("renders the documented human-readable sections", () => {
    const md = compileFromCwd({ cwd: project(), task: TASK, scopes: ["cli"] });
    expect(md).toContain("# agentctx context pack");
    expect(md).toContain(`Task: ${TASK}`);
    expect(md).toContain("Risk:"); // risk line is always present
    expect(md).toContain("## Included Context");
  });

  it("json output echoes the task and always includes constraints", () => {
    const json = JSON.parse(compileFromCwd({ cwd: project(), task: TASK, scopes: ["cli"], format: "json" }));
    expect(json.task).toBe(TASK);
    expect(json.selected.some((b) => b.file === "constraints.md" && b.reason === "always")).toBe(true);
  });
});

// M23 — metrics must be self-consistent and explainable.
describe("metrics meaning is well-defined (M23)", () => {
  it("ratios are bounded and counts reconcile", () => {
    const m = metricsFromCwd({ cwd: project(), task: TASK, scopes: ["cli", "mcp"] });
    expect(m.totalBlocks).toBe(m.selectedBlocks + m.omittedBlocks);
    expect(m.selectionRatio).toBeGreaterThanOrEqual(0);
    expect(m.selectionRatio).toBeLessThanOrEqual(1);
    expect(m.bodyRatio).toBeGreaterThanOrEqual(0);
    expect(m.bodyRatio).toBeLessThanOrEqual(1);
    expect(m.scopesRequested).toBe(2);
    expect(m.scopesCovered).toBeLessThanOrEqual(m.scopesRequested);
    expect(typeof m.taskMatched).toBe("boolean");
    // alwaysBlocks reflects constraints forced into every pack.
    expect(m.alwaysBlocks).toBeGreaterThanOrEqual(1);
  });

  it("renders the labelled report a user reads", () => {
    const text = renderMetrics(metricsFromCwd({ cwd: project(), task: TASK, scopes: ["cli"] }));
    expect(text).toContain("selection ratio");
    expect(text).toContain("body ratio");
    expect(text).toContain("Scopes covered");
  });
});
