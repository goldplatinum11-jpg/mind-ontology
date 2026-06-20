import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  CURSOR_PRELUDE,
  EMIT_VERSION,
  REQUIRED_HEADER_KEYS,
  buildArtifact,
  canonicalize,
  parseEmitHeader,
  sha256,
} from "../../scripts/agentctx/emit.mjs";
import {
  COMMANDS,
  buildHelp,
  planInvocation,
  unknownCommandMessage,
} from "../../scripts/agentctx/cli.mjs";
import { SOURCE_FILES } from "../../scripts/agentctx/compile.mjs";

// W3 golden-file freeze (W2 §13 items 1-7, 13, 16). Every golden under
// tests/fixtures/emit/golden/ is a byte-frozen artifact: these tests re-emit
// from the frozen source ontologies and require byte equality. A diff here is
// a deliberate emit_version event, never an accident.

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = resolve(REPO_ROOT, "scripts/agentctx/cli.mjs");
const GOLDEN_DIR = resolve(REPO_ROOT, "tests/fixtures/emit/golden");
const TEMPLATE_AGENTCTX = resolve(REPO_ROOT, "templates/mind-ontology/.agentctx");
const MINIMAL_AGENTCTX = resolve(REPO_ROOT, "tests/fixtures/emit/minimal/.agentctx");
const SWEEP_AGENTCTX = resolve(REPO_ROOT, "tests/fixtures/emit/safety-sweep/.agentctx");

// Goldens are stored LF (tests/fixtures/emit/.gitattributes); canonicalize on
// read guards a stray autocrlf checkout, mirroring W1 §9's CRLF immunity.
function golden(name) {
  return canonicalize(readFileSync(resolve(GOLDEN_DIR, name), "utf8"));
}

function readSources(agentctxDir) {
  const sources = {};
  for (const file of SOURCE_FILES) {
    const path = resolve(agentctxDir, file);
    sources[file] = existsSync(path) ? readFileSync(path, "utf8") : "";
  }
  return sources;
}

const tempRoots = [];
function projectFrom(agentctxDir) {
  const cwd = mkdtempSync(join(tmpdir(), "mo-emit-gold-"));
  tempRoots.push(cwd);
  cpSync(agentctxDir, join(cwd, ".agentctx"), { recursive: true });
  return cwd;
}
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
}

describe("golden artifacts: template ontology, default profile (freeze 1-2)", () => {
  it("AGENTS.md and CLAUDE.md are byte-identical to the frozen goldens", () => {
    const cwd = projectFrom(TEMPLATE_AGENTCTX);
    const r = runCli(["emit", "--cwd", cwd]);
    expect(r.status, r.stderr).toBe(0);
    expect(readFileSync(join(cwd, "AGENTS.md"), "utf8")).toBe(golden("template-default/AGENTS.md"));
    expect(readFileSync(join(cwd, "CLAUDE.md"), "utf8")).toBe(golden("template-default/CLAUDE.md"));
  });

  it("write mode reports one WROTE line per target on stdout", () => {
    const cwd = projectFrom(TEMPLATE_AGENTCTX);
    const r = runCli(["emit", "--cwd", cwd]);
    expect(r.status).toBe(0);
    const lines = r.stdout.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^WROTE {2}AGENTS\.md {2}\(agents-md, profile default, \d+ payload lines\)$/);
    expect(lines[1]).toMatch(/^WROTE {2}CLAUDE\.md {2}\(claude-md, profile default, \d+ payload lines\)$/);
  });

  it("the golden header parses with the seven required keys and self-consistent digests", () => {
    const content = golden("template-default/AGENTS.md");
    const parsed = parseEmitHeader(content);
    expect(parsed).not.toBeNull();
    expect(parsed.header.target).toBe("agents-md");
    expect(parsed.header.profile).toBe("default");
    expect(parsed.header.emit_version).toBe(String(EMIT_VERSION));
    expect(parsed.header.source).toBe(".agentctx/");
    expect(parsed.header.source_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    // The content digest is computable from the payload alone (W1 §6).
    expect(sha256(parsed.payload)).toBe(parsed.header.content_digest);
    // ASCII-only note (W1 §6) so the header survives encoding round-trips.
    expect(parsed.header.note).toMatch(/^[\x20-\x7E]+$/);
  });

  it("the CLAUDE.md notice carries the ratified W2 §8(c) dual-load sentence in the first golden", () => {
    const content = golden("template-default/CLAUDE.md");
    expect(content).toContain("If your tooling also loads `AGENTS.md`");
    expect(content).toContain("CLAUDE.local.md");
    // And the AGENTS.md frame does not (frame-only delta).
    expect(golden("template-default/AGENTS.md")).not.toContain("CLAUDE.local.md");
  });
});

