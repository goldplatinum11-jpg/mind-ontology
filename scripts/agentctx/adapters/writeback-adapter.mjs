// Mind Ontology — SIRT writeback PROPOSAL contract (Phase 4 / P4-PR02).
//
// PROPOSAL-ONLY. This module defines the contract for turning a durable decision
// into a hosted-memory writeback *proposal*. It NEVER executes a write. A
// proposal is an inert description that a human (or a separately-gated executor)
// must explicitly confirm. The OSS layer ships the contract + a fail-closed
// default that proposes nothing. No hosted endpoint, auth, secret, or live call.
//
// Contract:
//   adapter.name: string
//   adapter.proposeWriteback(input) => Promise<{ proposals: WritebackProposal[] }>
//     input: { decision: string, context?: object }
//   WritebackProposal: { kind: "node"|"edge", summary: string, payload: object }
//
// There is intentionally NO execute() here. Execution is out of scope for the
// OSS layer and must be a separately-reviewed, explicitly-gated step.

export const PROPOSAL_KINDS = ["node", "edge"];

export const NULL_WRITEBACK_ADAPTER = Object.freeze({
  name: "null",
  async proposeWriteback(_input) {
    return { proposals: [] };
  },
});

export function isWritebackAdapter(obj) {
  return Boolean(obj) && typeof obj.name === "string" && typeof obj.proposeWriteback === "function";
}

export function isWritebackProposal(proposal) {
  if (!proposal || typeof proposal !== "object") return false;
  if (!PROPOSAL_KINDS.includes(proposal.kind)) return false;
  if (typeof proposal.summary !== "string" || proposal.summary.length === 0) return false;
  if (!proposal.payload || typeof proposal.payload !== "object") return false;
  return true;
}

/**
 * Construct a writeback proposal WITHOUT executing it. Pure data — the returned
 * object describes a candidate write that must be confirmed downstream.
 */
export function buildWritebackProposal({ kind, summary, payload }) {
  if (!PROPOSAL_KINDS.includes(kind)) {
    throw new Error(`Unknown proposal kind: ${kind} (expected ${PROPOSAL_KINDS.join("|")})`);
  }
  if (!summary) throw new Error("Writeback proposal requires a summary");
  const proposal = { kind, summary, payload: payload ?? {}, status: "proposed" };
  if (!isWritebackProposal(proposal)) throw new Error("Constructed an invalid writeback proposal");
  return proposal;
}

/**
 * Collect writeback proposals through an adapter, fail-closed. A missing or
 * non-conforming adapter, a thrown error, or a malformed payload yields no
 * proposals. Crucially, this never writes — it only gathers candidates.
 *
 * @returns {Promise<{ proposals: Array, degraded: boolean, reason?: string }>}
 */
export async function collectWritebackProposals(adapter, input) {
  if (!isWritebackAdapter(adapter)) {
    return { proposals: [], degraded: true, reason: "no-adapter" };
  }
  try {
    const out = await adapter.proposeWriteback(input);
    const proposals = Array.isArray(out?.proposals) ? out.proposals.filter(isWritebackProposal) : [];
    return { proposals, degraded: false };
  } catch (error) {
    return { proposals: [], degraded: true, reason: `adapter-error: ${error?.message ?? "unknown"}` };
  }
}
