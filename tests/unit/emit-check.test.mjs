import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  DUAL_TARGET_NOTE,
  PAYLOAD_LINE_BUDGET,
  parseEmitArgv,
  parseEmitHeader,
} from "../../scripts/agentctx/emit.mjs";

// W3 behavioral guards (W2 §13 items 8-12, 14): determinism, the --check
// classification matrix with its exit codes and detail wording, CRLF
// immunity, budget warning, dual-target advisory, and the all-or-nothing
// UNMANAGED refusal. Everything here is built in temp dirs, not stored
// goldens.

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = resolve(REPO_ROOT, "scripts/agentctx/cli.mjs");
const TEMPLATE_AGENTCTX = resolve(REPO_ROOT, "templates/mind-ontology/.agentctx");

const tempRoots = [];
function project() {
  const cwd = mkdtempSync(join(tmpdir(), "mo-emit-check-"));
  tempRoots.push(cwd);
  cpSync(TEMPLATE_AGENTCTX, join(cwd, ".agentctx"), { recursive: true });
  return cwd;
}
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
}

function emitted() {
  const cwd = project();
  expect(runCli(["emit", "--cwd", cwd]).status, "fixture: emit should succeed").toBe(0);
  return cwd;
}

describe("argv contract (W2 §7.1)", () => {
  it("--target accepts CSV and repeats, dedupes, and processes in registry order", () => {
    const p = parseEmitArgv(["--target", "claude-md,agents-md", "--target", "claude-md"]);
    expect(p.targets).toEqual(["agents-md", "claude-md"]);
  });

  it("defaults to all v1 targets when --target is absent", () => {
    expect(parseEmitArgv([]).targets).toEqual(["agents-md", "claude-md"]);
  });

  it("rejects an unknown target id naming the registry", () => {
    expect(() => parseEmitArgv(["--target", "cursor"])).toThrow(
      /--target must be one of "agents-md", "claude-md", got: cursor/,
    );
  });

  it("rejects an empty --target value", () => {
    expect(() => parseEmitArgv(["--target", ""])).toThrow(/got: \(empty\)/);
  });

  it("rejects --full with --check and --force with --check", () => {
    expect(() => parseEmitArgv(["--full", "--check"])).toThrow(
      /--full cannot be combined with --check/,
    );
    expect(() => parseEmitArgv(["--force", "--check"])).toThrow(
      /--force cannot be combined with --check/,
    );
  });

  it("rejects a bad --format with the allowed values", () => {
    expect(() => parseEmitArgv(["--format", "xml"])).toThrow(
      /--format must be "text" or "json", got: xml/,
    );
  });
});

describe("determinism and idempotency (freeze 8, W1 §7/§9)", () => {
  it("two independent emits of the same sources are byte-identical", () => {
    const a = emitted();
    const b = emitted();
    for (const file of ["AGENTS.md", "CLAUDE.md"]) {
      expect(readFileSync(join(a, file), "utf8")).toBe(readFileSync(join(b, file), "utf8"));
    }
  });

  it("re-emitting over a fresh artifact is a byte-identical no-op", () => {
    const cwd = emitted();
    const before = readFileSync(join(cwd, "AGENTS.md"), "utf8");
    const r = runCli(["emit", "--cwd", cwd]);
    expect(r.status).toBe(0);
    expect(readFileSync(join(cwd, "AGENTS.md"), "utf8")).toBe(before);
  });

  it("the artifact never embeds a wall-clock timestamp", () => {
    const cwd = emitted();
    const artifact = readFileSync(join(cwd, "AGENTS.md"), "utf8");
    expect(artifact).not.toMatch(/generatedAt|Generated:/);
    expect(artifact).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });
});

