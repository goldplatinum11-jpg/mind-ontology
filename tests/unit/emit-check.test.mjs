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
import { afterEach, describe, expect, it, vi } from "vitest";
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

// Nearly every test spawns 2-4 CLI subprocesses (init/emit/check); under a
// fully parallel suite run on a loaded machine the 5s default flakes.
vi.setConfig({ testTimeout: 60_000 });

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

  it("--explain parses only with --check; in write mode it is a usage error", () => {
    expect(parseEmitArgv(["--check", "--explain"]).explain).toBe(true);
    expect(parseEmitArgv(["--check"]).explain).toBe(false);
    expect(() => parseEmitArgv(["--explain"])).toThrow(
      /--explain is only valid together with --check/,
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

describe("--check --explain drift explanation (read-only, W2 §13 item 15)", () => {
  const EXPLAIN_KEYS = [
    "status",
    "managed",
    "headerPresent",
    "payloadDigestMatchesHeader",
    "sourceDigestMatchesCurrent",
    "emitVersionMatches",
    "expectedProfile",
    "reconcileCommand",
    "wouldWritePaths",
  ];

  it("without --explain the base text output is byte-for-byte unchanged", () => {
    const cwd = emitted();
    const base = runCli(["emit", "--cwd", cwd, "--check"]);
    expect(base.status).toBe(0);
    // No explanation lines, no "why:" annotations leak in.
    expect(base.stdout).not.toContain("why:");
  });

  it("without --explain the base json shape has no targets[].explain", () => {
    const cwd = emitted();
    const r = runCli(["emit", "--cwd", cwd, "--check", "--format", "json"]);
    const parsed = JSON.parse(r.stdout);
    expect(Object.keys(parsed)).toEqual(["ok", "targets"]);
    for (const t of parsed.targets) {
      expect(Object.keys(t)).toEqual(["target", "path", "status", "detail"]);
      expect(t).not.toHaveProperty("explain");
    }
  });

  it("text mode: prints an explanation line after each classification", () => {
    const cwd = emitted();
    const r = runCli(["emit", "--cwd", cwd, "--check", "--explain"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("OK           AGENTS.md (agents-md, profile default)");
    // One explanation per target.
    expect((r.stdout.match(/why:/g) ?? []).length).toBe(2);
    expect(r.stdout).toContain("nothing to reconcile");
  });

  it("text mode STALE: explanation names the source change and the reconcile command", () => {
    const cwd = emitted();
    appendFileSync(join(cwd, ".agentctx", "constraints.md"), "\n## Extra rule\n\nAdded.\n");
    const r = runCli(["emit", "--cwd", cwd, "--check", "--target", "agents-md", "--explain"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("STALE");
    expect(r.stdout).toContain(".agentctx/ sources changed since last emit");
    expect(r.stdout).toContain("writing AGENTS.md: mind-ontology emit --reconcile --target agents-md");
  });

  it("text mode HAND-EDITED: explanation says to move the edit into the source first", () => {
    const cwd = emitted();
    appendFileSync(join(cwd, "AGENTS.md"), "\nA hand edit.\n");
    const r = runCli(["emit", "--cwd", cwd, "--check", "--target", "agents-md", "--explain"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("HAND-EDITED");
    expect(r.stdout).toContain("move the hand-edit into the .agentctx/ source first");
  });

  it("json mode: each target gains a fully-populated explain object", () => {
    const cwd = emitted();
    const r = runCli(["emit", "--cwd", cwd, "--check", "--format", "json", "--explain"]);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(Object.keys(parsed)).toEqual(["ok", "targets"]); // base shape preserved
    for (const t of parsed.targets) {
      expect(Object.keys(t)).toEqual(["target", "path", "status", "detail", "explain"]);
      expect(Object.keys(t.explain)).toEqual(EXPLAIN_KEYS);
      expect(t.explain.status).toBe(t.status);
    }
    const agents = parsed.targets.find((t) => t.target === "agents-md");
    expect(agents.explain).toMatchObject({
      status: "ok",
      managed: true,
      headerPresent: true,
      payloadDigestMatchesHeader: true,
      sourceDigestMatchesCurrent: true,
      emitVersionMatches: true,
      expectedProfile: "default",
      reconcileCommand: "mind-ontology emit --target agents-md",
      wouldWritePaths: [],
    });
  });

  it("json explain reflects MISSING/UNMANAGED facts and reconcile commands", () => {
    const cwd = emitted();
    unlinkSync(join(cwd, "AGENTS.md"));
    // Strip the header off CLAUDE.md to make it UNMANAGED.
    const claudePath = join(cwd, "CLAUDE.md");
    const claude = readFileSync(claudePath, "utf8");
    writeFileSync(claudePath, claude.slice(claude.indexOf("-->\n") + 4));

    const r = runCli(["emit", "--cwd", cwd, "--check", "--format", "json", "--explain"]);
    expect(r.status).toBe(1);
    const parsed = JSON.parse(r.stdout);
    const agents = parsed.targets.find((t) => t.target === "agents-md");
    const claudeT = parsed.targets.find((t) => t.target === "claude-md");

    expect(agents.explain).toMatchObject({
      status: "missing",
      managed: false,
      headerPresent: false,
      payloadDigestMatchesHeader: null,
      sourceDigestMatchesCurrent: null,
      emitVersionMatches: null,
      expectedProfile: "default",
      // MISSING is safe to auto-reconcile -> the explain command points at the
      // --reconcile flow (Lane 2).
      reconcileCommand: "mind-ontology emit --reconcile --target agents-md",
      wouldWritePaths: ["AGENTS.md"],
    });
    expect(claudeT.explain).toMatchObject({
      status: "unmanaged",
      managed: false,
      headerPresent: false,
      reconcileCommand: "mind-ontology emit --force --target claude-md",
      wouldWritePaths: ["CLAUDE.md"],
    });
  });

  it("--check --explain writes nothing, even for MISSING and HAND-EDITED targets", () => {
    const cwd = emitted();
    unlinkSync(join(cwd, "AGENTS.md")); // MISSING
    appendFileSync(join(cwd, "CLAUDE.md"), "\nA hand edit.\n"); // HAND-EDITED
    const claudeBefore = readFileSync(join(cwd, "CLAUDE.md"), "utf8");

    const r = runCli(["emit", "--cwd", cwd, "--check", "--explain"]);
    expect(r.status).toBe(1);
    // The missing target is NOT created; the hand-edited one is NOT rewritten.
    expect(existsSync(join(cwd, "AGENTS.md"))).toBe(false);
    expect(readFileSync(join(cwd, "CLAUDE.md"), "utf8")).toBe(claudeBefore);
  });

  it("--explain without --check is a usage error: exit 2, nothing written", () => {
    const cwd = project();
    const r = runCli(["emit", "--cwd", cwd, "--explain"]);
    expect(r.status).toBe(2);
    expect(r.stdout).toBe("");
    expect(r.stderr).toMatch(/--explain is only valid together with --check/);
    expect(existsSync(join(cwd, "AGENTS.md"))).toBe(false);
    expect(existsSync(join(cwd, "CLAUDE.md"))).toBe(false);
  });
});

describe("--block-manifest opt-in provenance (Phase 2, read-only)", () => {
  const BLOCK_MANIFEST_KEYS = [
    "emitted_index",
    "forced",
    "rendered_digest",
    "section",
    "source_block_digest",
    "source_block_index",
    "source_file",
  ];

  it("attaches a per-block manifest to each target, after explain, base shape intact", () => {
    const cwd = emitted();
    const r = runCli([
      "emit", "--cwd", cwd, "--check", "--format", "json", "--explain", "--block-manifest",
    ]);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(Object.keys(parsed)).toEqual(["ok", "targets"]); // base shape preserved
    for (const t of parsed.targets) {
      // block_manifest is appended after explain; nothing else changes.
      expect(Object.keys(t)).toEqual(["target", "path", "status", "detail", "explain", "block_manifest"]);
      expect(Array.isArray(t.block_manifest)).toBe(true);
      expect(t.block_manifest.length).toBeGreaterThan(0);
      t.block_manifest.forEach((entry, i) => {
        expect(Object.keys(entry).sort()).toEqual(BLOCK_MANIFEST_KEYS);
        expect(entry.emitted_index).toBe(i);
        expect(entry.source_block_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
        expect(entry.rendered_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
      });
    }
  });

  it("a MISSING target still recomputes the manifest it WOULD emit (default profile)", () => {
    const cwd = emitted();
    unlinkSync(join(cwd, "AGENTS.md")); // MISSING
    const r = runCli([
      "emit", "--cwd", cwd, "--check", "--format", "json", "--explain", "--block-manifest", "--target", "agents-md",
    ]);
    expect(r.status).toBe(1); // drift (missing) -> exit 1, but manifest is recomputable
    const agents = JSON.parse(r.stdout).targets.find((t) => t.target === "agents-md");
    expect(agents.status).toBe("missing");
    expect(Array.isArray(agents.block_manifest)).toBe(true);
    expect(agents.block_manifest.length).toBeGreaterThan(0);
  });

  // Both unreproducible-STALE shapes must report block_manifest: null, in
  // lock-step with --explain's sourceDigestMatchesCurrent === null. Rewriting
  // only a header line leaves the payload (hence content_digest) intact, so the
  // class is STALE-unreproducible, never HAND-EDITED.
  for (const [label, from, to] of [
    ["an unknown recorded profile", "profile: default", "profile: bogus"],
    ["a non-v1 recorded target", "target: agents-md", "target: bogus-target"],
  ]) {
    it(`reports block_manifest: null for ${label} (cannot recompute)`, () => {
      const cwd = emitted();
      const p = join(cwd, "AGENTS.md");
      const original = readFileSync(p, "utf8");
      const corrupted = original.replace(from, to);
      expect(corrupted).not.toBe(original);
      writeFileSync(p, corrupted);
      const r = runCli([
        "emit", "--cwd", cwd, "--check", "--format", "json", "--explain", "--block-manifest", "--target", "agents-md",
      ]);
      expect(r.status).toBe(1);
      const agents = JSON.parse(r.stdout).targets.find((t) => t.target === "agents-md");
      expect(agents.status).toBe("stale");
      // Consistency: explain flags it unreproducible, so the manifest is null.
      expect(agents.explain.sourceDigestMatchesCurrent).toBeNull();
      expect(agents.block_manifest).toBeNull();
    });
  }

  it("writes nothing — even with a MISSING target in the set", () => {
    const cwd = emitted();
    unlinkSync(join(cwd, "AGENTS.md"));
    const claudeBefore = readFileSync(join(cwd, "CLAUDE.md"), "utf8");
    const r = runCli([
      "emit", "--cwd", cwd, "--check", "--format", "json", "--explain", "--block-manifest",
    ]);
    expect(r.status).toBe(1);
    expect(existsSync(join(cwd, "AGENTS.md"))).toBe(false); // not created
    expect(readFileSync(join(cwd, "CLAUDE.md"), "utf8")).toBe(claudeBefore); // not rewritten
  });

  it("is a usage error without --explain / without json / without --check (exit 2, nothing written)", () => {
    const cwd = project();
    for (const argv of [
      ["emit", "--cwd", cwd, "--check", "--format", "json", "--block-manifest"], // no --explain
      ["emit", "--cwd", cwd, "--check", "--explain", "--block-manifest"], // text format
      ["emit", "--cwd", cwd, "--block-manifest"], // no --check
    ]) {
      const r = runCli(argv);
      expect(r.status, argv.join(" ")).toBe(2);
      expect(r.stdout).toBe("");
      expect(r.stderr).toMatch(/--block-manifest is only valid with --check --explain --format json/);
    }
    expect(existsSync(join(cwd, "AGENTS.md"))).toBe(false);
    expect(existsSync(join(cwd, "CLAUDE.md"))).toBe(false);
  });

  it("parseEmitArgv accepts the canonical combination and rejects the rest", () => {
    expect(
      parseEmitArgv(["--check", "--explain", "--format", "json", "--block-manifest"]).blockManifest,
    ).toBe(true);
    expect(() => parseEmitArgv(["--check", "--explain", "--block-manifest"])).toThrow(
      /--block-manifest is only valid with --check --explain --format json/,
    );
    expect(() => parseEmitArgv(["--check", "--format", "json", "--block-manifest"])).toThrow(
      /--block-manifest is only valid with --check --explain --format json/,
    );
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
