import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initAgentctx } from "../../scripts/agentctx/init.mjs";
import {
  computeContextMetrics,
  metricsFromCwd,
} from "../../scripts/agentctx/metrics.mjs";

const tempRoots = [];
function makeTempRoot() {
  const dir = mkdtempSync(join(tmpdir(), "agentctx-metrics-"));
  tempRoots.push(dir);
  return dir;
}
afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop(), { recursive: true, force: true });
  }
});

describe("computeContextMetrics (P2-PR08)", () => {
  it("derives focus and compression from a pack", () => {
    const pack = {
      task: "demo",
      scopes: ["review"],
      selected: [
        { file: "constraints.md", reason: "always", tags: ["safety"], body: "x".repeat(40) },
        { file: "agent-roles.md", reason: "matched", tags: ["agent", "review"], body: "y".repeat(60) },
      ],
      omitted: [
        { file: "decisions.md", reason: "matched", tags: ["decision"], body: "z".repeat(100) },
      ],
    };
    const m = computeContextMetrics(pack);

    expect(m.selectedBlocks).toBe(2);
    expect(m.totalBlocks).toBe(3);
    expect(m.selectionRatio).toBeCloseTo(2 / 3, 3);
    expect(m.selectedBodyBytes).toBe(100);
    expect(m.totalBodyBytes).toBe(200);
    expect(m.bodyRatio).toBeCloseTo(0.5, 3);
    expect(m.alwaysBlocks).toBe(1);
    expect(m.matchedBlocks).toBe(1);
    expect(m.taskMatched).toBe(true);
    expect(m.scopesCovered).toBe(1);
  });

  it("reports no match beyond constraints for an unrelated task", () => {
    const cwd = makeTempRoot();
    initAgentctx({ cwd });

    const m = metricsFromCwd({
      cwd,
      task: "zzzzz qqqqq wwwww unrelated gibberish",
      scopes: [],
    });
    expect(m.alwaysBlocks).toBeGreaterThanOrEqual(1);
    expect(m.matchedBlocks).toBe(0);
    expect(m.taskMatched).toBe(false);
  });

  it("compresses context for a focused task on the shipped template", () => {
    const cwd = makeTempRoot();
    initAgentctx({ cwd });

    const m = metricsFromCwd({
      cwd,
      task: "Decide which review agent role to adopt for merge readiness",
      scopes: ["review"],
    });
    expect(m.selectedBlocks).toBeGreaterThanOrEqual(1);
    expect(m.totalBlocks).toBeGreaterThan(m.selectedBlocks);
    // A focused pack delivers less than the whole ontology body.
    expect(m.bodyRatio).toBeLessThan(1);
    expect(m.taskMatched).toBe(true);
    expect(m.scopesCovered).toBe(1);
  });
});
