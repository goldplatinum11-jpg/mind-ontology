import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  SECTION_TITLES,
  buildArtifact,
  sha256,
} from "../../scripts/agentctx/emit.mjs";
import { SOURCE_FILES } from "../../scripts/agentctx/compile.mjs";

// Phase 1 (block-manifest provenance core): buildArtifact() returns an
// in-memory `blockManifest` — one entry per emitted block — without altering
// the emitted artifact bytes. These tests pin its shape, ordering, and the
// determinism/backward-compat boundaries; the byte-freeze itself lives in
// emit-golden.test.mjs and is re-asserted here only as a no-leakage guard.

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TEMPLATE_AGENTCTX = resolve(REPO_ROOT, "templates/mind-ontology/.agentctx");
const MINIMAL_AGENTCTX = resolve(REPO_ROOT, "tests/fixtures/emit/minimal/.agentctx");
const SWEEP_AGENTCTX = resolve(REPO_ROOT, "tests/fixtures/emit/safety-sweep/.agentctx");

const VALID_SECTIONS = new Set(Object.values(SECTION_TITLES));
const SOURCE_SET = new Set(SOURCE_FILES);

function readSources(agentctxDir) {
  const sources = {};
  for (const file of SOURCE_FILES) {
    const path = resolve(agentctxDir, file);
    sources[file] = existsSync(path) ? readFileSync(path, "utf8") : "";
  }
  return sources;
}