describe("golden artifact: cursor target (supported-but-not-default)", () => {
  it("emit --target cursor writes the frozen .mdc (nested dirs created) and nothing else", () => {
    const cwd = projectFrom(TEMPLATE_AGENTCTX);
    const r = runCli(["emit", "--cwd", cwd, "--target", "cursor"]);
    expect(r.status, r.stderr).toBe(0);
    const mdc = join(cwd, ".cursor", "rules", "mind-ontology.mdc");
    expect(readFileSync(mdc, "utf8")).toBe(golden("template-default/cursor.mdc"));
    // Only the cursor artifact is written — no default targets.
    expect(existsSync(join(cwd, "AGENTS.md"))).toBe(false);
    expect(existsSync(join(cwd, "CLAUDE.md"))).toBe(false);
    // One WROTE line naming the nested path and the cursor target.
    expect(r.stdout.trim()).toMatch(
      /^WROTE {2}\.cursor\/rules\/mind-ontology\.mdc {2}\(cursor, profile default, \d+ payload lines\)$/,
    );
  });

  it("the cursor golden is frontmatter prelude, then emit header, then a title-less body", () => {
    const mdc = golden("template-default/cursor.mdc");
    // The Cursor YAML frontmatter is the first bytes; the header follows it.
    expect(mdc.startsWith(`${CURSOR_PRELUDE}<!-- mind-ontology:emit\n`)).toBe(true);
    const parsed = parseEmitHeader(mdc, { allowPrelude: true });
    expect(parsed).not.toBeNull();
    expect(parsed.header.target).toBe("cursor");
    expect(parsed.header.profile).toBe("default");
    expect(parsed.header.emit_version).toBe(String(EMIT_VERSION));
    // Title-less (W1 §13.4): no `# <title>` first heading — the body opens with
    // the cursor notice, never a literal `null`.
    expect(parsed.payload.startsWith("#")).toBe(false);
    expect(parsed.payload).not.toContain("null");
    expect(parsed.payload.startsWith("> Generated by")).toBe(true);
    // content_digest still covers exactly the post-header body.
    expect(sha256(parsed.payload)).toBe(parsed.header.content_digest);
  });

  it("cursor's `##` section payload is byte-identical to AGENTS.md (shared payload, W1 §3)", () => {
    const sections = (s) => {
      const body = s.slice(s.indexOf("-->\n") + 4);
      return body.slice(body.indexOf("\n## "), body.lastIndexOf("\n---\n"));
    };
    expect(sections(golden("template-default/cursor.mdc"))).toBe(
      sections(golden("template-default/AGENTS.md")),
    );
  });

  it("bare emit never writes the cursor artifact (cursor is not default)", () => {
    const cwd = projectFrom(TEMPLATE_AGENTCTX);
    expect(runCli(["emit", "--cwd", cwd]).status).toBe(0);
    expect(existsSync(join(cwd, ".cursor"))).toBe(false);
  });

  it("emit --check --target cursor is OK immediately after emit (drift-checkable)", () => {
    const cwd = projectFrom(TEMPLATE_AGENTCTX);
    expect(runCli(["emit", "--cwd", cwd, "--target", "cursor"]).status).toBe(0);
    const chk = runCli(["emit", "--cwd", cwd, "--check", "--target", "cursor"]);
    expect(chk.status, chk.stdout).toBe(0);
    expect(chk.stdout).toContain("OK");
  });
});

