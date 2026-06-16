import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildArtifact,
  classifyTarget,
  compareBlockDrift,
  parseEmittedBlockSpans,
  planBlockReconcileTarget,
  sha256,
} from "../../scripts/agentctx/emit.mjs";
import { SOURCE_FILES } from "../../scripts/agentctx/compile.mjs";

// Lane 4 / Phase 1: the read-only block-reconcile planner. Pure span parsing,
// per-block drift, and the per-target plan — no writes anywhere.

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TEMPLATE_AGENTCTX = resolve(REPO_ROOT, "templates/mind-ontology/.agentctx");
const SWEEP_AGENTCTX = resolve(REPO_ROOT, "tests/fixtures/emit/safety-sweep/.agentctx");

function readSources(agentctxDir) {
  const sources = {};
  for (const file of SOURCE_FILES) {
    const path = resolve(agentctxDir, file);
    sources[file] = existsSync(path) ? readFileSync(path, "utf8") : "";
  }
  return sources;
}

const tempRoots = [];
function project(agentctxDir = TEMPLATE_AGENTCTX) {
  const cwd = mkdtempSync(join(tmpdir(), "mo-block-recon-"));
  tempRoots.push(cwd);
  cpSync(agentctxDir, join(cwd, ".agentctx"), { recursive: true });
  return cwd;
}
// Write a fresh artifact to disk so classifyTarget can read it.
function emitTo(cwd, target = "agents-md", profile = "default") {
  const build = buildArtifact({ sources: readSources(join(cwd, ".agentctx")), target, profile });
  writeFileSync(join(cwd, build.path), build.artifact, "utf8");
  return build;
}
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

describe("parseEmittedBlockSpans", () => {
  it("recovers every emitted block, aligned 1:1 with the block manifest", () => {
    const build = buildArtifact({ sources: readSources(TEMPLATE_AGENTCTX), target: "agents-md" });
    const spans = parseEmittedBlockSpans(build.payload);
    expect(spans.length).toBe(build.blockManifest.length);
    spans.forEach((s, k) => {
      expect(s.emittedIndex).toBe(k);
      expect(s.sourceFile).toBe(build.blockManifest[k].source_file);
      // sha256(renderedText) reproduces the manifest's rendered_digest exactly.
      expect(s.renderedDigest).toBe(build.blockManifest[k].rendered_digest);
      expect(sha256(s.renderedText)).toBe(s.renderedDigest);
    });
  });

  it("keeps a block body's blank lines inside the block (not a separator)", () => {
    const sources = readSources(TEMPLATE_AGENTCTX);
    const withBlank = {
      ...sources,
      "constraints.md": "# Constraints\n\n## Rule A #safety\n\nLine one.\n\nLine two after a blank.\n",
    };
    const build = buildArtifact({ sources: withBlank, target: "agents-md" });
    const spans = parseEmittedBlockSpans(build.payload);
    const ruleA = spans.find((s) => s.renderedText.includes("Rule A"));
    expect(ruleA.renderedText).toContain("Line one.");
    expect(ruleA.renderedText).toContain("Line two after a blank.");
    // The internal blank line survived; the digest still round-trips.
    expect(sha256(ruleA.renderedText)).toBe(ruleA.renderedDigest);
  });
});

describe("compareBlockDrift", () => {
  const baseSources = () => readSources(TEMPLATE_AGENTCTX);

  it("an in-place body edit is a single replace; the rest are unchanged", () => {
    const actual = buildArtifact({ sources: baseSources(), target: "agents-md" });
    const edited = { ...baseSources() };
    // Append a line to the final constraints block's body (no new heading), an
    // in-place edit. Appending is line-ending agnostic — the fixtures are CRLF.
    edited["constraints.md"] = `${edited["constraints.md"]}Edited sentence in the last block.\n`;
    const expected = buildArtifact({ sources: edited, target: "agents-md" });

    const changes = compareBlockDrift(
      parseEmittedBlockSpans(actual.payload),
      parseEmittedBlockSpans(expected.payload),
      expected.blockManifest,
    );
    const replaced = changes.filter((c) => c.kind === "replace");
    expect(replaced).toHaveLength(1);
    expect(changes.filter((c) => c.kind === "insert" || c.kind === "delete")).toHaveLength(0);
    expect(changes.filter((c) => c.kind === "unchanged").length).toBe(changes.length - 1);
    expect(replaced[0].actual_rendered_digest).not.toBe(replaced[0].expected_rendered_digest);
  });

  it("an appended source block is a single insert", () => {
    const actual = buildArtifact({ sources: baseSources(), target: "agents-md" });
    const edited = { ...baseSources() };
    edited["constraints.md"] = `${edited["constraints.md"]}\n## Brand new rule #safety\n\nFresh body.\n`;
    const expected = buildArtifact({ sources: edited, target: "agents-md" });

    const changes = compareBlockDrift(
      parseEmittedBlockSpans(actual.payload),
      parseEmittedBlockSpans(expected.payload),
      expected.blockManifest,
    );
    const inserts = changes.filter((c) => c.kind === "insert");
    expect(inserts).toHaveLength(1);
    expect(changes.some((c) => c.kind === "delete")).toBe(false);
    expect(inserts[0].expected_rendered_digest).toMatch(/^sha256:/);
    expect(inserts[0].actual_rendered_digest).toBeNull();
  });

  it("a removed source block is a single delete", () => {
    const withExtra = { ...baseSources() };
    withExtra["constraints.md"] = `${withExtra["constraints.md"]}\n## Temporary rule #safety\n\nGoes away.\n`;
    const actual = buildArtifact({ sources: withExtra, target: "agents-md" }); // has the extra block
    const expected = buildArtifact({ sources: baseSources(), target: "agents-md" }); // without it

    const changes = compareBlockDrift(
      parseEmittedBlockSpans(actual.payload),
      parseEmittedBlockSpans(expected.payload),
      expected.blockManifest,
    );
    const deletes = changes.filter((c) => c.kind === "delete");
    expect(deletes).toHaveLength(1);
    expect(changes.some((c) => c.kind === "insert")).toBe(false);
    expect(deletes[0].emitted_index).toBeNull();
    expect(deletes[0].expected_rendered_digest).toBeNull();
  });

  it("identical builds drift to all-unchanged", () => {
    const a = buildArtifact({ sources: baseSources(), target: "agents-md" });
    const changes = compareBlockDrift(
      parseEmittedBlockSpans(a.payload),
      parseEmittedBlockSpans(a.payload),
      a.blockManifest,
    );
    expect(changes.every((c) => c.kind === "unchanged")).toBe(true);
  });
});

