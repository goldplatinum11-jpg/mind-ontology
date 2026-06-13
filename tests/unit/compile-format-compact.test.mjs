import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { compileFromCwd, parseArgv } from "../../scripts/agentctx/compile.mjs";
import { initAgentctx } from "../../scripts/agentctx/init.mjs";

const tempRoots = [];
function project() {
  const dir = mkdtempSync(join(tmpdir(), "agentctx-compact-"));
  tempRoots.push(dir);
  initAgentctx({ cwd: dir });
  return dir;
}
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

const SAFE_TASK = "What is the current direction and which project is active?";
const RISKY_TASK = "delete the production database and drop all records";

describe("--format compact: a token-tight rendering of the answer blocks", () => {
  it("emits each selected block (file/title + body) and nothing else", () => {
    const dir = project();
    const compact = compileFromCwd({ cwd: dir, task: SAFE_TASK, scopes: [], format: "compact" });
    const json = JSON.parse(compileFromCwd({ cwd: dir, task: SAFE_TASK, scopes: [], format: "json" }));

    expect(compact.startsWith("# context pack:")).toBe(true);
    // Every selected block surfaces by heading and carries its body.
    for (const b of json.selected) {
      expect(compact, `compact missing heading for ${b.file}/${b.title}`).toContain(`## ${b.file} / ${b.title}`);
      if (b.body.trim()) expect(compact).toContain(b.body.trim().split("\n")[0]);
    }
    // None of the full-markdown ceremony leaks into compact.
    for (const noise of ["Generated:", "## Omitted Context", "Source:", "Reason:", "# agentctx context pack"]) {
      expect(compact, `compact must not contain "${noise}"`).not.toContain(noise);
    }
  });

  it("adds a one-line risk note only when the task is risky", () => {
    const dir = project();
    const risky = compileFromCwd({ cwd: dir, task: RISKY_TASK, scopes: [], format: "compact" });
    const safe = compileFromCwd({ cwd: dir, task: SAFE_TASK, scopes: [], format: "compact" });
    expect(risky).toContain("Risk: risky");
    expect(safe).not.toContain("Risk:");
  });

  it("carries the same selected blocks as the json render (no content dropped)", () => {
    const dir = project();
    const compact = compileFromCwd({ cwd: dir, task: SAFE_TASK, scopes: [], format: "compact" });
    const json = JSON.parse(compileFromCwd({ cwd: dir, task: SAFE_TASK, scopes: [], format: "json" }));
    const headings = json.selected.map((b) => `## ${b.file} / ${b.title}`);
    expect(headings.length).toBeGreaterThan(0);
    for (const h of headings) expect(compact).toContain(h);
  });
});

describe("backward compatibility: compact is purely additive", () => {
  it("markdown output still carries its full structure unchanged", () => {
    const dir = project();
    const md = compileFromCwd({ cwd: dir, task: SAFE_TASK, scopes: [], format: "markdown" });
    for (const header of ["# agentctx context pack", "## Included Context", "## Omitted Context", "Generated:"]) {
      expect(md, `markdown lost "${header}"`).toContain(header);
    }
  });

  it("json output still parses with its established keys", () => {
    const dir = project();
    const json = JSON.parse(compileFromCwd({ cwd: dir, task: SAFE_TASK, scopes: [], format: "json" }));
    for (const key of ["task", "scopes", "generatedAt", "selected", "omittedCount", "sourceFiles", "risk"]) {
      expect(json, `json lost key "${key}"`).toHaveProperty(key);
    }
  });

  it("the default format is still markdown", () => {
    const dir = project();
    const def = compileFromCwd({ cwd: dir, task: SAFE_TASK, scopes: [] });
    expect(def).toContain("# agentctx context pack");
  });

  it("parseArgv accepts compact and still rejects unknown formats (with compact named)", () => {
    expect(parseArgv(["compile", "--task", "x", "--format", "compact"]).format).toBe("compact");
    expect(parseArgv(["compile", "--task", "x", "--format", "json"]).format).toBe("json");
    expect(parseArgv(["compile", "--task", "x", "--format", "markdown"]).format).toBe("markdown");
    expect(() => parseArgv(["compile", "--task", "x", "--format", "xml"])).toThrow(/compact/);
  });
});