describe("golden JSON shapes (freeze 6-7)", () => {
  it("emit --format json matches the frozen write-result shape", () => {
    const cwd = projectFrom(TEMPLATE_AGENTCTX);
    const r = runCli(["emit", "--cwd", cwd, "--format", "json"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toBe(golden("template-default/emit.json"));
    const parsed = JSON.parse(r.stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.written.map((w) => w.target)).toEqual(["agents-md", "claude-md"]);
    expect(parsed.warnings).toEqual([{ type: "dual-target-note" }]);
  });

  it("emit --check --format json matches the frozen check shape", () => {
    const cwd = projectFrom(TEMPLATE_AGENTCTX);
    expect(runCli(["emit", "--cwd", cwd]).status).toBe(0);
    const r = runCli(["emit", "--cwd", cwd, "--check", "--format", "json"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toBe(golden("template-default/check.json"));
    const parsed = JSON.parse(r.stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.targets).toEqual([
      { target: "agents-md", path: "AGENTS.md", status: "ok", detail: null },
      { target: "claude-md", path: "CLAUDE.md", status: "ok", detail: null },
    ]);
  });
});

describe("golden artifact: --full profile (freeze 3)", () => {
  it("--full emits every source file and records profile: full in the header", () => {
    const cwd = projectFrom(TEMPLATE_AGENTCTX);
    const r = runCli(["emit", "--cwd", cwd, "--full", "--target", "agents-md"]);
    expect(r.status, r.stderr).toBe(0);
    const artifact = readFileSync(join(cwd, "AGENTS.md"), "utf8");
    expect(artifact).toBe(golden("template-full/AGENTS.md"));
    expect(parseEmitHeader(canonicalize(artifact)).header.profile).toBe("full");
    // Files the default profile excludes appear under --full.
    expect(artifact).toContain("## Decisions");
    expect(artifact).toContain("## Glossary");
  });
});

describe("golden artifacts: minimal constraints-only ontology (freeze 4)", () => {
  it("emits frame + Constraints only, omitting empty sections entirely", () => {
    const cwd = projectFrom(MINIMAL_AGENTCTX);
    const r = runCli(["emit", "--cwd", cwd]);
    expect(r.status, r.stderr).toBe(0);
    const agents = readFileSync(join(cwd, "AGENTS.md"), "utf8");
    expect(agents).toBe(golden("minimal/AGENTS.md"));
    expect(readFileSync(join(cwd, "CLAUDE.md"), "utf8")).toBe(golden("minimal/CLAUDE.md"));
    expect(agents).toContain("## Constraints");
    // W1 §4 empty-section rule: no heading, no "(none)" placeholder.
    for (const absent of ["## Identity", "## Direction", "## Agent roles", "(none)"]) {
      expect(agents).not.toContain(absent);
    }
  });
});

describe("golden artifact: safety sweep (freeze 5)", () => {
  it("forces the #destructive block from excluded projects.md into Constraints with true-source provenance", () => {
    const cwd = projectFrom(SWEEP_AGENTCTX);
    const r = runCli(["emit", "--cwd", cwd, "--target", "agents-md"]);
    expect(r.status, r.stderr).toBe(0);
    const artifact = readFileSync(join(cwd, "AGENTS.md"), "utf8");
    expect(artifact).toBe(golden("safety-sweep/AGENTS.md"));
    // Forced block lands under Constraints, provenance names projects.md.
    expect(artifact).toContain(
      "### Decommission legacy store <!-- (from .agentctx/projects.md) -->",
    );
    // The non-safety block of the excluded file is NOT swept in, and the
    // excluded file gets no section of its own.
    expect(artifact).not.toContain("Active project");
    expect(artifact).not.toContain("## Projects");
  });

  it("cq.md is exempt from the safety sweep: a #safety CQ changes neither payload nor digest (W4 ruling, W1 §3)", () => {
    const sources = readSources(SWEEP_AGENTCTX);
    const base = buildArtifact({ sources, target: "agents-md" });
    const withSafetyCq = buildArtifact({
      sources: {
        ...sources,
        "cq.md":
          "# Competency Questions\n\n## What must the agent avoid? #cq #safety\n\nQuestions are not constraints.\n",
      },
      target: "agents-md",
    });
    expect(withSafetyCq.artifact).toBe(base.artifact);
  });

  it("editing a swept excluded file re-flags the artifact; editing an unswept one does not (W1 §6 digest asymmetry)", () => {
    const sources = readSources(SWEEP_AGENTCTX);
    const base = buildArtifact({ sources, target: "agents-md" });
    const sweptEdit = buildArtifact({
      sources: { ...sources, "projects.md": `${sources["projects.md"]}\nEdited.\n` },
      target: "agents-md",
    });
    expect(sweptEdit.sourceDigest).not.toBe(base.sourceDigest);
    const unsweptEdit = buildArtifact({
      sources: { ...sources, "glossary.md": "# Glossary\n\n## Term #term\n\nA term.\n" },
      target: "agents-md",
    });
    expect(unsweptEdit.sourceDigest).toBe(base.sourceDigest);
  });
});

// W1 principle 3, enforced as a test rather than trusted by eye (freeze 13):
// strip each golden to the shared section region (between the frame notice
// and the footer) and require byte equality.
describe("payload byte-equality across targets (freeze 13)", () => {
  function sharedSections(artifact) {
    const payload = artifact.slice(artifact.indexOf("-->\n") + 4);
    const start = payload.indexOf("\n## ");
    const end = payload.lastIndexOf("\n---\n");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return payload.slice(start, end);
  }

  it("AGENTS.md and CLAUDE.md carry byte-identical section payloads", () => {
    const agents = sharedSections(golden("template-default/AGENTS.md"));
    const claude = sharedSections(golden("template-default/CLAUDE.md"));
    expect(agents).toBe(claude);
    expect(agents.length).toBeGreaterThan(100); // not trivially empty
  });
});

describe("block-manifest provenance: backward-compat invariants (Phase 3)", () => {
  // The block-manifest work is opt-in only. These pins fail loudly if a later
  // change lets it touch the frozen surfaces: the emit version, the header key
  // set, the artifact bytes, or the base check JSON.

  it("EMIT_VERSION is unchanged (the manifest never forces a version bump)", () => {
    expect(EMIT_VERSION).toBe(2);
  });

  it("the header still carries exactly the seven required keys, in order", () => {
    expect(REQUIRED_HEADER_KEYS).toEqual([
      "target",
      "profile",
      "emit_version",
      "source",
      "source_digest",
      "content_digest",
      "note",
    ]);
    // And the emitted header advertises no manifest/digest keys of its own.
    const parsed = parseEmitHeader(golden("template-default/AGENTS.md"));
    expect(Object.keys(parsed.header)).toEqual(REQUIRED_HEADER_KEYS);
  });

  it("buildArtifact exposes blockManifest in memory but never in the artifact bytes", () => {
    const cwd = projectFrom(TEMPLATE_AGENTCTX);
    const r = runCli(["emit", "--cwd", cwd]);
    expect(r.status, r.stderr).toBe(0);
    // Bytes are still the frozen golden (re-asserting the freeze under this lens).
    expect(readFileSync(join(cwd, "AGENTS.md"), "utf8")).toBe(golden("template-default/AGENTS.md"));
    const build = buildArtifact({ sources: readSources(TEMPLATE_AGENTCTX), target: "agents-md" });
    expect(Array.isArray(build.blockManifest)).toBe(true);
    expect(build.blockManifest.length).toBeGreaterThan(0);
    for (const needle of ["block_manifest", "blockManifest", "source_block_digest"]) {
      expect(build.artifact).not.toContain(needle);
    }
  });

  it("the base emit --check --format json shape gains no manifest/explain keys", () => {
    const cwd = projectFrom(TEMPLATE_AGENTCTX);
    expect(runCli(["emit", "--cwd", cwd]).status).toBe(0);
    const check = JSON.parse(runCli(["emit", "--cwd", cwd, "--check", "--format", "json"]).stdout);
    expect(Object.keys(check)).toEqual(["ok", "targets"]);
    for (const t of check.targets) {
      expect(Object.keys(t)).toEqual(["target", "path", "status", "detail"]);
    }
  });
});

describe("backward compatibility: wrapper surface is additive only (freeze 16)", () => {
  it("the six pre-existing commands keep their exact script mappings", () => {
    const engine = Object.entries(COMMANDS)
      .filter(([, spec]) => spec.group === "engine")
      .map(([name, spec]) => [name, spec.script, spec.npmScript, ...spec.prefix]);
    expect(engine).toEqual([
      ["compile", "compile.mjs", "agentctx:compile", "compile"],
      ["init", "init.mjs", "agentctx:init"],
      ["validate", "schema.mjs", "agentctx:validate"],
      ["metrics", "metrics.mjs", "agentctx:metrics"],
      ["mcp", "mcp-server.mjs", "agentctx:mcp"],
      ["smoke", "acceptance-smoke.mjs", "agentctx:smoke"],
    ]);
  });

  it("emit dispatches to emit.mjs with argv forwarded verbatim and no npm alias (W2 §11)", () => {
    const plan = planInvocation(["emit", "--check", "--cwd", "/x"]);
    expect(plan.kind).toBe("spawn");
    expect(plan.script).toBe("emit.mjs");
    expect(plan.args).toEqual(["--check", "--cwd", "/x"]);
    expect(COMMANDS.emit.npmScript).toBeNull();
  });

  it("help groups engine and operator commands and lists every verb", () => {
    const help = buildHelp();
    expect(help).toContain("Engine commands:");
    expect(help).toContain("Operator commands:");
    for (const name of Object.keys(COMMANDS)) expect(help).toContain(name);
    expect(help).not.toContain("Workbench"); // internal name only (packet Q5)
  });

  it("the unknown-command message lists emit among the verbs", () => {
    expect(unknownCommandMessage("zzz")).toContain("emit");
  });

  it("wrapper compile output stays identical to the engine's own", () => {
    const cwd = projectFrom(TEMPLATE_AGENTCTX);
    const task = "Lock the emit golden files";
    const viaWrapper = runCli(["compile", "--cwd", cwd, "--task", task]);
    const direct = spawnSync(
      process.execPath,
      [resolve(REPO_ROOT, "scripts/agentctx/compile.mjs"), "compile", "--cwd", cwd, "--task", task],
      { encoding: "utf8" },
    );
    expect(viaWrapper.status).toBe(0);
    // The live pack carries a Generated: wall-clock line (the one intentional
    // nondeterminism emit does NOT share, W1 §7); mask it before comparing.
    const mask = (s) => s.replace(/^Generated: .*$/m, "Generated: <ts>");
    expect(mask(viaWrapper.stdout)).toBe(mask(direct.stdout));
  });
});
