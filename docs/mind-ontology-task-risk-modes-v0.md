# Mind Ontology — Task-Risk Modes v0

**Status:** Phase 2 / P2-PR09
**Module:** `scripts/agentctx/risk.mjs` — `classifyTaskRisk`, `resolveRiskLevel`
**Wired into:** `scripts/agentctx/compile.mjs` (`--risk` flag, `pack.risk`)

A task that deletes data, rewrites history, deploys, or changes production
structure should never receive a context pack that omits the ontology's safety
guidance — even if the task wording does not lexically match a safety block.
Task-risk modes make the compiler **force safety context into risky packs**.

---

## How a task is classified

`classifyTaskRisk(task, scopes)` returns `{ level: "safe" | "risky", signals }`.
Classification is conservative and keyword-driven, so ordinary build tasks stay
`safe`:

- **Risk words** (whole tokens): delete, drop, truncate, destroy, wipe, purge,
  overwrite, migrate/migration, deploy/deployment, irreversible, uninstall,
  downgrade, revoke, production, prod, … (see `RISK_WORDS`).
- **Risk phrases** (substrings): `force push`, `rm -rf`, `schema change`,
  `data loss`, `rewrite history`, `drop table`, `delete from`.

`signals` lists what matched, so the classification is explainable.

---

## Risk modes

The compiler accepts `--risk auto|safe|risky` (default `auto`):

| Mode | Behavior |
|---|---|
| `auto` | Classify the task; force safety context only when classified risky. |
| `safe` | Never force; treat the task as safe regardless of wording. |
| `risky` | Always force safety context, even for a calm-sounding task. |

```sh
npm run agentctx:compile -- --task "Drop the orders table" --risk auto
npm run agentctx:compile -- --task "Tidy docs" --risk risky   # force anyway
```

---

## What "forcing" does

On a risky task, any block tagged with a **safety-class tag** that was not
already selected is forced into the pack with `reason: "risk-forced"`,
regardless of its relevance score. Safety-class tags (`SAFETY_TAGS`):

```
safety  destructive  security  secrets  irreversible
```

`constraints.md` is always fully included, so its safety blocks are present on
every task; forcing additionally surfaces safety-tagged blocks from the scored
sources (e.g. the `#safety` competency question in `cq.md`, or a `#destructive`
decision).

---

## Output

Every pack now carries a `risk` field:

```json
"risk": { "level": "risky", "mode": "auto", "signals": ["delete", "drop"] }
```

The Markdown render adds a header line:

```text
Risk: risky (delete, production, drop)
```

Safe tasks are unaffected: selection is byte-for-byte what it was before this
change, and `risk.level` is simply reported as `safe`.

---

## Why this is safe to ship

- Default `auto` only *adds* safety blocks, and only on clearly destructive
  tasks; it never removes or reorders the blocks a safe task would have received.
- The classifier errs toward `safe` (a small, explicit keyword set), so it will
  not spam every task with forced safety context.
- A reviewer who wants the strict behavior can pass `--risk risky`; a reviewer
  who wants the legacy behavior can pass `--risk safe`.
