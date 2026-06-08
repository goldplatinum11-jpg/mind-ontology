import { describe, expect, it } from "vitest";
import {
  NULL_MEMORY_ADAPTER,
  isMemoryAdapter,
  isMemoryResult,
  retrieveMemory,
} from "../../scripts/agentctx/adapters/memory-adapter.mjs";

describe("memory retrieval adapter contract (P4-PR01)", () => {
  it("the null default is a conforming, fail-closed adapter", async () => {
    expect(isMemoryAdapter(NULL_MEMORY_ADAPTER)).toBe(true);
    const out = await NULL_MEMORY_ADAPTER.retrieve({ task: "anything" });
    expect(out.results).toEqual([]);
  });

  it("isMemoryAdapter rejects non-conforming objects", () => {
    expect(isMemoryAdapter(null)).toBe(false);
    expect(isMemoryAdapter({})).toBe(false);
    expect(isMemoryAdapter({ retrieve: () => {} })).toBe(false); // missing name
    expect(isMemoryAdapter({ name: "x", retrieve: () => {} })).toBe(true);
  });

  it("validates result shape", () => {
    expect(isMemoryResult({ id: "n1", text: "hi" })).toBe(true);
    expect(isMemoryResult({ id: "n1", text: "hi", score: 0.5, source: "sirt" })).toBe(true);
    expect(isMemoryResult({ id: "n1" })).toBe(false);
    expect(isMemoryResult({ text: "no id" })).toBe(false);
    expect(isMemoryResult({ id: "n1", text: "hi", score: "high" })).toBe(false);
  });

  it("retrieveMemory fails closed when no adapter is configured", async () => {
    const out = await retrieveMemory(undefined, { task: "t" });
    expect(out.results).toEqual([]);
    expect(out.degraded).toBe(true);
    expect(out.reason).toBe("no-adapter");
  });

  it("retrieveMemory fails closed when the adapter throws", async () => {
    const boom = { name: "boom", async retrieve() { throw new Error("network down"); } };
    const out = await retrieveMemory(boom, { task: "t" });
    expect(out.results).toEqual([]);
    expect(out.degraded).toBe(true);
    expect(out.reason).toMatch(/adapter-error/);
  });

  it("retrieveMemory passes through a conforming adapter and drops malformed results", async () => {
    const fake = {
      name: "fake",
      async retrieve() {
        return { results: [{ id: "n1", text: "good" }, { id: "", text: "bad" }, { text: "no id" }] };
      },
    };
    const out = await retrieveMemory(fake, { task: "t" });
    expect(out.degraded).toBe(false);
    expect(out.results).toEqual([{ id: "n1", text: "good" }]);
  });
});
