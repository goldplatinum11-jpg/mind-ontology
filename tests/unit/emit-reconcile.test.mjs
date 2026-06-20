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
import { parseEmitArgv, parseEmitHeader } from "../../scripts/agentctx/emit.mjs";

// Lane 2 — `emit --reconcile`: SAFE drift repair. Writes generated artifacts
// (AGENTS.md / CLAUDE.md) only, never `.agentctx/`, and only for classes where
// nothing is lost (MISSING/STALE). UNMANAGED/HAND-EDITED are refused, and a
// refusal anywhere makes the whole multi-target run write nothing.

vi.setConfig({ testTimeout: 60_000 });

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = resolve(REPO_ROOT, "scripts/agentctx/cli.mjs");
const TEMPLATE_AGENTCTX = resolve(REPO_ROOT, "templates/mind-ontology/.agentctx");

const tempRoots = [];
function project() {
  const cwd = mkdtempSync(join(tmpdir(), "mo-emit-reconcile-"));
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

function emitted(extraArgs = []) {
  const cwd = project();
  expect(
    runCli(["emit", "--cwd", cwd, ...extraArgs]).status,
    "fixture: emit should succeed",
  ).toBe(0);
  return cwd;
}

function profileOf(cwd, file) {
  const parsed = parseEmitHeader(readFileSync(join(cwd, file), "utf8"));
  return parsed?.header.profile ?? null;
}

describe("argv contract (Lane 2)", () => {
  it("--reconcile parses; combining it with --check is a usage error", () => {
    expect(parseEmitArgv(["--reconcile"]).reconcile).toBe(true);
    expect(parseEmitArgv([]).reconcile).toBe(false);
    expect(() => parseEmitArgv(["--reconcile", "--check"])).toThrow(
      /--reconcile cannot be combined with --check/,
    );
  });

  it("--reconcile with --full is a usage error (it must honor the recorded profile)", () => {
    expect(() => parseEmitArgv(["--reconcile", "--full"])).toThrow(
      /--full cannot be combined with --reconcile/,
    );
  });
});

describe("--reconcile repairs safe drift classes", () => {
  it("STALE -> reconcile re-emits, then --check is OK", () => {
    const cwd = emitted();
    appendFileSync(join(cwd, ".agentctx", "constraints.md"), "\n## Extra rule\n\nAdded.\n");
    expect(runCli(["emit", "--cwd", cwd, "--check"]).status).toBe(1);

    const r = runCli(["emit", "--cwd", cwd, "--reconcile"]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("RECONCILED  AGENTS.md (agents-md, was STALE, profile default)");
    expect(r.stdout).toContain("RECONCILED - 2 of 2 targets re-emitted");

    // Now fresh.
    expect(runCli(["emit", "--cwd", cwd, "--check"]).status).toBe(0);
  });

  it("MISSING -> reconcile generates the artifact, then --check is OK", () => {
    const cwd = emitted();
    unlinkSync(join(cwd, "AGENTS.md"));
    expect(existsSync(join(cwd, "AGENTS.md"))).toBe(false);

    const r = runCli(["emit", "--cwd", cwd, "--reconcile", "--target", "agents-md"]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("RECONCILED  AGENTS.md (agents-md, was MISSING, profile default)");
    expect(existsSync(join(cwd, "AGENTS.md"))).toBe(true);
    expect(runCli(["emit", "--cwd", cwd, "--check", "--target", "agents-md"]).status).toBe(0);
  });

  it("OK -> reconcile skips and writes nothing (idempotent)", () => {
    const cwd = emitted();
    const before = readFileSync(join(cwd, "AGENTS.md"), "utf8");
    const r = runCli(["emit", "--cwd", cwd, "--reconcile"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("SKIP        AGENTS.md (agents-md, already OK)");
    expect(r.stdout).toContain("OK - 2 of 2 targets already fresh");
    expect(readFileSync(join(cwd, "AGENTS.md"), "utf8")).toBe(before);
  });

  it("a full-profile STALE target STAYS full after reconcile (never degrades to default)", () => {
    // Emit at the full profile, then drift it via a source edit.
    const cwd = emitted(["--target", "agents-md", "--full"]);
    expect(profileOf(cwd, "AGENTS.md")).toBe("full");
    appendFileSync(join(cwd, ".agentctx", "decisions.md"), "\n## A decision\n\nChosen.\n");
    // It is STALE now (full digests decisions.md, which default would not).
    expect(runCli(["emit", "--cwd", cwd, "--check", "--target", "agents-md"]).status).toBe(1);

    const r = runCli(["emit", "--cwd", cwd, "--reconcile", "--target", "agents-md"]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("RECONCILED  AGENTS.md (agents-md, was STALE, profile full)");
    // CRITICAL: the re-emitted header keeps profile: full.
    expect(profileOf(cwd, "AGENTS.md")).toBe("full");
    // And it is genuinely fresh under the full profile.
    expect(runCli(["emit", "--cwd", cwd, "--check", "--target", "agents-md"]).status).toBe(0);
  });
});

describe("--reconcile refuses unsafe classes and writes nothing", () => {
  it("HAND-EDITED -> refuse, exit 1, the file is untouched", () => {
    const cwd = emitted();
    appendFileSync(join(cwd, "AGENTS.md"), "\nA hand edit.\n");
    const before = readFileSync(join(cwd, "AGENTS.md"), "utf8");

    const r = runCli(["emit", "--cwd", cwd, "--reconcile", "--target", "agents-md"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toBe("");
    expect(r.stderr).toContain("Refusing to reconcile");
    expect(r.stderr).toContain("is HAND-EDITED");
    expect(r.stderr).toContain("Move the edit into the .agentctx/ source");
    // Untouched: the hand edit survives.
    expect(readFileSync(join(cwd, "AGENTS.md"), "utf8")).toBe(before);
  });

  it("UNMANAGED -> refuse, exit 1, points at --force, the file is untouched", () => {
    const cwd = emitted();
    const path = join(cwd, "AGENTS.md");
    const content = readFileSync(path, "utf8");
    writeFileSync(path, content.slice(content.indexOf("-->\n") + 4)); // strip header
    const before = readFileSync(path, "utf8");

    const r = runCli(["emit", "--cwd", cwd, "--reconcile", "--target", "agents-md"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toBe("");
    expect(r.stderr).toContain("is UNMANAGED");
    expect(r.stderr).toContain("mind-ontology emit --force --target agents-md");
    expect(readFileSync(path, "utf8")).toBe(before);
  });

  // Regression: reproducibility must be judged from the RECORDED header, not the
  // requested target. A header recording an UNSUPPORTED target (`paste-block`)
  // makes the artifact STALE-and-unreproducible; reconcile must REFUSE it even
  // though the requested target (`agents-md`) is itself perfectly valid.
  // (`cursor` is no longer a valid stand-in here — it is now a supported target.)
  it("STALE with a recorded UNSUPPORTED target -> refuse, exit 1, nothing written", () => {
    const cwd = emitted();
    const path = join(cwd, "AGENTS.md");
    // Rewrite only the header's target field; the payload (hence content_digest)
    // is untouched, so this is STALE (unreproducible recorded target), not
    // HAND-EDITED.
    const rewritten = readFileSync(path, "utf8").replace(
      /^target: agents-md$/m,
      "target: paste-block",
    );
    writeFileSync(path, rewritten);
    const before = readFileSync(path, "utf8");

    // Sanity: --check classifies it STALE (not hand-edited/unmanaged).
    const check = runCli(["emit", "--cwd", cwd, "--check", "--target", "agents-md"]);
    expect(check.status).toBe(1);
    expect(check.stdout).toContain("STALE");

    const r = runCli(["emit", "--cwd", cwd, "--reconcile", "--target", "agents-md"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toBe("");
    expect(r.stderr).toContain("Refusing to reconcile");
    expect(r.stderr).toContain("no longer reproducible");
    // CRITICAL: the artifact is NOT overwritten.
    expect(readFileSync(path, "utf8")).toBe(before);
  });

  it("STALE with a recorded UNKNOWN profile -> refuse, exit 1, nothing written", () => {
    const cwd = emitted();
    const path = join(cwd, "AGENTS.md");
    const rewritten = readFileSync(path, "utf8").replace(
      /^profile: default$/m,
      "profile: bogus",
    );
    writeFileSync(path, rewritten);
    const before = readFileSync(path, "utf8");

    const r = runCli(["emit", "--cwd", cwd, "--reconcile", "--target", "agents-md"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("no longer reproducible");
    expect(readFileSync(path, "utf8")).toBe(before);
  });

  it("--check --explain does NOT advertise --reconcile for an unreproducible STALE", () => {
    const cwd = emitted();
    const path = join(cwd, "AGENTS.md");
    writeFileSync(
      path,
      readFileSync(path, "utf8").replace(/^target: agents-md$/m, "target: paste-block"),
    );

    const r = runCli(["emit", "--cwd", cwd, "--check", "--target", "agents-md", "--explain"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("STALE");
    // It must say it CANNOT be auto-reconciled and must NOT advertise --reconcile.
    expect(r.stdout).toContain("CANNOT be auto-reconciled");
    expect(r.stdout).not.toContain("emit --reconcile --target agents-md");

    // And in json the explain.reconcileCommand is the manual re-emit, not --reconcile.
    const j = runCli(["emit", "--cwd", cwd, "--check", "--target", "agents-md", "--explain", "--format", "json"]);
    const agents = JSON.parse(j.stdout).targets.find((t) => t.target === "agents-md");
    expect(agents.explain.status).toBe("stale");
    expect(agents.explain.reconcileCommand).not.toContain("--reconcile");
    expect(agents.explain.reconcileCommand).toBe("mind-ontology emit --target agents-md");
  });
});

describe("--reconcile is all-or-nothing across targets", () => {
  it("a mixed run with ONE unsafe target writes NOTHING for any target", () => {
    const cwd = emitted();
    // agents-md is STALE (safe), claude-md is HAND-EDITED (unsafe).
    appendFileSync(join(cwd, ".agentctx", "constraints.md"), "\n## Extra\n\nAdded.\n");
    appendFileSync(join(cwd, "CLAUDE.md"), "\nA hand edit.\n");
    const agentsBefore = readFileSync(join(cwd, "AGENTS.md"), "utf8");
    const claudeBefore = readFileSync(join(cwd, "CLAUDE.md"), "utf8");

    const r = runCli(["emit", "--cwd", cwd, "--reconcile"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toBe("");
    expect(r.stderr).toContain("Refusing to reconcile");
    expect(r.stderr).toContain("is HAND-EDITED");
    // The SAFE target was NOT reconciled — nothing written for any target.
    expect(readFileSync(join(cwd, "AGENTS.md"), "utf8")).toBe(agentsBefore);
    expect(readFileSync(join(cwd, "CLAUDE.md"), "utf8")).toBe(claudeBefore);
  });

  it("a MISSING + UNMANAGED mix creates nothing for the missing target either", () => {
    const cwd = emitted();
    unlinkSync(join(cwd, "AGENTS.md")); // MISSING (safe alone)
    const claudePath = join(cwd, "CLAUDE.md");
    const claude = readFileSync(claudePath, "utf8");
    writeFileSync(claudePath, claude.slice(claude.indexOf("-->\n") + 4)); // UNMANAGED

    const r = runCli(["emit", "--cwd", cwd, "--reconcile"]);
    expect(r.status).toBe(1);
    // The missing target is NOT generated because the run refused as a whole.
    expect(existsSync(join(cwd, "AGENTS.md"))).toBe(false);
  });
});

describe("--reconcile never writes .agentctx/ and exit-code contract", () => {
  it("reconcile leaves every .agentctx/ source byte-identical", () => {
    const cwd = emitted();
    appendFileSync(join(cwd, ".agentctx", "constraints.md"), "\n## Extra\n\nAdded.\n");
    const sourceBefore = readFileSync(join(cwd, ".agentctx", "constraints.md"), "utf8");

    const r = runCli(["emit", "--cwd", cwd, "--reconcile"]);
    expect(r.status).toBe(0);
    // The artifact moved; the source did not.
    expect(readFileSync(join(cwd, ".agentctx", "constraints.md"), "utf8")).toBe(sourceBefore);
  });

  it("--reconcile + --check is a usage error: exit 2, nothing written", () => {
    const cwd = emitted();
    const agentsBefore = readFileSync(join(cwd, "AGENTS.md"), "utf8");
    const r = runCli(["emit", "--cwd", cwd, "--reconcile", "--check"]);
    expect(r.status).toBe(2);
    expect(r.stdout).toBe("");
    expect(r.stderr).toMatch(/--reconcile cannot be combined with --check/);
    expect(readFileSync(join(cwd, "AGENTS.md"), "utf8")).toBe(agentsBefore);
  });

  it("json mode reports per-target action and the kept profile", () => {
    const cwd = emitted();
    unlinkSync(join(cwd, "AGENTS.md")); // MISSING
    const r = runCli(["emit", "--cwd", cwd, "--reconcile", "--format", "json"]);
    expect(r.status, r.stderr).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.ok).toBe(true);
    const agents = parsed.targets.find((t) => t.target === "agents-md");
    const claude = parsed.targets.find((t) => t.target === "claude-md");
    expect(agents).toMatchObject({ action: "reconciled", status: "missing", profile: "default" });
    expect(claude).toMatchObject({ action: "skipped", status: "ok" });
  });
});

describe("existing emit/check output is byte-unchanged without --reconcile", () => {
  it("plain emit and emit --check are unaffected", () => {
    const cwd = project();
    const write = runCli(["emit", "--cwd", cwd]);
    expect(write.status).toBe(0);
    expect(write.stdout).toContain("WROTE  AGENTS.md  (agents-md, profile default,");
    expect(write.stdout).not.toContain("RECONCILED");

    const check = runCli(["emit", "--cwd", cwd, "--check"]);
    expect(check.status).toBe(0);
    expect(check.stdout).toContain("OK - 2 of 2 targets fresh");
    expect(check.stdout).not.toContain("RECONCILED");
  });
});

// Lane 4 / Phase 4 — `emit --reconcile --block-level`: opt-in block-level repair
// with the SAME safety contract as file-level reconcile, proven byte-identical.
describe("--reconcile --block-level (block-level repair, opt-in)", () => {
  // Make a STALE project by appending to a source (line-ending agnostic).
  function staleProject() {
    const cwd = emitted();
    appendFileSync(join(cwd, ".agentctx", "constraints.md"), "Block-level drift line.\n");
    return cwd;
  }

  it("output is byte-identical to the file-level reconcile for the same drift", () => {
    const fileCwd = staleProject();
    const blockCwd = staleProject();
    expect(runCli(["emit", "--cwd", fileCwd, "--reconcile"]).status).toBe(0);
    expect(runCli(["emit", "--cwd", blockCwd, "--reconcile", "--block-level"]).status).toBe(0);
    for (const f of ["AGENTS.md", "CLAUDE.md"]) {
      expect(readFileSync(join(blockCwd, f), "utf8")).toBe(readFileSync(join(fileCwd, f), "utf8"));
    }
  });

  it("repairs a STALE target (it passes --check afterward) and reports changed blocks", () => {
    const cwd = staleProject();
    expect(runCli(["emit", "--cwd", cwd, "--check"]).status).toBe(1); // stale
    const r = runCli(["emit", "--cwd", cwd, "--reconcile", "--block-level", "--format", "json"]);
    expect(r.status).toBe(0);
    const j = JSON.parse(r.stdout);
    expect(j.mode).toBe("block-level");
    const agents = j.targets.find((t) => t.target === "agents-md");
    expect(agents.action).toBe("block-reconciled");
    expect(agents.changed_blocks).toBeGreaterThan(0);
    expect(runCli(["emit", "--cwd", cwd, "--check"]).status).toBe(0); // fresh now
  });

  it("creates a MISSING target, byte-identical to the file-level reconcile", () => {
    const fileCwd = emitted();
    const blockCwd = emitted();
    unlinkSync(join(fileCwd, "AGENTS.md"));
    unlinkSync(join(blockCwd, "AGENTS.md"));
    expect(runCli(["emit", "--cwd", fileCwd, "--reconcile", "--target", "agents-md"]).status).toBe(0);
    expect(runCli(["emit", "--cwd", blockCwd, "--reconcile", "--block-level", "--target", "agents-md"]).status).toBe(0);
    expect(readFileSync(join(blockCwd, "AGENTS.md"), "utf8")).toBe(readFileSync(join(fileCwd, "AGENTS.md"), "utf8"));
  });

  it("SKIPs an already-fresh (OK) target, writing nothing", () => {
    const cwd = emitted();
    const before = readFileSync(join(cwd, "AGENTS.md"), "utf8");
    const r = runCli(["emit", "--cwd", cwd, "--reconcile", "--block-level"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("SKIP");
    expect(readFileSync(join(cwd, "AGENTS.md"), "utf8")).toBe(before);
  });

  it("refuses HAND-EDITED and writes nothing (same boundary as file-level)", () => {
    const cwd = emitted();
    appendFileSync(join(cwd, "AGENTS.md"), "\nA hand edit.\n");
    const before = readFileSync(join(cwd, "AGENTS.md"), "utf8");
    const r = runCli(["emit", "--cwd", cwd, "--reconcile", "--block-level", "--target", "agents-md"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Refusing to reconcile/);
    expect(readFileSync(join(cwd, "AGENTS.md"), "utf8")).toBe(before);
  });

  it("never writes .agentctx/ sources", () => {
    const cwd = staleProject();
    const srcPath = join(cwd, ".agentctx", "constraints.md");
    const srcBefore = readFileSync(srcPath, "utf8");
    expect(runCli(["emit", "--cwd", cwd, "--reconcile", "--block-level"]).status).toBe(0);
    expect(readFileSync(srcPath, "utf8")).toBe(srcBefore);
  });

  it("is all-or-nothing: a refused target blocks a safe one", () => {
    const cwd = emitted();
    appendFileSync(join(cwd, ".agentctx", "constraints.md"), "Drift.\n"); // both STALE
    appendFileSync(join(cwd, "AGENTS.md"), "\nA hand edit.\n"); // agents-md now HAND-EDITED
    const claudeBefore = readFileSync(join(cwd, "CLAUDE.md"), "utf8");
    const r = runCli(["emit", "--cwd", cwd, "--reconcile", "--block-level"]);
    expect(r.status).toBe(1);
    expect(readFileSync(join(cwd, "CLAUDE.md"), "utf8")).toBe(claudeBefore); // safe target untouched
  });

  it("--block-level without --reconcile is a usage error (exit 2, nothing written)", () => {
    const cwd = project();
    const r = runCli(["emit", "--cwd", cwd, "--block-level"]);
    expect(r.status).toBe(2);
    expect(r.stdout).toBe("");
    expect(r.stderr).toMatch(/--block-level is only valid together with --reconcile/);
    expect(existsSync(join(cwd, "AGENTS.md"))).toBe(false);
    expect(parseEmitArgv(["--reconcile", "--block-level"]).blockLevel).toBe(true);
  });

  it("leaves plain --reconcile completely unchanged (no block-level wording)", () => {
    const cwd = staleProject();
    const r = runCli(["emit", "--cwd", cwd, "--reconcile"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("RECONCILED");
    expect(r.stdout).not.toContain("BLOCK-RECONCILED");
  });
});

// Lane 4 / Phase 5 — result-shape lock and compatibility guards. The opt-in
// block-level result shape is frozen; the file-level result shape stays exactly
// as Lane 2 shipped it.
describe("--reconcile result shapes: file-level frozen, block-level locked (Phase 5)", () => {
  function staleProject() {
    const cwd = emitted();
    appendFileSync(join(cwd, ".agentctx", "constraints.md"), "Shape lock drift.\n");
    return cwd;
  }

  it("file-level --reconcile --format json keeps its exact Lane-2 shape (no mode/changed_blocks)", () => {
    const cwd = staleProject();
    const j = JSON.parse(runCli(["emit", "--cwd", cwd, "--reconcile", "--format", "json"]).stdout);
    expect(Object.keys(j)).toEqual(["ok", "targets"]); // no top-level `mode`
    for (const t of j.targets) {
      expect(Object.keys(t)).toEqual(["target", "path", "action", "status", "profile"]);
      expect(["reconciled", "skipped"]).toContain(t.action); // never "block-reconciled"
      expect(t).not.toHaveProperty("changed_blocks");
    }
  });

  it("block-level --reconcile --format json has the locked opt-in shape", () => {
    const cwd = staleProject();
    const j = JSON.parse(runCli(["emit", "--cwd", cwd, "--reconcile", "--block-level", "--format", "json"]).stdout);
    expect(Object.keys(j)).toEqual(["ok", "mode", "targets"]);
    expect(j.mode).toBe("block-level");
    for (const t of j.targets) {
      expect(Object.keys(t)).toEqual(["target", "path", "action", "status", "profile", "changed_blocks"]);
      expect(["block-reconciled", "skipped"]).toContain(t.action);
      expect(Number.isInteger(t.changed_blocks)).toBe(true);
    }
  });

  it("a block-level reconciled artifact is a clean managed file: exactly the seven header keys", () => {
    const cwd = staleProject();
    expect(runCli(["emit", "--cwd", cwd, "--reconcile", "--block-level"]).status).toBe(0);
    const parsed = parseEmitHeader(readFileSync(join(cwd, "AGENTS.md"), "utf8"));
    expect(parsed).not.toBeNull();
    expect(Object.keys(parsed.header)).toEqual([
      "target", "profile", "emit_version", "source", "source_digest", "content_digest", "note",
    ]);
    // No block-reconcile data leaked into the written artifact bytes.
    for (const needle of ["block_reconcile", "changed_blocks", "block-level"]) {
      expect(readFileSync(join(cwd, "AGENTS.md"), "utf8")).not.toContain(needle);
    }
  });
});
