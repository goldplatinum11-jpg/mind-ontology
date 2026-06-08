import { describe, expect, it } from "vitest";
import {
  NULL_WRITEBACK_ADAPTER,
  buildWritebackProposal,
  collectWritebackProposals,
  isWritebackAdapter,
  isWritebackProposal,
} from "../../scripts/agentctx/adapters/writeback-adapter.mjs";

describe("writeback proposal contract (P4-PR02)", () => {
  it("the null default proposes nothing", async () => {
    expect(isWritebackAdapter(NULL_WRITEBACK_ADAPTER)).toBe(true);
    const out = await NULL_WRITEBACK_ADAPTER.proposeWriteback({ decision: "x" });
    expect(out.proposals).toEqual([]);
  });

  it("exposes no execute path on the contract", () => {
    expect(NULL_WRITEBACK_ADAPTER.execute).toBeUndefined();
    expect(NULL_WRITEBACK_ADAPTER.write).toBeUndefined();
  });

  it("builds an inert, valid proposal with status proposed", () => {
    const p = buildWritebackProposal({ kind: "node", summary: "Record decision", payload: { title: "X" } });
    expect(p.status).toBe("proposed");
    expect(isWritebackProposal(p)).toBe(true);
  });

  it("rejects unknown kinds and missing summary", () => {
    expect(() => buildWritebackProposal({ kind: "delete", summary: "s", payload: {} })).toThrow();
    expect(() => buildWritebackProposal({ kind: "node", summary: "", payload: {} })).toThrow();
  });

  it("validates proposal shape", () => {
    expect(isWritebackProposal({ kind: "edge", summary: "links", payload: {} })).toBe(true);
    expect(isWritebackProposal({ kind: "node", summary: "x" })).toBe(false); // no payload
    expect(isWritebackProposal({ kind: "bogus", summary: "x", payload: {} })).toBe(false);
  });

  it("collectWritebackProposals fails closed and never throws", async () => {
    expect((await collectWritebackProposals(undefined, {})).reason).toBe("no-adapter");

    const boom = { name: "boom", async proposeWriteback() { throw new Error("down"); } };
    const out = await collectWritebackProposals(boom, {});
    expect(out.proposals).toEqual([]);
    expect(out.degraded).toBe(true);
    expect(out.reason).toMatch(/adapter-error/);
  });

  it("passes through conforming proposals and drops malformed ones", async () => {
    const fake = {
      name: "fake",
      async proposeWriteback() {
        return {
          proposals: [
            { kind: "node", summary: "ok", payload: {} },
            { kind: "node", summary: "", payload: {} }, // malformed
            { kind: "delete", summary: "x", payload: {} }, // bad kind
          ],
        };
      },
    };
    const out = await collectWritebackProposals(fake, { decision: "d" });
    expect(out.degraded).toBe(false);
    expect(out.proposals).toEqual([{ kind: "node", summary: "ok", payload: {} }]);
  });
});
