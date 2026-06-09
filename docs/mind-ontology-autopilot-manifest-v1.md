# Mind Ontology — Autopilot Pack at a Glance v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

One-page manifest of everything the Autopilot Integration Pack ships, so a reviewer
or adopter can see the whole surface at once. Everything below is local-first and
OSS-safe — docs, tests, fixtures, and templates only, with no hosted SIRT.

**Reading order:** start at the [frame](mind-ontology-autopilot-pack-v1.md), then
the [reading protocol](mind-ontology-autopilot-reading-protocol-v1.md) and
[stop policy](mind-ontology-autopilot-stop-policy-v1.md), then the
[adoption walkthrough](mind-ontology-autopilot-adoption-v1.md); everything else is
reference you can reach from the [docs index](mind-ontology.md).

---

## Docs

- **Frame** — [pack frame](mind-ontology-autopilot-pack-v1.md): what/who/boundary.
- **Behavior** — [reading protocol](mind-ontology-autopilot-reading-protocol-v1.md),
  [stop policy](mind-ontology-autopilot-stop-policy-v1.md),
  [risk modes](mind-ontology-autopilot-risk-modes-v1.md),
  [safe continuation](mind-ontology-autopilot-safe-continuation-v1.md).
- **Adoption** — [adoption walkthrough](mind-ontology-autopilot-adoption-v1.md),
  [quickstart run](mind-ontology-autopilot-quickstart-run-v1.md),
  [portability](mind-ontology-autopilot-portability-v1.md).
- **Contracts** — [two-tool contract](mind-ontology-autopilot-two-tool-contract-v1.md),
  [two-tool vs many-tool](mind-ontology-autopilot-two-tool-vs-many-v1.md),
  [connector parity](mind-ontology-autopilot-connector-parity-v1.md),
  [result-pack shape](mind-ontology-autopilot-result-pack-v1.md),
  [result-pack walkthrough](mind-ontology-autopilot-result-pack-walkthrough-v1.md).
- **Discipline** — [controller checklist](mind-ontology-autopilot-controller-checklist-v1.md),
  [worker self-check](mind-ontology-autopilot-worker-selfcheck-v1.md),
  [scope discipline](mind-ontology-autopilot-scope-discipline-v1.md),
  [checkpoint cadence](mind-ontology-autopilot-checkpoint-cadence-v1.md),
  [lane lifecycle](mind-ontology-autopilot-lane-lifecycle-v1.md).
- **Rationale** — [trust tie-in](mind-ontology-autopilot-trust-tie-in-v1.md),
  [why local-first](mind-ontology-autopilot-why-local-first-v1.md),
  [autopilot vs single-shot](mind-ontology-autopilot-vs-single-shot-v1.md),
  [why two roles](mind-ontology-autopilot-two-roles-v1.md),
  [operator FAQ](mind-ontology-autopilot-operator-faq-v1.md),
  [common mistakes](mind-ontology-autopilot-common-mistakes-v1.md),
  [pack versioning](mind-ontology-autopilot-versioning-v1.md),
  [pack non-goals](mind-ontology-autopilot-non-goals-v1.md),
  [extending the pack](mind-ontology-autopilot-extending-v1.md),
  [vs per-tool instruction files](mind-ontology-autopilot-vs-instruction-files-v1.md),
  [pack changelog](mind-ontology-autopilot-changelog-v1.md),
  [cost model](mind-ontology-autopilot-cost-model-v1.md),
  [observability](mind-ontology-autopilot-observability-v1.md),
  [one-line instruction](mind-ontology-autopilot-one-line-instruction-v1.md),
  [tool-call ordering](mind-ontology-autopilot-tool-call-ordering-v1.md),
  [empty-ontology behavior](mind-ontology-autopilot-empty-ontology-v1.md),
  [maturity self-audit](mind-ontology-autopilot-maturity-audit-v1.md),
  [adopting incrementally](mind-ontology-autopilot-adopting-incrementally-v1.md),
  [guard glossary](mind-ontology-autopilot-guard-glossary-v1.md),
  [when NOT to use](mind-ontology-autopilot-when-not-to-use-v1.md),
  [pack principles](mind-ontology-autopilot-principles-v1.md),
  [one-paragraph pitch](mind-ontology-autopilot-pitch-v1.md),
  [reviewer quickstart](mind-ontology-autopilot-reviewer-quickstart-v1.md),
  [contributor FAQ](mind-ontology-autopilot-contributor-faq-v1.md),
  [onboarding a new client](mind-ontology-autopilot-onboarding-client-v1.md),
  [principles applied](mind-ontology-autopilot-principles-applied-v1.md),
  [cross-pack consistency](mind-ontology-autopilot-consistency-v1.md),
  [line health signals](mind-ontology-autopilot-line-health-v1.md),
  [reading paths](mind-ontology-autopilot-reading-paths-v1.md),
  [quality bar](mind-ontology-autopilot-quality-bar-v1.md),
  [state of the pack](mind-ontology-autopilot-state-of-pack-v1.md).
- **Reference** — [concepts](mind-ontology-autopilot-concepts-v1.md),
  [glossary tie-in](mind-ontology-autopilot-glossary-tie-in-v1.md),
  [failure modes](mind-ontology-autopilot-failure-modes-v1.md),
  [minimal vs full](mind-ontology-autopilot-minimal-vs-full-v1.md).

## Templates (`templates/mind-ontology/autopilot/`)

- `README.md` — the drop-in kit overview.
- `autopilot-blocks.md` — `.agentctx` blocks to paste into your ontology.
- `autopilot.mcp.json` — Claude Code / Cursor MCP config.
- `autopilot-codex.toml` — Codex MCP config.
- `example-codex-agent.md` — a pasteable worker agent prompt.
- `cheat-sheet.md` — a one-screen trigger + stop-policy reference.

## Fixtures (`tests/fixtures/`)

- `autopilot-line/.agentctx/` — a complete nine-file example ontology.
- `autopilot-roles/.agentctx/` — a multi-role example for the role matrix.
- `autopilot-minimal/.agentctx/` — a constraints-only minimal example.
- `autopilot-solo/.agentctx/` — a solo-founder single-project example.
- `autopilot-stop-cases.json` — the stop-policy decision table.
- `autopilot-result-pack.example.json` — an example Result Pack.

## Tests

Every doc, template, and fixture above is paired with a guard test under
`tests/unit/autopilot-*.test.mjs`, plus cross-cutting guards: the consistency
sweep, the leakage sweep, and the pack-completeness check that keeps this manifest
and the docs index honest.

---

The pack is intentionally small and auditable: you can read every file in a PR. See
the [docs index](mind-ontology.md) for the same set in reading order.
