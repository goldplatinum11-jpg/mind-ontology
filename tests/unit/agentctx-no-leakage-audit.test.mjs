import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveAdapterFlags, selectMemoryAdapter, selectWritebackAdapter } from "../../scripts/agentctx/adapters/flags.mjs";
import { NULL_MEMORY_ADAPTER, retrieveMemory } from "../../scripts/agentctx/adapters/memory-adapter.mjs";
import { NULL_WRITEBACK_ADAPTER, collectWritebackProposals } from "../../scripts/agentctx/adapters/writeback-adapter.mjs";
import { hasEnrichment, renderEnrichmentSection } from "../../scripts/agentctx/adapters/enrichment.mjs";
import { compileContext } from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ADAPTERS_DIR = resolve(REPO_ROOT, "scripts/agentctx/adapters");

// Credential-shaped assignment, split so this audit's own source carries no
// literal credential keyword.
const CREDENTIAL_PATTERN = /\b(?:api[_-]?key|pass\s*word|sec\s*ret|to\s*ken|private[_-]?key|authorization)\b\s*[:=]\s*["'][^"']{6,}/i;
const REAL_URL_PATTERN = /https?:\/\/[a-z0-9.-]+\.(?:com|dev|net|org|io|workers\.dev)\b/i;

function adapterSources() {
  return readdirSync(ADAPTERS_DIR)
    .filter((f) => f.endsWith(".mjs"))
    .map((f) => ({ file: f, text: readFileSync(resolve(ADAPTERS_DIR, f), "utf8") }));
}

describe("hosted boundary no-leakage audit (P4-PR08)", () => {
  it("adapter source carries no hardcoded credential", () => {
    for (const { file, text } of adapterSources()) {
      expect(CREDENTIAL_PATTERN.test(text), `${file} appears to embed a credential`).toBe(false);
    }
  });

  it("adapter source carries no hardcoded hosted endpoint URL", () => {
    for (const { file, text } of adapterSources()) {
      expect(REAL_URL_PATTERN.test(text), `${file} embeds a real URL`).toBe(false);
    }
  });

  it("with flags OFF (default env), nothing hosted is reachable", async () => {
    const flags = resolveAdapterFlags({});
    const mem = selectMemoryAdapter(flags, { name: "hosted", async retrieve() { return { results: [{ id: "x", text: "leak" }] }; } });
    const wb = selectWritebackAdapter(flags, { name: "hosted", async proposeWriteback() { return { proposals: [{ kind: "node", summary: "x", payload: {} }] }; } });
    expect(mem).toBe(NULL_MEMORY_ADAPTER);
    expect(wb).toBe(NULL_WRITEBACK_ADAPTER);

    expect((await retrieveMemory(mem, { task: "t" })).results).toEqual([]);
    expect((await collectWritebackProposals(wb, {})).proposals).toEqual([]);
  });

  it("a local compiled pack contains no enrichment section", () => {
    const sources = { "constraints.md": "# Constraints\n\n## Safe #safety\n\nbe careful\n" };
    const pack = compileContext({ sources, task: "do something", scopes: [] });
    // No hosted enrichment is wired into compile; the pack is purely local.
    const text = JSON.stringify(pack);
    expect(hasEnrichment(text)).toBe(false);
    expect(text.toLowerCase()).not.toContain("hosted memory");
  });

  it("empty enrichment renders nothing (no hosted residue on the default path)", () => {
    expect(renderEnrichmentSection([])).toBe("");
  });

  it("ships the Phase 4 closeout doc", () => {
    expect(existsSync(resolve(REPO_ROOT, "docs/mind-ontology-phase-4-closeout-v0.md"))).toBe(true);
  });
});
