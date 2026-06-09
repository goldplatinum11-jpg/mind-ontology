# Mind Ontology — Autopilot Lane Lifecycle v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

The shape of one lane from start to finish — **open → work → checkpoint → handoff
→ close** — and which pack artifact governs each phase. A lane is the unit a
controller assigns and reviews; this doc is its life story.

Every phase is local and files-based; none requires a hosted SIRT call.

---

## The five phases

### 1. Open

The controller defines the lane: its goal, its **write scope**, and its stop
policy. The worker reads `get_context` and `list_constraints` to load that frame.
Governed by the [reading protocol](mind-ontology-autopilot-reading-protocol-v1.md)
and [scope discipline](mind-ontology-autopilot-scope-discipline-v1.md).

### 2. Work

The worker runs ADLs: inspect → add a small artifact → add a guard test → run
focused tests → continue. Each ADL is one right-axis `get_context` read; risky
steps re-read `list_constraints`. Governed by the
[risk modes](mind-ontology-autopilot-risk-modes-v1.md) and the
[two-tool contract](mind-ontology-autopilot-two-tool-contract-v1.md).

### 3. Checkpoint

At a clean, green, in-scope state the worker runs the gates and writes a Result
Pack — then **continues**, because a checkpoint is a save point, not a stop.
Governed by the [checkpoint cadence](mind-ontology-autopilot-checkpoint-cadence-v1.md)
and the [Result Pack shape](mind-ontology-autopilot-result-pack-v1.md).

### 4. Handoff

The worker hands the Result Pack to the controller, who reviews it mechanically
against the artifacts. Governed by the
[worker self-check](mind-ontology-autopilot-worker-selfcheck-v1.md) and the
[controller checklist](mind-ontology-autopilot-controller-checklist-v1.md).

### 5. Close

The lane closes only when a **valid terminal stop** is reached — a boundary or a
budget, never a convenient checkpoint. The controller commits if the review
passes. Governed by the [stop policy](mind-ontology-autopilot-stop-policy-v1.md)
and [safe continuation](mind-ontology-autopilot-safe-continuation-v1.md).

---

## The loop within the lane

Phases 2–4 repeat: a long lane is many work→checkpoint→handoff cycles before a
single close. That is the runway. Closing early — at a green checkpoint with work
still in scope — is the most common mistake; the lifecycle exists to name the
difference between *checkpoint* and *close*.

See [pack at a glance](mind-ontology-autopilot-manifest-v1.md) for every artifact
named above.
