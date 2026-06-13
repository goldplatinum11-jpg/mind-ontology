import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { compileFromCwd, parseArgv, scoreBlock, tokenize } from "../../scripts/agentctx/compile.mjs";
import { initAgentctx } from "../../scripts/agentctx/init.mjs";

const tempRoots = [];
function project() {
  const dir = mkdtempSync(join(tmpdir(), "agentctx-rich-"));
  tempRoots.push(dir);
  initAgentctx({ cwd: dir });
  return dir;
}
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

const headingBlock = { title: "Auth setup", tags: ["auth"], body: "Some general guidance here." };
const bodyBlock = { title: "Other topic", tags: ["other"], body: "configure auth somewhere in here." };
const tokens = tokenize("auth");

describe("--rich-scoring: opt-in heading-weight signal", () => {
  it("default (no opts) scores identically to richScoring:false — byte-for-byte legacy", () => {
    for (const b of [headingBlock, bodyBlock]) {
      expect(scoreBlock(b, tokens, [])).toBe(scoreBlock(b, tokens, [], { richScoring: false }));
    }
  });

  it("rich scoring boosts a heading/tag hit but leaves a body-only hit unchanged", () => {
    const headingPlain = scoreBlock(headingBlock, tokens, []);
    const headingRich = scoreBlock(headingBlock, tokens, [], { richScoring: true });
    const bodyPlain = scoreBlock(bodyBlock, tokens, []);
    const bodyRich = scoreBlock(bodyBlock, tokens, [], { richScoring: true });

    expect(headingRich).toBeGreaterThan(headingPlain); // heading hit earns the extra boost
    expect(bodyRich).toBe(bodyPlain); // body-only hit gets no boost
  });

  it("scope hits in the heading also get the richer boost", () => {
    const scopes = ["auth"];
    const plain = scoreBlock(headingBlock, tokenize("auth"), scopes);
    const rich = scoreBlock(headingBlock, tokenize("auth"), scopes, { richScoring: true });
    expect(rich).toBeGreaterThan(plain);
  });
});

describe("backward compatibility: rich scoring is purely additive", () => {
  it("compileFromCwd selection without the flag matches richScoring:false explicitly", () => {
    const dir = project();
    const task = "which project is active and what is the direction";
    // Compare the selection (scoring result), not the whole render — generatedAt is a
    // timestamp that differs between calls and is unrelated to scoring behavior.
    const sel = (richScoring) => {
      const p = JSON.parse(compileFromCwd({ cwd: dir, task, scopes: [], format: "json", richScoring }));
      return p.selected.map((b) => `${b.file}/${b.title}/${b.score}`);
    };
    expect(sel(undefined)).toEqual(sel(false));
  });

  it("parseArgv exposes --rich-scoring and defaults it off", () => {
    expect(parseArgv(["compile", "--task", "x", "--rich-scoring"]).richScoring).toBe(true);
    expect(parseArgv(["compile", "--task", "x"]).richScoring).toBeUndefined();
  });
});
