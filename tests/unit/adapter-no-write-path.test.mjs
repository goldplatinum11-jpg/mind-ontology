import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  NULL_WRITEBACK_ADAPTER,
  buildWritebackProposal,
  collectWritebackProposals,
} from "../../scripts/agentctx/adapters/writeback-adapter.mjs";
import { NULL_MEMORY_ADAPTER } from "../../scripts/agentctx/adapters/memory-adapter.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ADAPTERS = resolve(REPO_ROOT, "scripts/agentctx/adapters");
const read = (f) => readFileSync(resolve(ADAPTERS, f), "utf8");

// Any method name that would imply the OSS layer can perform a live/hosted write.
const WRITE_VERBS = ["execute", "commit", "write", "persist", "save", "send", "post", "put", "delete", "flush", "apply"];

describe("writeback stays proposal-only — no execute/live-write path (M19)", () => {
  it("the null writeback adapter exposes no write verb, only proposeWriteback", () => {
    const keys = Object.keys(NULL_WRITEBACK_ADAPTER);
    expect(keys).toContain("proposeWriteback");
    for (const verb of WRITE_VERBS) {
      expect(typeof NULL_WRITEBACK_ADAPTER[verb]).not.toBe("function");
    }
  });

  it("a built proposal is inert data marked 'proposed', with no execute method", () => {
    const p = buildWritebackProposal({ kind: "node", summary: "remember X", payload: { x: 1 } });
    expect(p.status).toBe("proposed");
    for (const verb of WRITE_VERBS) {
      expect(typeof p[verb]).not.toBe("function");
    }
  });

  it("collecting proposals never writes — even a 'writing' adapter only yields candidates", async () => {
    let wrote = false;
    const adapter = {
      name: "hosted",
      async proposeWriteback() {
        // A real hosted adapter would propose; it must not be invited to write here.
        return { proposals: [{ kind: "node", summary: "x", payload: {} }] };
      },
      async execute() {
        wrote = true; // collectWritebackProposals must never call this
      },
    };
    const out = await collectWritebackProposals(adapter, { decision: "d" });
    expect(out.proposals.length).toBe(1);
    expect(wrote).toBe(false);
  });

  it("the writeback module source defines no execute()/fetch and says proposal-only", () => {
    const src = read("writeback-adapter.mjs");
    // No execute() METHOD DEFINITION (a comment may mention it to say it is absent).
    expect(src).not.toMatch(/\b(?:async\s+)?execute\s*\([^)]*\)\s*\{/);
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src.toUpperCase()).toContain("PROPOSAL-ONLY");
  });
});

describe("memory adapter is read-only (M18)", () => {
  it("the null memory adapter exposes only retrieve, no write verb", () => {
    expect(typeof NULL_MEMORY_ADAPTER.retrieve).toBe("function");
    for (const verb of WRITE_VERBS) {
      expect(typeof NULL_MEMORY_ADAPTER[verb]).not.toBe("function");
    }
  });

  it("the memory module source performs no network I/O", () => {
    const src = read("memory-adapter.mjs");
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/https?:\/\//);
  });
});
