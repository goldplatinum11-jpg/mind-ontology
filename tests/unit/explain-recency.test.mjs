import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { compileFromCwd } from "../../scripts/agentctx/compile.mjs";
import { initAgentctx } from "../../scripts/agentctx/init.mjs";

const tempRoots = [];
function project() {
  const dir = mkdtempSync(join(tmpdir(), "agentctx-explainrec-"));
  tempRoots.push(dir);
  initAgentctx({ cwd: dir });
  // A real-dated, matchable decisions block so --recency has something to surface.
  writeFileSync(
    join(dir, ".agentctx", "decisions.md"),
    "# Decisions\n\n## Use Redis for caching #performance #cache\n\nStatus: accepted\nDate: 2026-05-01\n\nCache the booking availability in Redis for speed.\n",
  );
  return dir;
}
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

const TASK = "redis caching performance";
const json = (opts) => JSON.parse(compileFromCwd({ cwd: project(), task: TASK, scopes: [], format: "json", ...opts }));

describe("--explain surfaces the recency tie-breaker date", () => {
  it("includes recencyDate in explain when --recency and --explain are both on", () => {
    const j = json({ explain: true, recency: true });
    const block = j.selected.find((b) => b.file === "decisions.md");
    expect(block, "the dated decisions block should surface").toBeTruthy();
    expect(block.explain.recencyDate).toBe("2026-05-01");
  });

  it("omits recencyDate without --recency (byte-for-byte explain shape preserved)", () => {
    const j = json({ explain: true });
    const block = j.selected.find((b) => b.file === "decisions.md");
    expect(block.explain.recencyDate).toBeUndefined();
  });

  it("markdown --explain shows recencyDate on the line", () => {
    const md = compileFromCwd({ cwd: project(), task: TASK, scopes: [], format: "markdown", explain: true, recency: true });
    expect(md).toMatch(/recencyDate=2026-05-01/);
    const plain = compileFromCwd({ cwd: project(), task: TASK, scopes: [], format: "markdown", explain: true });
    expect(plain).not.toContain("recencyDate=");
  });
});
