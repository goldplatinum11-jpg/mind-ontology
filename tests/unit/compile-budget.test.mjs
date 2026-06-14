import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyTokenBudget,
  compileFromCwd,
  estimateBlockTokens,
  estimateTokens,
  parseArgv,
} from "../../scripts/agentctx/compile.mjs";
import { initAgentctx } from "../../scripts/agentctx/init.mjs";

const tempRoots = [];
function project() {
  const dir = mkdtempSync(join(tmpdir(), "agentctx-budget-"));
  tempRoots.push(dir);
  initAgentctx({ cwd: dir });
  return dir;
}
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

const block = (file, reason, score, body, extra = {}) => ({
  file,
  title: `${file} block`,
  body,
  tags: [],
  index: 0,
  score,
  reason,
  ...extra,
});

describe("estimateTokens / applyTokenBudget (the budget engine)", () => {
  it("estimates ~4 chars per token", () => {
    expect(estimateTokens("12345678")).toBe(2);
    expect(estimateTokens("")).toBe(0);
  });

  it("keeps mandatory blocks, drops lower-priority ones to fit, in priority order", () => {
    const constraints = block("constraints.md", "always", Infinity, "x".repeat(40)); // mandatory
    const cq = block("cq.md", "matched", 6, "y".repeat(40)); // priority 2
    const glossary = block("glossary.md", "matched", 6, "z".repeat(40)); // priority 9
    const budget = estimateBlockTokens(constraints) + estimateBlockTokens(cq); // fits constraints + cq only

    const out = applyTokenBudget([constraints, cq, glossary], [], budget);

    expect(out.selected.map((b) => b.file)).toEqual(["constraints.md", "cq.md"]);
    expect(out.overBudget).toBe(false);
    const dropped = out.omitted.filter((b) => b.reason === "budget");
    expect(dropped.map((b) => b.file)).toEqual(["glossary.md"]); // the lower-priority one
    expect(out.estimatedTokens).toBe(budget);
  });

  it("never drops constraints; flags overBudget when mandatory alone exceeds the budget", () => {
    const constraints = block("constraints.md", "always", Infinity, "x".repeat(80));
    const cq = block("cq.md", "matched", 6, "y".repeat(40));
    const out = applyTokenBudget([constraints, cq], [], 1); // absurdly tight

    expect(out.selected.map((b) => b.file)).toEqual(["constraints.md"]);
    expect(out.overBudget).toBe(true);
    expect(out.omitted.some((b) => b.file === "cq.md" && b.reason === "budget")).toBe(true);
  });

  it("prioritizes risk-forced safety blocks right after constraints", () => {
    const constraints = block("constraints.md", "always", Infinity, "x".repeat(20));
    const forced = block("constraints.md", "risk-forced", 0, "s".repeat(20));
    const projects = block("projects.md", "matched", 6, "p".repeat(20));
    const budget = estimateBlockTokens(constraints) + estimateBlockTokens(forced); // no room for projects
    const out = applyTokenBudget([constraints, forced, projects], [], budget);

    expect(out.selected.map((b) => b.reason)).toEqual(["always", "risk-forced"]);
    expect(out.omitted.some((b) => b.file === "projects.md" && b.reason === "budget")).toBe(true);
  });

  it("on a risky task a safety block selected by normal scoring is still mandatory (not budget-dropped)", () => {
    // Independent review caught this: a #safety block that surfaced via normal scoring
    // keeps reason "matched", so a tight budget could drop it on a risky task and gut the
    // safety guidance risk mode exists to preserve. On a risky task it must survive.
    // Safety block sits in a LOW-priority file; a non-safety block sits in a HIGH-priority
    // file. Normally (non-risky) source priority keeps the high-priority non-safety block.
    // On a risky task the safety block is promoted to mandatory and survives instead.
    const constraints = block("constraints.md", "always", Infinity, "x".repeat(20));
    const safety = block("glossary.md", "matched", 6, "s".repeat(20), { tags: ["safety"] }); // low priority
    const other = block("cq.md", "matched", 6, "c".repeat(20)); // high priority, non-safety
    const budget = estimateBlockTokens(constraints) + Math.max(estimateBlockTokens(safety), estimateBlockTokens(other));

    const risky = applyTokenBudget([constraints, safety, other], [], budget, true);
    expect(risky.selected.some((b) => b.file === "glossary.md")).toBe(true); // safety kept despite low priority
    expect(risky.omitted.some((b) => b.file === "cq.md" && b.reason === "budget")).toBe(true);

    // Non-risky: the protection is scoped to risk mode — high-priority non-safety wins.
    const safe = applyTokenBudget([constraints, safety, other], [], budget, false);
    expect(safe.selected.some((b) => b.file === "cq.md")).toBe(true);
    expect(safe.omitted.some((b) => b.file === "glossary.md" && b.reason === "budget")).toBe(true);
  });
});

