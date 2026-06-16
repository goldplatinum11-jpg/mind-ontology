import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseEmitArgv, unifiedBlockDiff } from "../../scripts/agentctx/emit.mjs";

// Lane 3b — `emit --reconcile-source`: block-level reconcile PREVIEW. For a
// HAND-EDITED artifact, attribute each edited block back to the .agentctx/
// source block it came from (via block-manifest provenance) and PREVIEW the
// patch a future writeback WOULD apply. Reads only — writes NOTHING (not
// .agentctx/, not the artifact). All-or-nothing; ambiguity refuses. Real apply
// (--apply) is intentionally not implemented in this unit.

vi.setConfig({ testTimeout: 60_000 });

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = resolve(REPO_ROOT, "scripts/agentctx/cli.mjs");
const TEMPLATE_AGENTCTX = resolve(REPO_ROOT, "templates/mind-ontology/.agentctx");
const SWEEP_AGENTCTX = resolve(REPO_ROOT, "tests/fixtures/emit/safety-sweep/.agentctx");

const PROVENANCE_HEADING = /^### .+ <!-- \(from \.agentctx\/.+\) -->$/;

const tempRoots = [];
function project(agentctx = TEMPLATE_AGENTCTX) {
  const cwd = mkdtempSync(join(tmpdir(), "mo-emit-recsrc-"));
  tempRoots.push(cwd);
  cpSync(agentctx, join(cwd, ".agentctx"), { recursive: true });
  return cwd;
}
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
}

// Emit, asserting the fixture write succeeded, and return the project dir.
function emitted(agentctx = TEMPLATE_AGENTCTX, extraArgs = []) {
  const cwd = project(agentctx);
  expect(runCli(["emit", "--cwd", cwd, ...extraArgs]).status, "fixture: emit should succeed").toBe(0);
  return cwd;
}

// Byte-snapshot every .agentctx/ source and both artifacts, so any test can
// prove the command wrote NOTHING.
function snapshot(cwd) {
  const snap = {};
  const agentctxDir = join(cwd, ".agentctx");
  for (const f of readdirSync(agentctxDir)) {
    snap[`.agentctx/${f}`] = readFileSync(join(agentctxDir, f), "utf8");
  }
  for (const f of ["AGENTS.md", "CLAUDE.md"]) {
    const p = join(cwd, f);
    snap[f] = existsSync(p) ? readFileSync(p, "utf8") : null;
  }
  return snap;
}
function expectUnchanged(cwd, before) {
  expect(snapshot(cwd)).toEqual(before);
}

// Insert a body line right after the FIRST provenance heading (edits one block
// body without touching its heading line).
function editFirstBlockBody(file, text = "HAND EDITED BODY LINE") {
  const lines = readFileSync(file, "utf8").split("\n");
  const out = [];
  let done = false;
  for (const l of lines) {
    out.push(l);
    if (!done && PROVENANCE_HEADING.test(l)) {
      out.push(text);
      done = true;
    }
  }
  expect(done, "fixture: a provenance block heading should exist").toBe(true);
  writeFileSync(file, out.join("\n"));
}

describe("argv contract (Lane 3b)", () => {
  it("--reconcile-source parses; --apply parses only alongside it", () => {
    expect(parseEmitArgv(["--reconcile-source"]).reconcileSource).toBe(true);
    expect(parseEmitArgv([]).reconcileSource).toBe(false);
    expect(parseEmitArgv(["--reconcile-source", "--apply"]).apply).toBe(true);
  });

  it("combining --reconcile-source with another mode/annotation is a usage error", () => {
    // Every combination is rejected (some trip an earlier mode rule first, e.g.
    // --explain requires --check — still a usage error either way).
    for (const bad of ["--check", "--reconcile", "--explain", "--force", "--full"]) {
      expect(() => parseEmitArgv(["--reconcile-source", bad]), bad).toThrow();
    }
    // The flags --reconcile-source's own rule owns carry its message.
    for (const bad of ["--reconcile", "--force", "--full"]) {
      expect(() => parseEmitArgv(["--reconcile-source", bad])).toThrow(
        /--reconcile-source cannot be combined with/,
      );
    }
  });

  it("--apply without --reconcile-source is a usage error", () => {
    expect(() => parseEmitArgv(["--apply"])).toThrow(/--apply is only valid with --reconcile-source/);
  });
});

