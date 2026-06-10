import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  compileContext,
  explainBlock,
  parseArgv,
  renderContextPack,
  renderContextPackJson,
} from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const COMPILE_CLI = resolve(REPO_ROOT, "scripts/agentctx/compile.mjs");

// The CLI-surface tests spawn subprocesses; the 5s default flakes under a
// fully parallel suite run on a loaded machine.
vi.setConfig({ testTimeout: 60_000 });

// One fixture exercises all three inclusion reasons at once:
// - constraints.md blocks -> "constraint" (always included),
// - direction.md "Perf" -> "scored" (scope tag match),
// - decisions.md "Rollback" -> "risk-forced" ("delete" classifies the task
//   risky; the block scores 0 against the task, so only the risk sweep
//   can pull it in).
const SOURCES = {
  "constraints.md": "# Constraints\n\n## Safe rule #safety\n\nbe careful\n",
  "direction.md": "# Direction\n\n## Perf #perf\n\nmake the booking path fast\n",
  "decisions.md": "# Decisions\n\n## Rollback #safety\n\nalways have a rollback plan\n",
};
const FIXED_NOW = new Date("2026-06-10T00:00:00.000Z");
const ARGS = {
  sources: SOURCES,
  task: "delete the old booking index",
  scopes: ["perf"],
  now: FIXED_NOW,
};

const reasonsByFile = (pack) =>
  Object.fromEntries(pack.selected.map((b) => [b.file, explainBlock(b)]));

describe("W5 — explain tuple semantics (W2 §5)", () => {
  it("maps internal inclusion reasons onto the spec enum", () => {
    const tuples = reasonsByFile(compileContext(ARGS));
    expect(tuples["constraints.md"].reason).toBe("constraint");
    expect(tuples["direction.md"].reason).toBe("scored");
    expect(tuples["decisions.md"].reason).toBe("risk-forced");
  });

  it("score is the lexical score for scored inclusion, null otherwise", () => {
    const tuples = reasonsByFile(compileContext(ARGS));
    expect(tuples["constraints.md"].score).toBeNull();
    expect(tuples["decisions.md"].score).toBeNull();
    expect(typeof tuples["direction.md"].score).toBe("number");
    expect(tuples["direction.md"].score).toBeGreaterThan(0);
  });

  it("heading is the tag-stripped block title and sourceFile the .agentctx file", () => {
    const tuples = reasonsByFile(compileContext(ARGS));
    expect(tuples["constraints.md"]).toMatchObject({
      sourceFile: "constraints.md",
      heading: "Safe rule",
    });
    expect(tuples["decisions.md"].heading).toBe("Rollback");
  });

  it("the tuple has exactly the four spec keys", () => {
    const pack = compileContext(ARGS);
    for (const block of pack.selected) {
      expect(Object.keys(explainBlock(block))).toEqual([
        "sourceFile",
        "heading",
        "score",
        "reason",
      ]);
    }
  });
});

describe("W5 — non-explain output is byte-untouched", () => {
  it("renders with no options exactly as with explain disabled", () => {
    const pack = compileContext(ARGS);
    expect(renderContextPack(pack)).toBe(renderContextPack(pack, { explain: false }));
    expect(renderContextPackJson(pack)).toBe(renderContextPackJson(pack, { explain: false }));
  });

  it("default output carries no explain artifacts", () => {
    const pack = compileContext(ARGS);
    expect(renderContextPack(pack)).not.toContain("Explain:");
    expect(renderContextPackJson(pack)).not.toContain('"explain"');
  });

  it("parseArgv defaults explain to false and accepts --explain", () => {
    expect(parseArgv(["compile", "--task", "x"]).explain).toBe(false);
    expect(parseArgv(["compile", "--task", "x", "--explain"]).explain).toBe(true);
  });
});

describe("W5 — explain output is deterministic", () => {
  it("two explain renders of the same pack are byte-identical (both formats)", () => {
    const render = () => {
      const pack = compileContext(ARGS);
      return renderContextPack(pack, { explain: true }) + renderContextPackJson(pack, { explain: true });
    };
    expect(render()).toBe(render());
  });

  it("explain adds the tuple without disturbing existing JSON fields", () => {
    const pack = compileContext(ARGS);
    const plain = JSON.parse(renderContextPackJson(pack));
    const explained = JSON.parse(renderContextPackJson(pack, { explain: true }));
    expect(explained.selected).toHaveLength(plain.selected.length);
    explained.selected.forEach((block, i) => {
      const { explain, ...rest } = block;
      expect(rest).toEqual(plain.selected[i]);
      expect(explain).toEqual(explainBlock(pack.selected[i]));
    });
  });
});

describe("W5 — compile CLI surface", () => {
  const project = () => {
    const cwd = mkdtempSync(join(tmpdir(), "agentctx-explain-"));
    mkdirSync(join(cwd, ".agentctx"));
    writeFileSync(join(cwd, ".agentctx", "constraints.md"), SOURCES["constraints.md"]);
    writeFileSync(join(cwd, ".agentctx", "direction.md"), SOURCES["direction.md"]);
    writeFileSync(join(cwd, ".agentctx", "decisions.md"), SOURCES["decisions.md"]);
    return cwd;
  };
  const run = (args) =>
    spawnSync(process.execPath, [COMPILE_CLI, "compile", ...args], { encoding: "utf8" });

  it("--explain --format json exposes the tuple per selected block", () => {
    const cwd = project();
    const r = run(["--cwd", cwd, "--task", ARGS.task, "--scope", "perf", "--explain", "--format", "json"]);
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.selected.length).toBeGreaterThan(0);
    for (const block of out.selected) {
      expect(block.explain).toMatchObject({ sourceFile: block.file });
      expect(["constraint", "scored", "risk-forced"]).toContain(block.explain.reason);
    }
  });

  it("--explain in markdown mode adds one Explain line per block", () => {
    const cwd = project();
    const r = run(["--cwd", cwd, "--task", ARGS.task, "--scope", "perf", "--explain"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Explain: sourceFile=constraints.md heading="Safe rule" score=null reason=constraint');
  });

  it("without --explain the CLI output carries no explain artifacts", () => {
    const cwd = project();
    const md = run(["--cwd", cwd, "--task", ARGS.task, "--scope", "perf"]);
    const json = run(["--cwd", cwd, "--task", ARGS.task, "--scope", "perf", "--format", "json"]);
    expect(md.status).toBe(0);
    expect(json.status).toBe(0);
    expect(md.stdout).not.toContain("Explain:");
    expect(json.stdout).not.toContain('"explain"');
  });
});
