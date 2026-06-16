import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  applyBlockReconcilePlan,
  buildArtifact,
  compareBlockDrift,
  parseEmittedBlockSpans,
} from "../../scripts/agentctx/emit.mjs";
import { SOURCE_FILES } from "../../scripts/agentctx/compile.mjs";

// Lane 4 / Phase 3: the patch-application primitive. Pure (string in / data
// out). Its contract: the returned artifact, when ok, is byte-for-byte the
// expected oracle; any mismatch returns ok:false with no artifact so a caller
// can never write unverified bytes.

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TEMPLATE_AGENTCTX = resolve(REPO_ROOT, "templates/mind-ontology/.agentctx");

function readSources(dir = TEMPLATE_AGENTCTX) {
  const s = {};
  for (const f of SOURCE_FILES) {
    const p = resolve(dir, f);
    s[f] = existsSync(p) ? readFileSync(p, "utf8") : "";
  }
  return s;
}

// Drift plan between two builds, as the read-only planner would compute it.
function driftBlocks(currentBuild, expectedBuild) {
  return compareBlockDrift(
    parseEmittedBlockSpans(currentBuild.payload),
    parseEmittedBlockSpans(expectedBuild.payload),
    expectedBuild.blockManifest,
  );
}

describe("applyBlockReconcilePlan", () => {
  it("surgically patches a replace-only (same-structure) drift to the expected bytes", () => {
    const base = readSources();
    const current = buildArtifact({ sources: base, target: "agents-md" });
    const edited = { ...base, "constraints.md": `${base["constraints.md"]}In-place body edit.\n` };
    const expected = buildArtifact({ sources: edited, target: "agents-md" });

    const blocks = driftBlocks(current, expected);
    expect(blocks.some((b) => b.kind === "replace")).toBe(true);
    expect(blocks.every((b) => b.kind === "unchanged" || b.kind === "replace")).toBe(true);

    const res = applyBlockReconcilePlan(current.artifact, expected.artifact, { blocks });
    expect(res.ok).toBe(true);
    expect(res.error).toBeNull();
    expect(res.artifact).toBe(expected.artifact); // byte-for-byte the oracle
  });

  it("reproduces the oracle wholesale for a structural change (insert)", () => {
    const base = readSources();
    const current = buildArtifact({ sources: base, target: "agents-md" });
    const edited = { ...base, "constraints.md": `${base["constraints.md"]}\n## Added block #safety\n\nNew body.\n` };
    const expected = buildArtifact({ sources: edited, target: "agents-md" });

    const blocks = driftBlocks(current, expected);
    expect(blocks.some((b) => b.kind === "insert")).toBe(true);

    const res = applyBlockReconcilePlan(current.artifact, expected.artifact, { blocks });
    expect(res.ok).toBe(true);
    expect(res.artifact).toBe(expected.artifact);
  });

  it("reproduces the oracle when there is no current artifact (MISSING-like)", () => {
    const expected = buildArtifact({ sources: readSources(), target: "agents-md" });
    const blocks = parseEmittedBlockSpans(expected.payload).map((_, k) => ({ kind: "insert", emitted_index: k }));
    const res = applyBlockReconcilePlan("", expected.artifact, { blocks });
    expect(res.ok).toBe(true);
    expect(res.artifact).toBe(expected.artifact);
  });

  it("is idempotent on an already-fresh artifact (all-unchanged plan)", () => {
    const build = buildArtifact({ sources: readSources(), target: "agents-md" });
    const blocks = driftBlocks(build, build); // all unchanged
    const res = applyBlockReconcilePlan(build.artifact, build.artifact, { blocks });
    expect(res.ok).toBe(true);
    expect(res.artifact).toBe(build.artifact);
  });

  it("REFUSES (ok:false, no artifact) when the plan disagrees with the real drift", () => {
    // Two blocks actually changed, but the plan lies that one of them is
    // unchanged. The surgical splice then leaves stale bytes, and the byte
    // guard must catch it rather than emit a corrupted artifact.
    const base = readSources();
    const current = buildArtifact({ sources: base, target: "agents-md" });
    const edited = {
      ...base,
      "constraints.md": `${base["constraints.md"]}Edit one.\n`,
      "identity.md": `${base["identity.md"]}Edit two.\n`,
    };
    const expected = buildArtifact({ sources: edited, target: "agents-md" });

    const real = driftBlocks(current, expected);
    const replaceIdxs = real.map((b, i) => (b.kind === "replace" ? i : -1)).filter((i) => i >= 0);
    expect(replaceIdxs.length).toBe(2); // both edits are in-place replaces
    // Flip the first replace to a (false) unchanged — a plan that under-reports drift.
    const lying = real.map((b, i) => (i === replaceIdxs[0] ? { ...b, kind: "unchanged" } : b));

    const res = applyBlockReconcilePlan(current.artifact, expected.artifact, { blocks: lying });
    expect(res.ok).toBe(false);
    expect(res.artifact).toBeNull();
    expect(res.error).toMatch(/did not reproduce the expected artifact bytes/);
  });
});