describe("--reconcile-source previews a clean single-block body edit", () => {
  it("attributes the edit to its source block and shows the would-be diff (exit 0)", () => {
    const cwd = emitted(TEMPLATE_AGENTCTX, ["--target", "agents-md"]);
    editFirstBlockBody(join(cwd, "AGENTS.md"));
    const before = snapshot(cwd);

    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source"]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("RECONCILE-SOURCE (preview)  AGENTS.md (agents-md)");
    expect(r.stdout).toContain("→ .agentctx/constraints.md ::");
    expect(r.stdout).toContain("+HAND EDITED BODY LINE");
    expect(r.stdout).toContain("PREVIEW - 1 block(s)");
    // Wrote NOTHING.
    expectUnchanged(cwd, before);
  });

  it("a multi-paragraph body edit (blank line inside the body) still attributes", () => {
    const cwd = emitted(TEMPLATE_AGENTCTX, ["--target", "agents-md"]);
    const lines = readFileSync(join(cwd, "AGENTS.md"), "utf8").split("\n");
    const out = [];
    let done = false;
    for (const l of lines) {
      out.push(l);
      if (!done && PROVENANCE_HEADING.test(l)) {
        out.push("New first paragraph.", "", "New second paragraph after a blank line.");
        done = true;
      }
    }
    writeFileSync(join(cwd, "AGENTS.md"), out.join("\n"));
    const before = snapshot(cwd);

    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source"]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("PREVIEW - 1 block(s)");
    expectUnchanged(cwd, before);
  });

  it("json mode reports per-target attribution evidence and writes nothing", () => {
    const cwd = emitted(TEMPLATE_AGENTCTX, ["--target", "agents-md"]);
    editFirstBlockBody(join(cwd, "AGENTS.md"));
    const before = snapshot(cwd);

    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source", "--format", "json"]);
    expect(r.status, r.stderr).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed).toMatchObject({ ok: true, mode: "reconcile-source-preview", apply: false });
    const agents = parsed.targets.find((t) => t.target === "agents-md");
    expect(agents.action).toBe("preview");
    expect(agents.status).toBe("hand-edited");
    const edit = agents.edits[0];
    expect(edit.source_file).toBe("constraints.md");
    expect(Number.isInteger(edit.source_block_index)).toBe(true);
    expect(edit.source_block_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(edit.expected_rendered_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(edit.actual_rendered_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    // The edit really changed the rendered block, so the digests differ.
    expect(edit.actual_rendered_digest).not.toBe(edit.expected_rendered_digest);
    expect(edit.forced).toBe(false);
    expect(typeof edit.diff).toBe("string");
    expectUnchanged(cwd, before);
  });
});

describe("--reconcile-source refuses edits it cannot isolate to one block body", () => {
  it("a provenance heading edit refuses (exit 1), nothing written", () => {
    const cwd = emitted(TEMPLATE_AGENTCTX, ["--target", "agents-md"]);
    const content = readFileSync(join(cwd, "AGENTS.md"), "utf8");
    // Edit the first block's provenance heading line (its identity).
    writeFileSync(join(cwd, "AGENTS.md"), content.replace(/^### /m, "### EDITED "));
    const before = snapshot(cwd);

    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toBe("");
    expect(r.stderr).toContain("Refusing to preview source reconcile");
    expectUnchanged(cwd, before);
  });

  it("a generated section heading edit refuses (exit 1)", () => {
    const cwd = emitted(TEMPLATE_AGENTCTX, ["--target", "agents-md"]);
    const content = readFileSync(join(cwd, "AGENTS.md"), "utf8");
    // Edit the "## Constraints" generated section heading (outside any block).
    writeFileSync(join(cwd, "AGENTS.md"), content.replace(/^## Constraints$/m, "## Constraints EDITED"));
    const before = snapshot(cwd);

    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Refusing to preview source reconcile");
    expectUnchanged(cwd, before);
  });

  it("a footer edit (outside any block body) refuses (exit 1)", () => {
    const cwd = emitted(TEMPLATE_AGENTCTX, ["--target", "agents-md"]);
    appendFileSync(join(cwd, "AGENTS.md"), "EXTRA FOOTER JUNK\n");
    const before = snapshot(cwd);

    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Refusing to preview source reconcile");
    expectUnchanged(cwd, before);
  });

  it("a body containing a FORGED provenance heading refuses (no mis-attribution)", () => {
    // Adversarial: inject a line that looks like another block's provenance
    // heading into a body. The boundary search could be fooled into moving a
    // boundary into the body; the heading-count guard must refuse instead.
    const cwd = emitted(TEMPLATE_AGENTCTX, ["--target", "agents-md"]);
    const lines = readFileSync(join(cwd, "AGENTS.md"), "utf8").split("\n");
    const out = [];
    let done = false;
    for (const l of lines) {
      out.push(l);
      if (!done && PROVENANCE_HEADING.test(l)) {
        // A forged heading line inside the first block's body.
        out.push("### Forged Block <!-- (from .agentctx/constraints.md) -->");
        done = true;
      }
    }
    writeFileSync(join(cwd, "AGENTS.md"), out.join("\n"));
    const before = snapshot(cwd);

    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Refusing to preview source reconcile");
    expectUnchanged(cwd, before);
  });

  it("a header-only edit (corrupted content_digest, payload intact) refuses (exit 1)", () => {
    const cwd = emitted(TEMPLATE_AGENTCTX, ["--target", "agents-md"]);
    const content = readFileSync(join(cwd, "AGENTS.md"), "utf8");
    // Corrupt the recorded content_digest: the payload no longer matches it
    // (HAND-EDITED), but the payload bytes are intact, so no block body changed.
    writeFileSync(
      join(cwd, "AGENTS.md"),
      content.replace(/^content_digest: sha256:[0-9a-f]+$/m, "content_digest: sha256:" + "0".repeat(64)),
    );
    const before = snapshot(cwd);

    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Refusing to preview source reconcile");
    expectUnchanged(cwd, before);
  });
});

describe("--reconcile-source refuses non-HAND-EDITED and unreproducible targets", () => {
  it("an OK (fresh) target refuses (exit 1)", () => {
    const cwd = emitted(TEMPLATE_AGENTCTX, ["--target", "agents-md"]);
    const before = snapshot(cwd);
    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("is OK (fresh)");
    expectUnchanged(cwd, before);
  });

  it("a MISSING target refuses (exit 1)", () => {
    const cwd = emitted(TEMPLATE_AGENTCTX, ["--target", "agents-md"]);
    unlinkSync(join(cwd, "AGENTS.md"));
    const before = snapshot(cwd);
    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("is MISSING");
    expectUnchanged(cwd, before);
  });

  it("an UNMANAGED (headerless) target refuses (exit 1)", () => {
    const cwd = emitted(TEMPLATE_AGENTCTX, ["--target", "agents-md"]);
    const p = join(cwd, "AGENTS.md");
    const content = readFileSync(p, "utf8");
    writeFileSync(p, content.slice(content.indexOf("-->\n") + 4)); // strip header
    const before = snapshot(cwd);
    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("is UNMANAGED");
    expectUnchanged(cwd, before);
  });

  it("a STALE target refuses and points at artifact-level --reconcile (exit 1)", () => {
    const cwd = emitted(TEMPLATE_AGENTCTX, ["--target", "agents-md"]);
    appendFileSync(join(cwd, ".agentctx", "constraints.md"), "\n## Extra rule\n\nAdded.\n");
    const before = snapshot(cwd);
    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("is STALE");
    expect(r.stderr).toContain("emit --reconcile --target agents-md");
    expectUnchanged(cwd, before);
  });

  it("a HAND-EDITED artifact whose sources ALSO drifted refuses (no mis-attribution of source drift)", () => {
    // Regression: if a source block body changed since emit, diffing the
    // hand-edited artifact against the rebuilt-from-current-sources expected
    // would flag the untouched-but-drifted block as an "edit" and propose
    // overwriting the NEWER source with the stale artifact body. The source_digest
    // gate must refuse instead.
    const cwd = emitted(TEMPLATE_AGENTCTX, ["--target", "agents-md"]);
    // Modify an existing source block body (no add/remove, headings intact).
    const cpath = join(cwd, ".agentctx", "constraints.md");
    const csrc = readFileSync(cpath, "utf8");
    const marker = "readable by any AI agent";
    expect(csrc.includes(marker), "fixture: expected constraint text present").toBe(true);
    writeFileSync(cpath, csrc.replace(marker, "READABLE-DRIFTED by any AI agent"));
    // And the user hand-edits a DIFFERENT block in the artifact.
    editFirstBlockBody(join(cwd, "AGENTS.md"), "USER HAND EDIT");
    const before = snapshot(cwd);

    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("since this artifact was generated");
    expectUnchanged(cwd, before);
  });

  it("a HAND-EDITED artifact whose recorded profile is unreproducible refuses (exit 1)", () => {
    const cwd = emitted(TEMPLATE_AGENTCTX, ["--target", "agents-md"]);
    const p = join(cwd, "AGENTS.md");
    // Make it HAND-EDITED (edit a body) AND record an unknown profile, so it
    // cannot be rebuilt to attribute the edit.
    editFirstBlockBody(p);
    writeFileSync(p, readFileSync(p, "utf8").replace(/^profile: default$/m, "profile: bogus"));
    const before = snapshot(cwd);

    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("no longer reproducible");
    expectUnchanged(cwd, before);
  });
});

describe("--reconcile-source preserves true provenance of safety-forced blocks", () => {
  it("an edit to a safety-swept block maps to its TRUE source, not Constraints", () => {
    const cwd = emitted(SWEEP_AGENTCTX, ["--target", "agents-md"]);
    // Edit the forced block: the first provenance heading whose file is NOT
    // constraints.md (a safety block swept into Constraints from another file).
    const lines = readFileSync(join(cwd, "AGENTS.md"), "utf8").split("\n");
    const out = [];
    let done = false;
    for (const l of lines) {
      out.push(l);
      const m = l.match(/^### .+ <!-- \(from \.agentctx\/(.+)\) -->$/);
      if (m && !done && m[1] !== "constraints.md") {
        out.push("EDIT TO A FORCED BLOCK");
        done = true;
      }
    }
    expect(done, "fixture: a forced (non-constraints) block should be emitted").toBe(true);
    writeFileSync(join(cwd, "AGENTS.md"), out.join("\n"));
    const before = snapshot(cwd);

    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source", "--format", "json"]);
    expect(r.status, r.stderr).toBe(0);
    const agents = JSON.parse(r.stdout).targets.find((t) => t.target === "agents-md");
    expect(agents.action).toBe("preview");
    const edit = agents.edits[0];
    expect(edit.forced).toBe(true);
    expect(edit.source_file).not.toBe("constraints.md");
    expectUnchanged(cwd, before);
  });
});

describe("--reconcile-source is all-or-nothing across targets", () => {
  it("a valid edit on one target + a structural edit on another refuses BOTH (exit 1)", () => {
    const cwd = emitted(); // both AGENTS.md and CLAUDE.md
    editFirstBlockBody(join(cwd, "AGENTS.md")); // safe: a body edit
    // CLAUDE.md: edit a generated section heading (unattributable structure).
    const claude = readFileSync(join(cwd, "CLAUDE.md"), "utf8");
    writeFileSync(join(cwd, "CLAUDE.md"), claude.replace(/^## Constraints$/m, "## Constraints EDITED"));
    const before = snapshot(cwd);

    const r = runCli(["emit", "--cwd", cwd, "--reconcile-source"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toBe("");
    expect(r.stderr).toContain("Refusing to preview source reconcile");
    // Nothing presented as apply-ready; nothing written for any target.
    expectUnchanged(cwd, before);
  });

  it("json mode never exposes preview diffs when the run refuses (all-or-nothing)", () => {
    const cwd = emitted(); // both targets
    editFirstBlockBody(join(cwd, "AGENTS.md")); // valid body edit
    const claude = readFileSync(join(cwd, "CLAUDE.md"), "utf8");
    writeFileSync(join(cwd, "CLAUDE.md"), claude.replace(/^## Constraints$/m, "## Constraints EDITED"));
    const before = snapshot(cwd);

    const r = runCli(["emit", "--cwd", cwd, "--reconcile-source", "--format", "json"]);
    expect(r.status).toBe(1);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.ok).toBe(false);
    // The otherwise-previewable target must NOT carry apply-ready edits.
    for (const t of parsed.targets) {
      expect(t.action).not.toBe("preview");
      expect(t.edits).toBeUndefined();
    }
    expectUnchanged(cwd, before);
  });
});

describe("--reconcile-source --apply is intentionally not implemented", () => {
  it("exits 2 and writes nothing", () => {
    const cwd = emitted(TEMPLATE_AGENTCTX, ["--target", "agents-md"]);
    editFirstBlockBody(join(cwd, "AGENTS.md"));
    const before = snapshot(cwd);

    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source", "--apply"]);
    expect(r.status).toBe(2);
    expect(r.stdout).toBe("");
    expect(r.stderr).toContain("--apply is not implemented");
    expectUnchanged(cwd, before);
  });

  it("--reconcile-source --check is a usage error: exit 2, nothing written", () => {
    const cwd = emitted(TEMPLATE_AGENTCTX, ["--target", "agents-md"]);
    const before = snapshot(cwd);
    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md", "--reconcile-source", "--check"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/--reconcile-source cannot be combined with/);
    expectUnchanged(cwd, before);
  });
});

describe("existing emit behavior is unaffected", () => {
  it("plain emit, --check, --reconcile, and --help are unchanged; help documents the new mode", () => {
    const cwd = project();
    expect(runCli(["emit", "--cwd", cwd]).status).toBe(0);
    expect(runCli(["emit", "--cwd", cwd, "--check"]).status).toBe(0);
    const recon = runCli(["emit", "--cwd", cwd, "--reconcile"]);
    expect(recon.status).toBe(0);
    expect(recon.stdout).not.toContain("RECONCILE-SOURCE");

    const help = runCli(["emit", "--help"]);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain("--reconcile-source");
  });
});

describe("unifiedBlockDiff helper", () => {
  it("emits a deterministic +/- line diff with unchanged context", () => {
    const d = unifiedBlockDiff("a\nb\nc", "a\nB\nc", { fromLabel: "x", toLabel: "x" });
    expect(d.split("\n")).toEqual(["--- x", "+++ x", " a", "-b", "+B", " c"]);
  });
  it("handles an empty old side (pure addition)", () => {
    const d = unifiedBlockDiff("", "new", { fromLabel: "x", toLabel: "y" });
    expect(d).toBe("--- x\n+++ y\n+new");
  });
});
