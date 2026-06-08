import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initAgentctx } from "../../scripts/agentctx/init.mjs";
import { compileFromCwd } from "../../scripts/agentctx/compile.mjs";
import { classifyTaskRisk, resolveRiskLevel } from "../../scripts/agentctx/risk.mjs";

const tempRoots = [];
function makeTempRoot() {
  const dir = mkdtempSync(join(tmpdir(), "agentctx-risk-"));
  tempRoots.push(dir);
  return dir;
}
afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop(), { recursive: true, force: true });
  }
});

function compileJson(cwd, task, opts = {}) {
  return JSON.parse(
    compileFromCwd({ cwd, task, scopes: opts.scopes ?? [], format: "json", riskMode: opts.riskMode }),
  );
}

describe("classifyTaskRisk (P2-PR09)", () => {
  it("treats ordinary build tasks as safe", () => {
    expect(classifyTaskRisk("Implement the compile CLI flags").level).toBe("safe");
    expect(classifyTaskRisk("Write a markdown schema spec").level).toBe("safe");
  });

  it("flags destructive / structural intent as risky with signals", () => {
    const drop = classifyTaskRisk("Delete the production database and drop the table");
    expect(drop.level).toBe("risky");
    expect(drop.signals).toContain("delete");
    expect(drop.signals).toContain("production");

    expect(classifyTaskRisk("Run the schema migration").level).toBe("risky");
    expect(classifyTaskRisk("force push to rewrite history").level).toBe("risky");
  });

  it("resolveRiskLevel honors explicit safe/risky overrides", () => {
    expect(resolveRiskLevel("safe", "delete everything", []).level).toBe("safe");
    expect(resolveRiskLevel("risky", "harmless task", []).level).toBe("risky");
    expect(resolveRiskLevel("auto", "delete the database", []).level).toBe("risky");
  });
});

describe("compile risk modes (P2-PR09)", () => {
  it("does not force safety blocks on a safe task", () => {
    const cwd = makeTempRoot();
    initAgentctx({ cwd });

    const pack = compileJson(cwd, "Add a new compile CLI flag");
    expect(pack.risk.level).toBe("safe");
    expect(pack.selected.some((b) => b.reason === "risk-forced")).toBe(false);
  });

  it("forces a safety-tagged block into the pack on a risky task", () => {
    const cwd = makeTempRoot();
    initAgentctx({ cwd });

    const pack = compileJson(cwd, "Delete the production data and drop the schema");
    expect(pack.risk.level).toBe("risky");
    expect(pack.risk.signals.length).toBeGreaterThan(0);

    const forced = pack.selected.filter((b) => b.reason === "risk-forced");
    expect(forced.length).toBeGreaterThanOrEqual(1);
    // Every forced block carries a safety-class tag.
    const SAFETY = ["safety", "destructive", "security", "secrets", "irreversible"];
    for (const block of forced) {
      expect(block.tags.some((t) => SAFETY.includes(t))).toBe(true);
    }
  });

  it("--risk safe suppresses forcing even when the wording is risky", () => {
    const cwd = makeTempRoot();
    initAgentctx({ cwd });

    const pack = compileJson(cwd, "Delete the production database", { riskMode: "safe" });
    expect(pack.risk.level).toBe("safe");
    expect(pack.selected.some((b) => b.reason === "risk-forced")).toBe(false);
  });

  it("--risk risky forces safety context even for a calm task", () => {
    const cwd = makeTempRoot();
    initAgentctx({ cwd });

    const pack = compileJson(cwd, "Tidy up some documentation", { riskMode: "risky" });
    expect(pack.risk.level).toBe("risky");
    expect(pack.selected.some((b) => b.reason === "risk-forced")).toBe(true);
  });
});
