import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  compileContext,
  compileFromCwd,
  explainBlock,
} from "../../scripts/agentctx/compile.mjs";
import { initAgentctx } from "../../scripts/agentctx/init.mjs";

// --explain surfaces matchedAliases: the alias tokens that drove a block's selection.
// Off by default (byte-for-byte shape preserved), opt-in via --aliases + --explain.

const tempRoots = [];
function project() {
  const dir = mkdtempSync(join(tmpdir(), "agentctx-explainalias-"));
  tempRoots.push(dir);
  initAgentctx({ cwd: dir });
  writeFileSync(
    join(dir, ".agentctx", "decisions.md"),
    "# Decisions\n\n## Session handling #session\n\nAliases: auth, authentication\n\nWe keep the session in a signed cookie.\n",
  );
  return dir;
}
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

// Shared fixture sources for unit-level tests (no disk I/O needed).
const ALIAS_SOURCES = {
  "constraints.md": "# Constraints\n\n## Care #safety\n\nbe careful\n",
  "decisions.md":
    "# Decisions\n\n## Session handling #session\n\nAliases: auth, authentication\n\nWe keep the session in a signed cookie.\n",
};

describe("--explain surfaces matchedAliases", () => {
  it("includes matchedAliases in explain when --aliases and --explain are both on", () => {
    const dir = project();
    const j = JSON.parse(
      compileFromCwd({ cwd: dir, task: "auth", scopes: [], format: "json", explain: true, aliases: true }),
    );
    const block = j.selected.find((b) => b.file === "decisions.md");
    expect(block, "the alias-matched decisions block should surface").toBeTruthy();
    expect(block.explain.matchedAliases).toEqual(["auth"]);
  });

  it("omits matchedAliases without --aliases (byte-for-byte explain shape preserved)", () => {
    // Use minScore:0 so the block surfaces even without alias boost, then verify explain.
    const pack = compileContext({ sources: ALIAS_SOURCES, task: "auth", scopes: [], minScore: 0 });
    for (const block of pack.selected) {
      expect(explainBlock(block).matchedAliases).toBeUndefined();
    }
  });

  it("markdown --explain --aliases shows matchedAliases on the Explain line", () => {
    const md = compileFromCwd({
      cwd: project(),
      task: "auth",
      scopes: [],
      format: "markdown",
      explain: true,
      aliases: true,
    });
    expect(md).toMatch(/matchedAliases=auth/);
  });

  it("markdown --explain without --aliases carries no matchedAliases", () => {
    const md = compileFromCwd({
      cwd: project(),
      task: "session",
      scopes: [],
      format: "markdown",
      explain: true,
    });
    expect(md).not.toContain("matchedAliases=");
  });

  it("matchedAliases is absent when aliases is on but the task does not match any alias", () => {
    const dir = project();
    // Task "session" matches the heading directly — no alias fires.
    const j = JSON.parse(
      compileFromCwd({ cwd: dir, task: "session", scopes: [], format: "json", explain: true, aliases: true }),
    );
    for (const block of j.selected) {
      expect(block.explain.matchedAliases).toBeUndefined();
    }
  });

  it("scope term matching a declared alias also surfaces in matchedAliases", () => {
    const dir = project();
    const j = JSON.parse(
      compileFromCwd({ cwd: dir, task: "login", scopes: ["auth"], format: "json", explain: true, aliases: true }),
    );
    const block = j.selected.find((b) => b.file === "decisions.md");
    expect(block, "alias-matched block should surface via scope").toBeTruthy();
    expect(block.explain.matchedAliases).toContain("auth");
  });

  it("multiple matching aliases all appear in matchedAliases", () => {
    const dir = mkdtempSync(join(tmpdir(), "agentctx-explainalias-multi-"));
    tempRoots.push(dir);
    initAgentctx({ cwd: dir });
    writeFileSync(
      join(dir, ".agentctx", "decisions.md"),
      "# Decisions\n\n## Session handling #session\n\nAliases: auth, authentication, oauth\n\nSigned cookie session.\n",
    );
    const j = JSON.parse(
      compileFromCwd({
        cwd: dir,
        task: "auth authentication",
        scopes: [],
        format: "json",
        explain: true,
        aliases: true,
      }),
    );
    const block = j.selected.find((b) => b.file === "decisions.md");
    expect(block, "block should surface").toBeTruthy();
    expect(block.explain.matchedAliases).toContain("auth");
    expect(block.explain.matchedAliases).toContain("authentication");
    expect(block.explain.matchedAliases).not.toContain("oauth");
  });

  it("explain tuple has only core keys when aliases is on but no alias fires", () => {
    const SOURCES = {
      "constraints.md": "# Constraints\n\n## Safe rule #safety\n\nbe careful\n",
      "direction.md": "# Direction\n\n## Perf #perf\n\nmake things fast\n",
    };
    const pack = compileContext({ sources: SOURCES, task: "perf", scopes: ["perf"], aliases: true });
    for (const block of pack.selected) {
      expect(explainBlock(block).matchedAliases).toBeUndefined();
    }
  });
});
