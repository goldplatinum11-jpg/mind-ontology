import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseMarkdownBlocks } from "../../scripts/agentctx/compile.mjs";

// Lane 3c — `emit --reconcile-source --apply`: WRITE the previewed block-body
// patches back into `.agentctx/` sources. The ONLY command that writes sources.
// Surgical (one block body at a time, other bytes untouched), all-or-nothing,
// behind a git-clean recoverability gate; never re-emits artifacts.

vi.setConfig({ testTimeout: 60_000 });

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = resolve(REPO_ROOT, "scripts/agentctx/cli.mjs");
const TEMPLATE_AGENTCTX = resolve(REPO_ROOT, "templates/mind-ontology/.agentctx");
const SWEEP_AGENTCTX = resolve(REPO_ROOT, "tests/fixtures/emit/safety-sweep/.agentctx");
const PROVENANCE_HEADING = /^### .+ <!-- \(from \.agentctx\/.+\) -->$/;

const tempRoots = [];

function git(cwd, args) {
  return spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
}

// A temp project whose `.agentctx/` is committed to a local git repo (so the
// recoverability gate is satisfied). autocrlf off so CRLF fixtures survive.
function gitProject(agentctx = TEMPLATE_AGENTCTX) {
  const cwd = mkdtempSync(join(tmpdir(), "mo-emit-apply-"));
  tempRoots.push(cwd);
  cpSync(agentctx, join(cwd, ".agentctx"), { recursive: true });
  expect(git(cwd, ["init", "-q"]).status, "git init").toBe(0);
  git(cwd, ["config", "core.autocrlf", "false"]);
  git(cwd, ["config", "user.email", "t@t"]);
  git(cwd, ["config", "user.name", "t"]);
  git(cwd, ["add", "-A"]);
  expect(git(cwd, ["commit", "-qm", "init"]).status, "git commit").toBe(0);
  return cwd;
}
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
}
function emit(cwd, extra = []) {
  expect(runCli(["emit", "--cwd", cwd, ...extra]).status, "emit fixture").toBe(0);
}

function snapshot(cwd) {
  const snap = {};
  const dir = join(cwd, ".agentctx");
  for (const f of readdirSync(dir)) snap[`.agentctx/${f}`] = readFileSync(join(dir, f), "utf8");
  for (const f of ["AGENTS.md", "CLAUDE.md"]) {
    const p = join(cwd, f);
    snap[f] = existsSync(p) ? readFileSync(p, "utf8") : null;
  }
  return snap;
}

// Insert a line into the body of the Nth (1-based) emitted block in an artifact.
function editNthBlockBody(file, n, text) {
  const lines = readFileSync(file, "utf8").split("\n");
  const out = [];
  let seen = 0;
  let done = false;
  for (const l of lines) {
    out.push(l);
    if (!done && PROVENANCE_HEADING.test(l)) {
      seen += 1;
      if (seen === n) {
        out.push(text);
        done = true;
      }
    }
  }
  expect(done, `block #${n} should exist`).toBe(true);
  writeFileSync(file, out.join("\n"));
}

function sourceBlockBody(cwd, sourceFile, index) {
  const blocks = parseMarkdownBlocks(readFileSync(join(cwd, ".agentctx", sourceFile), "utf8"), sourceFile);
  return blocks.find((b) => b.index === index)?.body;
}

