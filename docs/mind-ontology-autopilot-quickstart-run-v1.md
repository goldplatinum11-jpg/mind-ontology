# Mind Ontology — Autopilot Quickstart Run v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

A copy-paste sequence of **real compile runs** that show an autopilot line reading
context on the right axis, forcing safety on a risky step, and verifying the
install — all locally, no account, no network, no hosted SIRT.

These commands run against the shipped `.agentctx/` template, so they work with no
edits. Substitute your own ontology folder once you have one.

---

## 1. A right-axis task step

```sh
npm run agentctx:compile -- --task "Plan the next docs PR for the autopilot lane" --scope mcp
```

Expected: `constraints.md` blocks appear as **always included**; matching
`direction.md` / `agent-roles.md` blocks are scored in. The pack is the slice for
*this* task, not the whole ontology.

## 2. A risky step forces safety

```sh
npm run agentctx:compile -- --task "Drop the orders table and delete the backups" --risk auto
```

Expected: the task classifies as **risky**, and safety-tagged blocks are forced
into the pack (`reason: "risk-forced"`) regardless of score. The live-write
boundary is still enforced separately and still fails closed.

## 3. Measure how focused the pack is

```sh
npm run agentctx:metrics -- --task "Plan the next docs PR for the autopilot lane"
```

Expected: a focus metric showing the pack is a small fraction of the full
ontology — the whole point of compiling instead of dumping.

## 4. Verify the install (the gates)

```sh
npm run agentctx:proof        # smallest viable gate
npm run agentctx:validate     # 0 errors against the schema
npm run agentctx:smoke        # end-to-end free-layer journey
npm test                      # full unit suite
```

Green on these means the autopilot line is reading a valid, portable constitution
with no hosted dependency.

---

## What a wrong-axis call does NOT return

```sh
npm run agentctx:compile -- --task "Recall everything we ever discussed"
```

Expected: the compiler does **not** dump the ontology. An off-axis, history-style
task earns only the always-included safety floor — the history/recall axis is the
optional hosted memory adapter, not the local layer. This is the right-axis
guarantee in action; see the
[wrong-axis concept](mind-ontology-autopilot-concepts-v1.md) and the
[reading protocol](mind-ontology-autopilot-reading-protocol-v1.md).