describe("planBlockReconcileTarget (read-only)", () => {
  function planFor(cwd, target = "agents-md") {
    const sources = readSources(join(cwd, ".agentctx"));
    const result = classifyTarget({ cwd, target, sources });
    return { plan: planBlockReconcileTarget({ cwd, target, sources, result }), result };
  }

  it("OK target: reproducible, no drift, nothing to write", () => {
    const cwd = project();
    emitTo(cwd);
    const { plan } = planFor(cwd);
    expect(plan.status).toBe("ok");
    expect(plan.reproducible).toBe(true);
    expect(plan.would_write_paths).toEqual([]);
    expect(plan.blocks).toEqual([]);
    expect(plan.refuse_reason).toBeNull();
  });

  it("STALE target: per-block drift against the recorded profile, would write the artifact", () => {
    const cwd = project();
    emitTo(cwd); // artifact reflects the original sources
    // Now edit a source so the on-disk artifact is STALE (append to the last
    // block's body; line-ending agnostic — the fixtures are CRLF).
    const cpath = join(cwd, ".agentctx", "constraints.md");
    writeFileSync(cpath, `${readFileSync(cpath, "utf8")}Drift edit in the last block.\n`);
    const before = readFileSync(join(cwd, "AGENTS.md"), "utf8");

    const { plan } = planFor(cwd);
    expect(plan.status).toBe("stale");
    expect(plan.reproducible).toBe(true);
    expect(plan.expected_profile).toBe("default");
    expect(plan.would_write_paths).toEqual(["AGENTS.md"]);
    expect(plan.blocks.some((b) => b.kind === "replace")).toBe(true);
    // Read-only: the artifact on disk is untouched.
    expect(readFileSync(join(cwd, "AGENTS.md"), "utf8")).toBe(before);
  });

  it("MISSING target: every expected block is an insert; would create the artifact", () => {
    const cwd = project(); // no artifact emitted
    const { plan } = planFor(cwd);
    expect(plan.status).toBe("missing");
    expect(plan.reproducible).toBe(true);
    expect(plan.would_write_paths).toEqual(["AGENTS.md"]);
    expect(plan.blocks.length).toBeGreaterThan(0);
    expect(plan.blocks.every((b) => b.kind === "insert")).toBe(true);
    expect(existsSync(join(cwd, "AGENTS.md"))).toBe(false); // not created
  });

  it("HAND-EDITED target: refuse with a reason, no block patch, nothing written", () => {
    const cwd = project();
    emitTo(cwd);
    const p = join(cwd, "AGENTS.md");
    writeFileSync(p, `${readFileSync(p, "utf8")}\nA hand edit.\n`);
    const before = readFileSync(p, "utf8");
    const { plan } = planFor(cwd);
    expect(plan.status).toBe("hand-edited");
    expect(plan.reproducible).toBe(false);
    expect(plan.would_write_paths).toEqual([]);
    expect(plan.blocks).toEqual([]);
    expect(plan.refuse_reason).toMatch(/HAND-EDITED/);
    expect(readFileSync(p, "utf8")).toBe(before);
  });

  it("UNMANAGED target: refuse, points at --force, nothing written", () => {
    const cwd = project();
    emitTo(cwd);
    const p = join(cwd, "AGENTS.md");
    const content = readFileSync(p, "utf8");
    writeFileSync(p, content.slice(content.indexOf("-->\n") + 4)); // strip header
    const { plan } = planFor(cwd);
    expect(plan.status).toBe("unmanaged");
    expect(plan.reproducible).toBe(false);
    expect(plan.would_write_paths).toEqual([]);
    expect(plan.blocks).toEqual([]);
    expect(plan.refuse_reason).toMatch(/--force/);
  });

  it("safety-sweep forced blocks parse with their true source file", () => {
    const cwd = project(SWEEP_AGENTCTX);
    emitTo(cwd);
    const cpath = join(cwd, ".agentctx", "projects.md");
    writeFileSync(cpath, `${readFileSync(cpath, "utf8")}\nEdited.\n`);
    const { plan } = planFor(cwd);
    expect(plan.status).toBe("stale");
    // The swept block names projects.md as its true source even though it
    // renders under Constraints.
    expect(plan.blocks.some((b) => b.source_file === "projects.md")).toBe(true);
  });
});
