import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { parseArgv, validateAgentctxSources } from "../../scripts/agentctx/compile.mjs";
import { initAgentctx, parseInitArgv } from "../../scripts/agentctx/init.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const COMPILE_CLI = resolve(REPO_ROOT, "scripts/agentctx/compile.mjs");

const tempRoots = [];
function tmp() {
  const d = mkdtempSync(join(tmpdir(), "agentctx-err-"));
  tempRoots.push(d);
  return d;
}
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

// M42 — every CLI failure mode is actionable and stable.
describe("compile arg/source errors are actionable (M42)", () => {
  it("rejects a bad --format with the allowed values", () => {
    expect(() => parseArgv(["compile", "--task", "x", "--format", "xml"])).toThrow(
      /--format must be "markdown", "json", or "compact"/,
    );
  });
  it("rejects a bad --risk with the allowed values", () => {
    expect(() => parseArgv(["compile", "--task", "x", "--risk", "nope"])).toThrow(/--risk must be "auto", "safe", or "risky"/);
  });
  it("rejects an unknown flag by name", () => {
    expect(() => parseArgv(["compile", "--task", "x", "--bogus"])).toThrow(/Unknown argument: --bogus/);
  });
  it("a missing .agentctx/ points the user at agentctx:init", () => {
    expect(() => validateAgentctxSources(tmp())).toThrow(/Missing \.agentctx\/.*agentctx:init/s);
  });
  it("a missing required constraints.md is named explicitly", () => {
    const cwd = tmp();
    mkdirSync(join(cwd, ".agentctx"));
    expect(() => validateAgentctxSources(cwd)).toThrow(/Missing required Mind Ontology source: \.agentctx\/constraints\.md/);
  });
});

describe("init errors are actionable (M42)", () => {
  it("refuses to clobber and tells the user about --force", () => {
    const cwd = tmp();
    initAgentctx({ cwd });
    expect(() => initAgentctx({ cwd })).toThrow(/already exists\. Re-run with --force/);
  });
  it("names an unknown template", () => {
    expect(() => initAgentctx({ cwd: tmp(), template: "does-not-exist" })).toThrow(/Template not found: does-not-exist/);
  });
  it("rejects an unknown init flag by name", () => {
    expect(() => parseInitArgv(["--bogus"])).toThrow(/Unknown argument: --bogus/);
  });
});

describe("the CLI exits non-zero on error and routes the message to stderr (M42)", () => {
  it("compile with no --task exits 1 with the documented message on stderr", () => {
    const r = spawnSync(process.execPath, [COMPILE_CLI, "compile", "--cwd", tmp()], { encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Missing required --task argument/);
    expect(r.stdout).toBe(""); // nothing on stdout on failure
  });
});

describe("the catalog doc stays in sync with the real messages (M42)", () => {
  it("documents the compile/init failure modes it claims to", () => {
    const doc = readFileSync(resolve(REPO_ROOT, "docs/cli-errors.md"), "utf8");
    for (const needle of [
      "Missing required --task argument",
      "Re-run with --force",
      'must be "markdown", "json", or "compact"',
      "-32700",
      "-32602",
    ]) {
      expect(doc).toContain(needle);
    }
  });
});
