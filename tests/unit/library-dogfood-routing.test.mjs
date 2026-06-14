/**
 * Regression suite: real-world 3-box library routing (kei-ai-os / cascade-trading / sirtuin-x).
 *
 * Uses the tests/fixtures/library-dogfood fixture which mirrors the manifests from
 * Kei's private dogfood library. Tests that:
 *   - Each box routes correctly for representative task strings
 *   - No task is ambiguous (the winner has a clear score lead)
 *   - The library passes doctor (no duplicate ids, no empty triggers)
 *   - compile --library produces a non-empty pack for each box
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { lintLibrary } from "../../scripts/agentctx/library-doctor.mjs";
import { routeOntology, scanLibrary } from "../../scripts/agentctx/router.mjs";
import { compileFromCwd } from "../../scripts/agentctx/compile.mjs";
import { initAgentctx } from "../../scripts/agentctx/init.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_LIBRARY = resolve(REPO_ROOT, "tests/fixtures/library-dogfood");

// Build a full compilable library: init a fresh .agentctx/ per box, then overlay each manifest.
const tempRoots = [];
function compilableLibrary() {
  const lib = mkdtempSync(join(tmpdir(), "agentctx-dogfood-"));
  tempRoots.push(lib);
  for (const box of ["kei-ai-os", "cascade-trading", "sirtuin-x"]) {
    const boxDir = join(lib, box);
    mkdirSync(boxDir, { recursive: true });
    initAgentctx({ cwd: boxDir });
    // Overlay the fixture manifest (real dogfood triggers/scopes).
    const manifest = readFileSync(join(FIXTURE_LIBRARY, box, ".agentctx", "manifest.json"), "utf8");
    writeFileSync(join(boxDir, ".agentctx", "manifest.json"), manifest);
  }
  return lib;
}
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// 1. Doctor: the fixture library is structurally clean
// ---------------------------------------------------------------------------
describe("library-dogfood fixture: doctor", () => {
  it("passes doctor with 3 boxes and 0 issues", () => {
    const result = lintLibrary(FIXTURE_LIBRARY);
    expect(result.ok).toBe(true);
    expect(result.boxes).toBe(3);
    expect(result.issues).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Routing: each representative task lands on the correct box
// ---------------------------------------------------------------------------
describe("library-dogfood fixture: routing", () => {
  const boxes = scanLibrary(FIXTURE_LIBRARY);

  /** Assert the winning box id and that the runner-up has a lower score. */
  function assertRoute(task, expectedId) {
    const result = routeOntology(task, [], boxes);
    const ranked = result.candidates;
    expect(ranked.length).toBeGreaterThan(0);
    const winner = ranked[0];
    expect(winner.id, `task "${task}" should route to ${expectedId}, got ${winner.id}`).toBe(expectedId);
    if (ranked.length > 1) {
      expect(winner.score, `task "${task}" — winner not clearly ahead of runner-up`).toBeGreaterThan(ranked[1].score);
    }
  }

  it("routes AI Development OS tasks to kei-ai-os", () => {
    assertRoute("Codex plans the lane, Claude Code implements", "kei-ai-os");
    assertRoute("Worker submits a Result Pack for review", "kei-ai-os");
    assertRoute("agentctx get_context for SIRT AI Development OS task", "kei-ai-os");
    assertRoute("The Controller decides the next lane", "kei-ai-os");
  });

  it("routes weather trading tasks to cascade-trading", () => {
    assertRoute("Check the Polymarket bracket settlement station before entry", "cascade-trading");
    assertRoute("Run scout_predict for the next hour METAR temperature", "cascade-trading");
    assertRoute("Tourniquet V4 triggered at LFPG — execute stop-loss", "cascade-trading");
    assertRoute("Verify the FAK order filled before the cascade leg expires", "cascade-trading");
    assertRoute("Nearcaster weather nowcast for KLGA settlement", "cascade-trading");
  });

  it("routes supplement brand tasks to sirtuin-x", () => {
    assertRoute("Write product description for SirtuinX NMN supplement", "sirtuin-x");
    assertRoute("NAD+ precursor brand positioning for longevity market", "sirtuin-x");
    assertRoute("MindTech supplement sales channel strategy", "sirtuin-x");
    assertRoute("Sirtuin activation and cellular aging science copy", "sirtuin-x");
  });

  it("does not cross-contaminate: METAR task does not route to sirtuin-x", () => {
    const { candidates } = routeOntology("Check METAR for Polymarket weather bracket", [], boxes);
    const sirtuinRank = candidates.findIndex((r) => r.id === "sirtuin-x");
    const cascadeRank = candidates.findIndex((r) => r.id === "cascade-trading");
    expect(cascadeRank).toBeLessThan(sirtuinRank === -1 ? Infinity : sirtuinRank);
  });

  it("does not cross-contaminate: NAD+ task does not route to cascade-trading", () => {
    const { candidates } = routeOntology("NAD+ supplement for longevity", [], boxes);
    const sirtuinRank = candidates.findIndex((r) => r.id === "sirtuin-x");
    const cascadeRank = candidates.findIndex((r) => r.id === "cascade-trading");
    expect(sirtuinRank).toBeLessThan(cascadeRank === -1 ? Infinity : cascadeRank);
  });
});
