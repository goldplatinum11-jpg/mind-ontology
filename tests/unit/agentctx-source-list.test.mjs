import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initAgentctx } from "../../scripts/agentctx/init.mjs";
import {
  ALWAYS_INCLUDE_FILES,
  SOURCE_FILES,
  compileFromCwd,
} from "../../scripts/agentctx/compile.mjs";

const EXPANDED_SOURCES = [
  "constraints.md",
  "identity.md",
  "direction.md",
  "projects.md",
  "decisions.md",
  "architecture.md",
  "agent-roles.md",
  "glossary.md",
  "cq.md",
];

const tempRoots = [];
function makeTempRoot() {
  const dir = mkdtempSync(join(tmpdir(), "agentctx-source-list-"));
  tempRoots.push(dir);
  return dir;
}
afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop(), { recursive: true, force: true });
  }
});

describe("compiler source-list expansion (P2-PR06)", () => {
  it("includes every Phase 2 ontology source, with constraints always-included", () => {
    expect(SOURCE_FILES).toEqual(EXPANDED_SOURCES);
    expect([...ALWAYS_INCLUDE_FILES]).toEqual(["constraints.md"]);
    // Only constraints.md is always-included; the rest are scored.
    for (const file of SOURCE_FILES) {
      if (file !== "constraints.md") {
        expect(ALWAYS_INCLUDE_FILES.has(file)).toBe(false);
      }
    }
  });

  it("surfaces a scored block from a newly-wired source (agent-roles.md)", () => {
    const cwd = makeTempRoot();
    initAgentctx({ cwd });

    const output = compileFromCwd({
      cwd,
      task: "Decide which review agent role to adopt for merge readiness",
      scopes: ["review"],
      format: "json",
      maxBlocksPerFile: 1,
      minScore: 2,
    });
    const pack = JSON.parse(output);
    const files = pack.selected.map((b) => b.file);

    expect(pack.sourceFiles).toEqual(EXPANDED_SOURCES);
    expect(files, "expected an agent-roles.md block to be selected").toContain(
      "agent-roles.md",
    );
  });

  it("surfaces a scored project block per task, never force-included (projects.md)", () => {
    // Anchors docs/mind-ontology-projects-schema-v0.md: projects.md blocks "are
    // scored and selected per task like other non-constraint sources." The
    // shipped template's project block must reach the pack by matching a task,
    // carrying reason "matched" with a numeric score — never reason "always".
    const cwd = makeTempRoot();
    initAgentctx({ cwd });

    const output = compileFromCwd({
      cwd,
      task: "Decide which project the agent should focus on",
      scopes: ["project"],
      format: "json",
      maxBlocksPerFile: 1,
      minScore: 2,
    });
    const pack = JSON.parse(output);
    const projectBlocks = pack.selected.filter((b) => b.file === "projects.md");

    expect(ALWAYS_INCLUDE_FILES.has("projects.md")).toBe(false);
    expect(
      projectBlocks.length,
      "expected a projects.md block to be selected",
    ).toBeGreaterThanOrEqual(1);
    for (const block of projectBlocks) {
      expect(block.reason).toBe("matched");
      expect(typeof block.score).toBe("number");
      expect(block.score).toBeGreaterThanOrEqual(2);
    }
  });

  it("still compiles a minimal project that ships only constraints.md", () => {
    const cwd = makeTempRoot();
    initAgentctx({ cwd });
    // Remove every scored source, leaving only the always-included constraints.
    for (const file of SOURCE_FILES) {
      if (file !== "constraints.md") {
        rmSync(join(cwd, ".agentctx", file), { force: true });
      }
    }

    const output = compileFromCwd({
      cwd,
      task: "Sanity check minimal project",
      scopes: [],
      format: "json",
      maxBlocksPerFile: 1,
      minScore: 2,
    });
    const pack = JSON.parse(output);
    const constraintsBlocks = pack.selected.filter((b) => b.file === "constraints.md");

    expect(constraintsBlocks.length).toBeGreaterThanOrEqual(1);
    expect(constraintsBlocks.every((b) => b.score === "always")).toBe(true);
  });
});