describe("--max-tokens CLI + integration", () => {
  it("parseArgv accepts a positive integer and rejects bad values", () => {
    expect(parseArgv(["compile", "--task", "x", "--max-tokens", "200"]).maxTokens).toBe(200);
    expect(parseArgv(["compile", "--task", "x"]).maxTokens).toBeUndefined();
    expect(() => parseArgv(["compile", "--task", "x", "--max-tokens", "0"])).toThrow(/positive integer/);
    expect(() => parseArgv(["compile", "--task", "x", "--max-tokens", "-5"])).toThrow(/positive integer/);
    expect(() => parseArgv(["compile", "--task", "x", "--max-tokens", "abc"])).toThrow(/positive integer/);
    expect(() => parseArgv(["compile", "--task", "x", "--max-tokens"])).toThrow(/positive integer/);
  });

  it("without --max-tokens the json selection is unchanged (byte-for-byte opt-in)", () => {
    const dir = project();
    const task = "which project is active and what direction matters";
    const sel = (maxTokens) => {
      const p = JSON.parse(compileFromCwd({ cwd: dir, task, scopes: [], format: "json", maxTokens }));
      return { sel: p.selected.map((b) => `${b.file}/${b.title}`), budget: p.budget };
    };
    const off = sel(undefined);
    expect(off.budget).toBeUndefined(); // no budget key when not requested
    expect(sel(null).sel).toEqual(off.sel);
  });

  it("the budgeted content actually fits: estimatedTokens <= maxTokens unless over budget", () => {
    const dir = project();
    const task = "direction decisions projects architecture identity";
    for (const maxTokens of [400, 600, 1000]) {
      const j = JSON.parse(compileFromCwd({ cwd: dir, task, scopes: [], format: "json", maxTokens }));
      if (!j.budget.overBudget) {
        expect(j.budget.estimatedTokens).toBeLessThanOrEqual(maxTokens);
      }
      // The compact body (what the budget measures) carries only the kept blocks.
      const compact = compileFromCwd({ cwd: dir, task, scopes: [], format: "compact", maxTokens });
      expect((compact.match(/^## /gm) || []).length).toBe(j.selected.length);
    }
  });

  it("constraints survive a tiny budget and json exposes budget metadata", () => {
    const dir = project();
    const j = JSON.parse(
      compileFromCwd({ cwd: dir, task: "anything", scopes: [], format: "json", maxTokens: 30 }),
    );
    expect(j.selected.some((b) => b.file === "constraints.md")).toBe(true);
    expect(j.budget).toMatchObject({ maxTokens: 30 });
    expect(typeof j.budget.estimatedTokens).toBe("number");
    expect(Array.isArray(j.budgetOmitted)).toBe(true);
  });

  it("markdown shows a budget summary; compact respects the budget without mid-block truncation", () => {
    const dir = project();
    const task = "which project is active and what direction and decisions matter";
    const md = compileFromCwd({ cwd: dir, task, scopes: [], format: "markdown", maxTokens: 120 });
    expect(md).toMatch(/^Budget: \d+\/120 tokens/m);

    const full = compileFromCwd({ cwd: dir, task, scopes: [], format: "compact" });
    const budgeted = compileFromCwd({ cwd: dir, task, scopes: [], format: "compact", maxTokens: 120 });
    const heads = (s) => (s.match(/^## /gm) || []).length;
    expect(heads(budgeted)).toBeLessThan(heads(full)); // genuinely fewer blocks
    // Every body that does appear is whole: the compact output is just headings + full bodies.
    expect(budgeted.includes("…")).toBe(false);
  });
});
