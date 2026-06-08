import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  compileFromCwd,
  validateAgentctxSources,
} from "../../scripts/agentctx/compile.mjs";

const tempRoots = [];

function makeTempRoot() {
  const dir = mkdtempSync(join(tmpdir(), "agentctx-validate-"));
  tempRoots.push(dir);
  return dir;
}

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop(), { recursive: true, force: true });
  }
});

describe("agentctx source validation", () => {
  it("throws a friendly init hint when .agentctx is missing", () => {
    const cwd = makeTempRoot();

    expect(() => validateAgentctxSources(cwd)).toThrow("npm run agentctx:init");
  });

  it("throws a friendly required-file hint when constraints.md is missing", () => {
    const cwd = makeTempRoot();
    mkdirSync(join(cwd, ".agentctx"));

    expect(() => validateAgentctxSources(cwd)).toThrow(".agentctx/constraints.md");
  });

  it("throws when constraints.md is empty", () => {
    const cwd = makeTempRoot();
    mkdirSync(join(cwd, ".agentctx"));
    writeFileSync(join(cwd, ".agentctx", "constraints.md"), "   \n");

    expect(() => validateAgentctxSources(cwd)).toThrow("is empty");
  });

  it("allows compileFromCwd when required sources exist", () => {
    const cwd = makeTempRoot();
    mkdirSync(join(cwd, ".agentctx"));
    writeFileSync(
      join(cwd, ".agentctx", "constraints.md"),
      "# Constraints\n\n## Keep it safe #safety\n\nDo not make destructive changes.\n",
    );

    const output = compileFromCwd({
      cwd,
      task: "Check safety constraints",
      scopes: ["safety"],
      format: "json",
      maxBlocksPerFile: 1,
      minScore: 2,
    });

    expect(JSON.parse(output).selected[0].title).toBe("Keep it safe");
  });
});
