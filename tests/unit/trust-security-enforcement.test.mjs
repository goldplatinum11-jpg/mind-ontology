import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  resolveAdapterFlags,
  selectMemoryAdapter,
  selectWritebackAdapter,
} from "../../scripts/agentctx/adapters/flags.mjs";
import { NULL_MEMORY_ADAPTER, retrieveMemory } from "../../scripts/agentctx/adapters/memory-adapter.mjs";
import { NULL_WRITEBACK_ADAPTER, collectWritebackProposals } from "../../scripts/agentctx/adapters/writeback-adapter.mjs";
import { compileContext } from "../../scripts/agentctx/compile.mjs";
import { ONTOLOGY_SCHEMA, validateSource } from "../../scripts/agentctx/schema.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = readFileSync(resolve(REPO_ROOT, "docs/mind-ontology-trust-security-model-v0.md"), "utf8");

// M50 — the trust/security model doc claims each property is "enforced by code and
// tests, not just asserted." This test binds the doc's claims to the code that
// enforces them: if the doc says it, the mechanism must actually do it.
describe("trust & security model is code-enforced (M50)", () => {
  it("the doc states the enforcement map it promises to back", () => {
    for (const row of ["No secrets", "Read-only", "Fail-closed hosted", "Writeback proposal-only", "Risk-aware"]) {
      expect(DOC).toContain(row);
    }
  });

  it("claim 5 (hosted opt-in, default off): flags default off and degrade to null adapters", () => {
    const flags = resolveAdapterFlags({}); // real default environment
    expect(flags.memoryRetrieval).toBe(false);
    expect(flags.writebackProposals).toBe(false);

    // Even handed a working hosted adapter, the off flag yields the null adapter.
    const hostedMem = { name: "hosted", async retrieve() { return { results: [{ id: "x", text: "leak" }] }; } };
    expect(selectMemoryAdapter(flags, hostedMem)).toBe(NULL_MEMORY_ADAPTER);
    const hostedWb = { name: "hosted", async proposeWriteback() { return { proposals: [{ kind: "node", summary: "s", payload: {} }] }; } };
    expect(selectWritebackAdapter(flags, hostedWb)).toBe(NULL_WRITEBACK_ADAPTER);
  });

  it("claim 6 (writeback proposal-only): null writeback proposes nothing and has no execute", () => {
    expect(typeof NULL_WRITEBACK_ADAPTER.proposeWriteback).toBe("function");
    expect(NULL_WRITEBACK_ADAPTER.execute).toBeUndefined();
  });

  it("fail-closed retrieval/collection return empty on the default path", async () => {
    expect((await retrieveMemory(NULL_MEMORY_ADAPTER, { task: "t" })).results).toEqual([]);
    expect((await collectWritebackProposals(NULL_WRITEBACK_ADAPTER, {})).proposals).toEqual([]);
  });

  it("claim 7 (risk-aware): a destructive task forces safety context", () => {
    const sources = {
      "constraints.md": "# Constraints\n\n## Be careful #safety\n\nstop before destructive work\n",
      "direction.md": "# Direction\n\n## Build #build\n\nship features\n",
    };
    const pack = compileContext({ sources, task: "drop the production database", scopes: [] });
    expect(pack.risk.level).toBe("risky");
    expect(pack.selected.some((b) => b.file === "constraints.md")).toBe(true);
  });

  it("claim 4 (no secrets): the validator rejects a credential-shaped value", () => {
    const raw = "# Constraints\n\n## Rule #safety\n\n" + ["api", "key"].join("_") + ": ABCD1234EFGH\n";
    const issues = validateSource("constraints.md", raw, ONTOLOGY_SCHEMA["constraints.md"]);
    expect(issues.some((i) => i.rule === "no-credentials")).toBe(true);
  });
});