describe("--apply writes the hand-edit back to the source block (surgically)", () => {
  it("patches exactly the target source block; other .agentctx and artifacts untouched", () => {
    const cwd = gitProject();
    emit(cwd, ["--target", "agents-md"]);
    editNthBlockBody(join(cwd, "AGENTS.md"), 1, "APPLIED BODY LINE");
    const before = snapshot(cwd);

    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source", "--apply"]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("APPLIED  .agentctx/constraints.md");

    // The targeted source block now carries the edit.
    expect(sourceBlockBody(cwd, "constraints.md", 0)).toContain("APPLIED BODY LINE");
    // Everything EXCEPT the patched source is byte-identical — including the
    // artifacts (NOT re-emitted) and every other .agentctx source.
    const after = snapshot(cwd);
    for (const k of Object.keys(before)) {
      if (k === ".agentctx/constraints.md") continue;
      expect(after[k], k).toBe(before[k]);
    }
  });

  it("round-trips: after --apply then emit, --check is OK", () => {
    const cwd = gitProject();
    emit(cwd, ["--target", "agents-md"]);
    editNthBlockBody(join(cwd, "AGENTS.md"), 1, "ROUNDTRIP LINE");

    expect(runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source", "--apply"]).status).toBe(0);
    emit(cwd, ["--target", "agents-md"]); // regenerate
    expect(runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--check"]).status).toBe(0);
  });

  it("reproduction invariant: after --apply then emit, the artifact equals the hand-edit", () => {
    const cwd = gitProject();
    emit(cwd, ["--target", "agents-md"]);
    editNthBlockBody(join(cwd, "AGENTS.md"), 1, "REPRODUCES");
    const handEdited = readFileSync(join(cwd, "AGENTS.md"), "utf8");

    expect(runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source", "--apply"]).status).toBe(0);
    emit(cwd, ["--target", "agents-md"]); // regenerate from the updated sources
    // The whole point: the updated sources regenerate the user's exact artifact
    // PAYLOAD. (The header's digests legitimately refresh, since the source
    // genuinely changed; the hand-edited file had a stale header by definition.)
    const payload = (s) => s.slice(s.indexOf("-->\n") + 4);
    expect(payload(readFileSync(join(cwd, "AGENTS.md"), "utf8"))).toBe(payload(handEdited));
  });

  it("json mode reports applied source files and never re-emits", () => {
    const cwd = gitProject();
    emit(cwd, ["--target", "agents-md"]);
    editNthBlockBody(join(cwd, "AGENTS.md"), 1, "JSON APPLY");

    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source", "--apply", "--format", "json"]);
    expect(r.status, r.stderr).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed).toMatchObject({ ok: true, mode: "reconcile-source-apply", apply: true, reemitted: false });
    expect(parsed.written.some((w) => w.source_file === "constraints.md")).toBe(true);
  });
});

describe("--apply edits across multiple blocks and files", () => {
  it("applies two edited blocks in the SAME source file", () => {
    const cwd = gitProject();
    emit(cwd, ["--target", "agents-md"]);
    // constraints.md emits multiple blocks first; edit blocks #1 and #2.
    editNthBlockBody(join(cwd, "AGENTS.md"), 2, "EDIT TWO");
    editNthBlockBody(join(cwd, "AGENTS.md"), 1, "EDIT ONE");

    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source", "--apply"]);
    expect(r.status, r.stderr).toBe(0);
    expect(sourceBlockBody(cwd, "constraints.md", 0)).toContain("EDIT ONE");
    expect(sourceBlockBody(cwd, "constraints.md", 1)).toContain("EDIT TWO");
  });

  it("body→empty and empty stays well-formed (re-parse round-trips)", () => {
    const cwd = gitProject();
    emit(cwd, ["--target", "agents-md"]);
    // Replace the whole first block body with empty by deleting its body lines.
    const lines = readFileSync(join(cwd, "AGENTS.md"), "utf8").split("\n");
    const out = [];
    let inFirst = false;
    let seen = 0;
    for (const l of lines) {
      if (PROVENANCE_HEADING.test(l)) {
        seen += 1;
        inFirst = seen === 1;
        out.push(l);
        continue;
      }
      if (inFirst) {
        // drop body lines of block 1 until the next structural line
        if (l.startsWith("## ") || l.startsWith("### ") || l.startsWith("> ") || l.startsWith("---")) {
          inFirst = false;
          out.push(l);
        }
        // else: skip (delete body line)
        continue;
      }
      out.push(l);
    }
    writeFileSync(join(cwd, "AGENTS.md"), out.join("\n"));
    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source", "--apply"]);
    // Either applies cleanly (body emptied) or refuses safely; never corrupts.
    expect([0, 1]).toContain(r.status);
    if (r.status === 0) {
      emit(cwd, ["--target", "agents-md"]);
      expect(runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--check"]).status).toBe(0);
    }
  });
});

describe("--apply preserves true provenance of forced blocks", () => {
  it("an edit to a safety-swept block writes its TRUE source file", () => {
    const cwd = gitProject(SWEEP_AGENTCTX);
    emit(cwd, ["--target", "agents-md"]);
    // Edit the forced block (first provenance heading whose file != constraints.md).
    const lines = readFileSync(join(cwd, "AGENTS.md"), "utf8").split("\n");
    const out = [];
    let done = false;
    let trueFile = null;
    for (const l of lines) {
      out.push(l);
      const m = l.match(/^### .+ <!-- \(from \.agentctx\/(.+)\) -->$/);
      if (m && !done && m[1] !== "constraints.md") {
        out.push("FORCED APPLY EDIT");
        trueFile = m[1];
        done = true;
      }
    }
    expect(done).toBe(true);
    writeFileSync(join(cwd, "AGENTS.md"), out.join("\n"));
    const before = snapshot(cwd);

    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source", "--apply"]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain(`.agentctx/${trueFile}`);
    expect(readFileSync(join(cwd, ".agentctx", trueFile), "utf8")).toContain("FORCED APPLY EDIT");
    // constraints.md (the output section) must be untouched.
    expect(readFileSync(join(cwd, ".agentctx", "constraints.md"), "utf8")).toBe(before[".agentctx/constraints.md"]);
  });
});

describe("--apply refuses unsafe cases and writes nothing", () => {
  it("a non-git project refuses (recoverability gate)", () => {
    // Plain temp project with NO git.
    const cwd = mkdtempSync(join(tmpdir(), "mo-emit-apply-nogit-"));
    tempRoots.push(cwd);
    cpSync(TEMPLATE_AGENTCTX, join(cwd, ".agentctx"), { recursive: true });
    emit(cwd, ["--target", "agents-md"]);
    editNthBlockBody(join(cwd, "AGENTS.md"), 1, "EDIT");
    const before = snapshot(cwd);

    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source", "--apply"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Refusing to apply");
    expect(snapshot(cwd)).toEqual(before);
  });

  it("a dirty (uncommitted) target source refuses", () => {
    const cwd = gitProject();
    emit(cwd, ["--target", "agents-md"]);
    editNthBlockBody(join(cwd, "AGENTS.md"), 1, "EDIT");
    // Make the source dirty WITHOUT changing rendered output: add a trailing
    // blank line (canonicalize/parse ignores it, so it still reproduces) — but
    // it IS an uncommitted git change.
    appendFileSync(join(cwd, ".agentctx", "constraints.md"), "\n");
    const before = snapshot(cwd);

    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source", "--apply"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Refusing to apply/);
    expect(snapshot(cwd)).toEqual(before);
  });

  it("a forged provenance heading planted inside a block body refuses", () => {
    const cwd = gitProject();
    emit(cwd, ["--target", "agents-md"]);
    // Plant a line that looks like another block's provenance heading INSIDE the
    // first block's body (a forgery that must not be attributed to source).
    const lines = readFileSync(join(cwd, "AGENTS.md"), "utf8").split("\n");
    const out = [];
    let done = false;
    for (const l of lines) {
      out.push(l);
      if (!done && PROVENANCE_HEADING.test(l)) {
        out.push("forged body text", "### Forged <!-- (from .agentctx/constraints.md) -->", "more body");
        done = true;
      }
    }
    writeFileSync(join(cwd, "AGENTS.md"), out.join("\n"));
    const before = snapshot(cwd);

    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source", "--apply"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Refusing to apply");
    expect(snapshot(cwd)).toEqual(before);
  });

  it("a symlinked source refuses (write-scope guard)", () => {
    const cwd = gitProject();
    emit(cwd, ["--target", "agents-md"]);
    editNthBlockBody(join(cwd, "AGENTS.md"), 1, "EDIT");
    // Replace the source with a symlink pointing outside .agentctx/. Skip if the
    // OS forbids symlink creation (e.g. Windows without privilege).
    const outside = join(cwd, "outside-target.md");
    const cpath = join(cwd, ".agentctx", "constraints.md");
    writeFileSync(outside, readFileSync(cpath, "utf8"));
    let symlinked = false;
    try {
      rmSync(cpath);
      symlinkSync(outside, cpath, "file");
      symlinked = true;
    } catch {
      // Restore and skip the assertion if symlinks are unavailable.
      if (!existsSync(cpath)) writeFileSync(cpath, readFileSync(outside, "utf8"));
    }
    if (!symlinked) return; // environment can't create symlinks; nothing to assert
    git(cwd, ["add", "-A"]);
    git(cwd, ["commit", "-qm", "symlink"]);
    const outsideBefore = readFileSync(outside, "utf8");

    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source", "--apply"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/symlink|special|Refusing to apply/);
    // The outside target was NOT written through the link.
    expect(readFileSync(outside, "utf8")).toBe(outsideBefore);
  });

  it("a provenance heading edit refuses (Lane-3b gate) and writes nothing", () => {
    const cwd = gitProject();
    emit(cwd, ["--target", "agents-md"]);
    const content = readFileSync(join(cwd, "AGENTS.md"), "utf8");
    writeFileSync(join(cwd, "AGENTS.md"), content.replace(/^### /m, "### EDITED "));
    const before = snapshot(cwd);

    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source", "--apply"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Refusing to apply source reconcile");
    expect(snapshot(cwd)).toEqual(before);
  });

  it("all-or-nothing: a valid edit + a structural edit on another target writes NOTHING", () => {
    const cwd = gitProject();
    emit(cwd); // both targets
    editNthBlockBody(join(cwd, "AGENTS.md"), 1, "VALID EDIT");
    const claude = readFileSync(join(cwd, "CLAUDE.md"), "utf8");
    writeFileSync(join(cwd, "CLAUDE.md"), claude.replace(/^## Constraints$/m, "## Constraints EDITED"));
    const before = snapshot(cwd);

    const r = runCli(["emit", "--cwd", cwd, "--reconcile-source", "--apply"]);
    expect(r.status).toBe(1);
    // No source file was touched.
    expect(snapshot(cwd)).toEqual(before);
  });

  it("re-applying after a successful apply refuses (source now drifted from the artifact)", () => {
    const cwd = gitProject();
    emit(cwd, ["--target", "agents-md"]);
    editNthBlockBody(join(cwd, "AGENTS.md"), 1, "ONCE");
    expect(runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source", "--apply"]).status).toBe(0);
    // Source changed; the artifact still carries the hand-edit but the header no
    // longer reproduces → source-drift gate refuses a second apply.
    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source", "--apply"]);
    expect(r.status).toBe(1);
  });
});

describe("--apply preserves CRLF line endings in the source", () => {
  it("rewrites a CRLF source keeping CRLF and inserting the new body", () => {
    const cwd = gitProject();
    // Convert constraints.md to CRLF and commit it so the gate passes.
    const cpath = join(cwd, ".agentctx", "constraints.md");
    const lf = readFileSync(cpath, "utf8").replace(/\r\n/g, "\n");
    writeFileSync(cpath, lf.replace(/\n/g, "\r\n"));
    git(cwd, ["add", "-A"]);
    git(cwd, ["commit", "-qm", "crlf"]);

    emit(cwd, ["--target", "agents-md"]);
    editNthBlockBody(join(cwd, "AGENTS.md"), 1, "CRLF APPLY");

    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source", "--apply"]);
    expect(r.status, r.stderr).toBe(0);
    const updated = readFileSync(cpath, "utf8");
    expect(updated).toContain("\r\n"); // still CRLF
    expect(updated).not.toMatch(/(?<!\r)\n/); // no bare LF introduced
    expect(updated).toContain("CRLF APPLY");
  });
});