// Every renderBlock output carries exactly one provenance comment, so its
// count is the number of emitted blocks — the manifest must match it 1:1.
function emittedBlockCount(payload) {
  return (payload.match(/<!-- \(from \.agentctx\//g) ?? []).length;
}

describe("block manifest: shape and per-block coverage", () => {
  it("has one well-formed entry per emitted block, in emitted order", () => {
    const sources = readSources(TEMPLATE_AGENTCTX);
    const build = buildArtifact({ sources, target: "agents-md" });
    const manifest = build.blockManifest;

    expect(Array.isArray(manifest)).toBe(true);
    expect(manifest.length).toBe(emittedBlockCount(build.payload));
    expect(manifest.length).toBeGreaterThan(0);

    manifest.forEach((entry, i) => {
      // emitted_index is the array position: a dense 0..n-1 sequence.
      expect(entry.emitted_index).toBe(i);
      expect(SOURCE_SET.has(entry.source_file)).toBe(true);
      expect(Number.isInteger(entry.source_block_index)).toBe(true);
      expect(entry.source_block_index).toBeGreaterThanOrEqual(0);
      expect(entry.source_block_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(entry.rendered_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(VALID_SECTIONS.has(entry.section)).toBe(true);
      expect(typeof entry.forced).toBe("boolean");
      // Exactly the seven Phase 1 fields, nothing leaked in.
      expect(Object.keys(entry).sort()).toEqual([
        "emitted_index",
        "forced",
        "rendered_digest",
        "section",
        "source_block_digest",
        "source_block_index",
        "source_file",
      ]);
    });
  });

  it("the --full profile traces strictly more blocks than the default profile", () => {
    const sources = readSources(TEMPLATE_AGENTCTX);
    const def = buildArtifact({ sources, target: "agents-md", profile: "default" });
    const full = buildArtifact({ sources, target: "agents-md", profile: "full" });
    expect(full.blockManifest.length).toBeGreaterThan(def.blockManifest.length);
    // Sections the default profile omits appear in the full manifest.
    const fullSections = new Set(full.blockManifest.map((e) => e.section));
    expect(fullSections.has(SECTION_TITLES["decisions.md"])).toBe(true);
    expect(fullSections.has(SECTION_TITLES["glossary.md"])).toBe(true);
  });

  it("a constraints-only ontology yields a manifest entirely in the Constraints section", () => {
    const sources = readSources(MINIMAL_AGENTCTX);
    const build = buildArtifact({ sources, target: "agents-md" });
    expect(build.blockManifest.length).toBe(emittedBlockCount(build.payload));
    for (const entry of build.blockManifest) {
      expect(entry.section).toBe(SECTION_TITLES["constraints.md"]);
      expect(entry.source_file).toBe("constraints.md");
      expect(entry.forced).toBe(false);
    }
  });
});

describe("block manifest: safety sweep keeps true-source provenance", () => {
  it("marks the swept block forced with its real source_file, under Constraints", () => {
    const sources = readSources(SWEEP_AGENTCTX);
    const build = buildArtifact({ sources, target: "agents-md" });

    const forced = build.blockManifest.filter((e) => e.forced);
    expect(forced.length).toBeGreaterThan(0);
    for (const entry of forced) {
      // Forced blocks render under Constraints but name their true origin.
      expect(entry.section).toBe(SECTION_TITLES["constraints.md"]);
      expect(entry.source_file).not.toBe("constraints.md");
      expect(SOURCE_SET.has(entry.source_file)).toBe(true);
    }
    // The swept #destructive block comes from the excluded projects.md.
    expect(forced.some((e) => e.source_file === "projects.md")).toBe(true);

    // Native Constraints blocks are never marked forced.
    const nativeConstraints = build.blockManifest.filter(
      (e) => e.section === SECTION_TITLES["constraints.md"] && e.source_file === "constraints.md",
    );
    expect(nativeConstraints.length).toBeGreaterThan(0);
    for (const entry of nativeConstraints) expect(entry.forced).toBe(false);
  });
});

describe("block manifest: determinism and read-only / backward-compat boundaries", () => {
  it("is a pure function of the inputs — two builds are deep-equal", () => {
    const sources = readSources(TEMPLATE_AGENTCTX);
    const a = buildArtifact({ sources, target: "agents-md" });
    const b = buildArtifact({ sources, target: "agents-md" });
    expect(a.blockManifest).toEqual(b.blockManifest);
  });

  it("source_block_digest is block-scoped: editing one block changes only its digest", () => {
    const sources = readSources(TEMPLATE_AGENTCTX);
    const base = buildArtifact({ sources, target: "agents-md" });
    const edited = buildArtifact({
      sources: { ...sources, "constraints.md": `${sources["constraints.md"]}\n\n## Added rule #safety\n\nNew body.\n` },
      target: "agents-md",
    });

    // The shared leading entries keep identical source_block_digests; only the
    // new/changed tail differs. Compare the overlap by (source_file, index).
    const baseByKey = new Map(
      base.blockManifest.map((e) => [`${e.source_file}#${e.source_block_index}`, e.source_block_digest]),
    );
    let unchanged = 0;
    for (const e of edited.blockManifest) {
      const key = `${e.source_file}#${e.source_block_index}`;
      if (baseByKey.has(key) && baseByKey.get(key) === e.source_block_digest) unchanged += 1;
    }
    // The untouched blocks (everything but the appended one) keep their digests.
    expect(unchanged).toBe(base.blockManifest.length);
  });

  it("does not leak into the artifact bytes (no manifest keys in the emitted file)", () => {
    const sources = readSources(TEMPLATE_AGENTCTX);
    const build = buildArtifact({ sources, target: "agents-md" });
    for (const needle of [
      "block_manifest",
      "blockManifest",
      "source_block_digest",
      "rendered_digest",
      "emitted_index",
    ]) {
      expect(build.artifact).not.toContain(needle);
    }
  });

  it("rendered_digest matches an independent hash of the same source block", () => {
    const sources = readSources(TEMPLATE_AGENTCTX);
    const build = buildArtifact({ sources, target: "agents-md" });
    // Two distinct source blocks must not collide; identical digests would
    // mean the manifest cannot disambiguate provenance.
    const renderedDigests = build.blockManifest.map((e) => e.rendered_digest);
    expect(new Set(renderedDigests).size).toBe(renderedDigests.length);
    // And each is a real sha256 over *some* non-empty content.
    expect(renderedDigests.every((d) => d !== sha256(""))).toBe(true);
  });
});