describe("--check classification matrix (freeze 9, W1 §8)", () => {
  it("fresh artifacts: every target OK, exit 0", () => {
    const cwd = emitted();
    const r = runCli(["emit", "--cwd", cwd, "--check"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("OK           AGENTS.md (agents-md, profile default)");
    expect(r.stdout).toContain("OK           CLAUDE.md (claude-md, profile default)");
    expect(r.stdout).toContain("OK - 2 of 2 targets fresh");
    expect(r.stderr).toBe("");
  });

  it("source edit -> STALE, exit 1, actionable detail", () => {
    const cwd = emitted();
    appendFileSync(join(cwd, ".agentctx", "constraints.md"), "\n## Extra rule\n\nAdded.\n");
    const r = runCli(["emit", "--cwd", cwd, "--check"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/STALE {8}AGENTS\.md \(agents-md\) - \.agentctx\/ changed \(or emit_version bumped\) since last emit; run: mind-ontology emit --target agents-md/);
    expect(r.stdout).toContain("DRIFT - 2 of 2 targets need attention");
  });

  it("payload edit -> HAND-EDITED, exit 1, names the loss and the diff hint", () => {
    const cwd = emitted();
    appendFileSync(join(cwd, "AGENTS.md"), "\nA hand edit.\n");
    const r = runCli(["emit", "--cwd", cwd, "--check", "--target", "agents-md"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("HAND-EDITED  AGENTS.md (agents-md) - file was edited after generation; hand edits will be lost on re-emit.");
    expect(r.stdout).toContain("git diff AGENTS.md");
  });

  it("hand-edit beats stale: payload edit plus source edit still reports HAND-EDITED", () => {
    const cwd = emitted();
    appendFileSync(join(cwd, "AGENTS.md"), "\nA hand edit.\n");
    appendFileSync(join(cwd, ".agentctx", "constraints.md"), "\n## Extra\n\nAlso moved.\n");
    const r = runCli(["emit", "--cwd", cwd, "--check", "--target", "agents-md"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("HAND-EDITED");
    expect(r.stdout).not.toContain("STALE");
  });

  it("header deleted -> UNMANAGED, exit 1, points at --force", () => {
    const cwd = emitted();
    const path = join(cwd, "AGENTS.md");
    const content = readFileSync(path, "utf8");
    writeFileSync(path, content.slice(content.indexOf("-->\n") + 4));
    const r = runCli(["emit", "--cwd", cwd, "--check", "--target", "agents-md"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("UNMANAGED    AGENTS.md (agents-md) - file exists but is not managed by emit; emit will not touch it without --force.");
  });

  it("file deleted -> MISSING, exit 1, says emit it", () => {
    const cwd = emitted();
    unlinkSync(join(cwd, "AGENTS.md"));
    const r = runCli(["emit", "--cwd", cwd, "--check", "--target", "agents-md"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("MISSING      AGENTS.md (agents-md) - artifact has never been emitted (or was deleted); run: mind-ontology emit --target agents-md");
  });

  it("emit_version mismatch -> STALE even with untouched sources and payload (W1 §9)", () => {
    const cwd = emitted();
    const path = join(cwd, "AGENTS.md");
    writeFileSync(path, readFileSync(path, "utf8").replace(/^emit_version: \d+$/m, "emit_version: 99"));
    const r = runCli(["emit", "--cwd", cwd, "--check", "--target", "agents-md"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("STALE");
  });

  it("broken ontology -> hard error: exit 2, stderr message, no partial report", () => {
    const cwd = emitted();
    writeFileSync(join(cwd, ".agentctx", "constraints.md"), "");
    const r = runCli(["emit", "--cwd", cwd, "--check"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/Required Mind Ontology source is empty/);
    expect(r.stdout).toBe("");
  });

  it("check-mode usage errors exit 2, keeping 1 reserved for drift (W2 §2.4)", () => {
    const cwd = emitted();
    for (const argv of [
      ["emit", "--cwd", cwd, "--check", "--target", "bogus"],
      ["emit", "--cwd", cwd, "--check", "--full"],
      ["emit", "--cwd", cwd, "--check", "--force"],
    ]) {
      const r = runCli(argv);
      expect(r.status, argv.join(" ")).toBe(2);
      expect(r.stdout, argv.join(" ")).toBe("");
    }
  });

  it("--check writes nothing, even when targets are missing", () => {
    const cwd = project();
    const r = runCli(["emit", "--cwd", cwd, "--check"]);
    expect(r.status).toBe(1);
    expect(existsSync(join(cwd, "AGENTS.md"))).toBe(false);
    expect(existsSync(join(cwd, "CLAUDE.md"))).toBe(false);
  });

  it("--check --format json mirrors the text classification 1:1 (W2 §7.4)", () => {
    const cwd = emitted();
    unlinkSync(join(cwd, "CLAUDE.md"));
    const r = runCli(["emit", "--cwd", cwd, "--check", "--format", "json"]);
    expect(r.status).toBe(1);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.targets[0]).toEqual({ target: "agents-md", path: "AGENTS.md", status: "ok", detail: null });
    expect(parsed.targets[1].status).toBe("missing");
    expect(parsed.targets[1].detail).toContain("run: mind-ontology emit --target claude-md");
  });
});

describe("CRLF round-trip immunity (freeze 10, W1 §9)", () => {
  it("an artifact rewritten with CRLF line endings still checks OK", () => {
    const cwd = emitted();
    const path = join(cwd, "AGENTS.md");
    writeFileSync(path, readFileSync(path, "utf8").replace(/\n/g, "\r\n"));
    const r = runCli(["emit", "--cwd", cwd, "--check", "--target", "agents-md"]);
    expect(r.status, r.stdout).toBe(0);
    expect(r.stdout).toContain("OK");
  });
});

describe("budget overflow warning (freeze 11, W1 §3)", () => {
  it("a >400-payload-line ontology emits exit 0 with the stderr warning naming target and contributors", () => {
    const cwd = mkdtempSync(join(tmpdir(), "mo-emit-budget-"));
    tempRoots.push(cwd);
    const blocks = [];
    for (let i = 1; i <= 60; i += 1) {
      blocks.push(`## Rule number ${i} #context\n\nLine one of rule ${i}.\nLine two of rule ${i}.\nLine three of rule ${i}.\nLine four of rule ${i}.\nLine five of rule ${i}.`);
    }
    cpSync(TEMPLATE_AGENTCTX, join(cwd, ".agentctx"), { recursive: true });
    writeFileSync(join(cwd, ".agentctx", "constraints.md"), `# Constraints\n\n${blocks.join("\n\n")}\n`);
    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md"]);
    expect(r.status).toBe(0); // warn-only, never an error (operator ruling W1 Q2)
    expect(r.stderr).toMatch(new RegExp(`warning: agents-md payload is \\d+ lines \\(soft budget ${PAYLOAD_LINE_BUDGET}\\); largest contributors: constraints\\.md`));
    expect(existsSync(join(cwd, "AGENTS.md"))).toBe(true);
    // The warning never leaks into the artifact bytes.
    expect(readFileSync(join(cwd, "AGENTS.md"), "utf8")).not.toContain("soft budget");
  });
});

describe("dual-target advisory (freeze 12, W2 §8b)", () => {
  it("prints on a no---target emit of both targets", () => {
    const cwd = project();
    const r = runCli(["emit", "--cwd", cwd]);
    expect(r.status).toBe(0);
    expect(r.stderr).toContain(DUAL_TARGET_NOTE);
  });

  it("never prints when --target is given, and never changes artifact bytes", () => {
    const cwdDefault = project();
    runCli(["emit", "--cwd", cwdDefault]);
    const cwdExplicit = project();
    const r = runCli(["emit", "--cwd", cwdExplicit, "--target", "agents-md,claude-md"]);
    expect(r.status).toBe(0);
    expect(r.stderr).toBe("");
    for (const file of ["AGENTS.md", "CLAUDE.md"]) {
      expect(readFileSync(join(cwdExplicit, file), "utf8")).toBe(
        readFileSync(join(cwdDefault, file), "utf8"),
      );
      expect(readFileSync(join(cwdExplicit, file), "utf8")).not.toContain("identical payloads");
    }
  });
});

describe("UNMANAGED refusal is all-or-nothing (freeze 14, W1 §9, W2 §7.2)", () => {
  it("a pre-existing headerless AGENTS.md blocks the whole multi-target emit", () => {
    const cwd = project();
    writeFileSync(join(cwd, "AGENTS.md"), "# AGENTS.md\n\nHand-written.\n");
    const r = runCli(["emit", "--cwd", cwd]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Refusing to overwrite AGENTS\.md: file exists but has no emit header/);
    // Nothing written for ANY target: no half-written pair.
    expect(existsSync(join(cwd, "CLAUDE.md"))).toBe(false);
    expect(readFileSync(join(cwd, "AGENTS.md"), "utf8")).toBe("# AGENTS.md\n\nHand-written.\n");
  });

  it("--force overwrites the unmanaged file; refreshing a managed one never needs it", () => {
    const cwd = project();
    writeFileSync(join(cwd, "AGENTS.md"), "# AGENTS.md\n\nHand-written.\n");
    const forced = runCli(["emit", "--cwd", cwd, "--force"]);
    expect(forced.status).toBe(0);
    expect(parseEmitHeader(readFileSync(join(cwd, "AGENTS.md"), "utf8"))).not.toBeNull();
    // Now managed: a plain re-emit succeeds without --force, even hand-edited.
    appendFileSync(join(cwd, "AGENTS.md"), "\nDrift.\n");
    expect(runCli(["emit", "--cwd", cwd]).status).toBe(0);
  });
});

describe("write-mode hard errors (W2 §2.4: uniform exit 1)", () => {
  it("unknown target id exits 1 with nothing written", () => {
    const cwd = project();
    const r = runCli(["emit", "--cwd", cwd, "--target", "bogus"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/--target must be one of "agents-md", "claude-md", got: bogus/);
    expect(existsSync(join(cwd, "AGENTS.md"))).toBe(false);
  });

  it("compile errors pass through unchanged (missing .agentctx/)", () => {
    const cwd = mkdtempSync(join(tmpdir(), "mo-emit-none-"));
    tempRoots.push(cwd);
    const r = runCli(["emit", "--cwd", cwd]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Missing \.agentctx\//);
  });
});

describe("header parser (W1 §6)", () => {
  const HEADER = [
    "<!-- mind-ontology:emit",
    "target: agents-md",
    "profile: default",
    "emit_version: 1",
    "source: .agentctx/",
    "source_digest: sha256:" + "0".repeat(64),
    "content_digest: sha256:" + "0".repeat(64),
    "note: GENERATED FILE - do not hand-edit. Edit .agentctx/ and re-run: mind-ontology emit",
    "-->",
    "payload",
    "",
  ].join("\n");

  it("parses a well-formed header and returns the payload after the terminator", () => {
    const parsed = parseEmitHeader(HEADER);
    expect(parsed.header.target).toBe("agents-md");
    expect(parsed.payload).toBe("payload\n");
  });

  it("ignores unknown keys (forward compatibility)", () => {
    const withExtra = HEADER.replace("-->", "future_key: hello\n-->");
    expect(parseEmitHeader(withExtra)).not.toBeNull();
  });

  it("rejects a header missing any required key", () => {
    const missing = HEADER.replace(/^profile: default\n/m, "");
    expect(parseEmitHeader(missing)).toBeNull();
  });

  it("rejects content with no header block at all", () => {
    expect(parseEmitHeader("# AGENTS.md\n\nplain file\n")).toBeNull();
  });
});
