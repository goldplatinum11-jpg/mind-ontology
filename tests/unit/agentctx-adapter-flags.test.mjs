import { describe, expect, it } from "vitest";
import {
  MEMORY_FLAG,
  WRITEBACK_FLAG,
  isFlagEnabled,
  resolveAdapterFlags,
  selectMemoryAdapter,
  selectWritebackAdapter,
} from "../../scripts/agentctx/adapters/flags.mjs";
import { NULL_MEMORY_ADAPTER } from "../../scripts/agentctx/adapters/memory-adapter.mjs";
import { NULL_WRITEBACK_ADAPTER } from "../../scripts/agentctx/adapters/writeback-adapter.mjs";

const memAdapter = { name: "mem", async retrieve() { return { results: [] }; } };
const wbAdapter = { name: "wb", async proposeWriteback() { return { proposals: [] }; } };

describe("adapter feature flags (P4-PR06)", () => {
  it("flags default OFF when env is empty", () => {
    const flags = resolveAdapterFlags({});
    expect(flags).toEqual({ memoryRetrieval: false, writebackProposals: false });
  });

  it("only exact truthy values enable a flag", () => {
    expect(isFlagEnabled("1")).toBe(true);
    expect(isFlagEnabled("true")).toBe(true);
    expect(isFlagEnabled("ON")).toBe(true);
    expect(isFlagEnabled("0")).toBe(false);
    expect(isFlagEnabled("false")).toBe(false);
    expect(isFlagEnabled("")).toBe(false);
    expect(isFlagEnabled(undefined)).toBe(false);
    expect(isFlagEnabled("enabled")).toBe(false);
  });

  it("resolves flags from the named env vars", () => {
    const flags = resolveAdapterFlags({ [MEMORY_FLAG]: "1", [WRITEBACK_FLAG]: "0" });
    expect(flags.memoryRetrieval).toBe(true);
    expect(flags.writebackProposals).toBe(false);
  });

  it("selects the null adapter when the flag is off", () => {
    const flags = { memoryRetrieval: false, writebackProposals: false };
    expect(selectMemoryAdapter(flags, memAdapter)).toBe(NULL_MEMORY_ADAPTER);
    expect(selectWritebackAdapter(flags, wbAdapter)).toBe(NULL_WRITEBACK_ADAPTER);
  });

  it("selects the configured adapter only when flag on AND adapter conforms", () => {
    const on = { memoryRetrieval: true, writebackProposals: true };
    expect(selectMemoryAdapter(on, memAdapter)).toBe(memAdapter);
    expect(selectWritebackAdapter(on, wbAdapter)).toBe(wbAdapter);
    // Flag on but adapter malformed -> still null (fail-closed).
    expect(selectMemoryAdapter(on, {})).toBe(NULL_MEMORY_ADAPTER);
    expect(selectWritebackAdapter(on, null)).toBe(NULL_WRITEBACK_ADAPTER);
  });
});
