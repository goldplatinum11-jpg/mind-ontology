# How the Compiler Scores Blocks

The compiler turns a `.agentctx/` folder into a **task-scoped** pack by scoring
every block against your task and `--scope`, then keeping the highest scorers.
This page explains exactly how, so you can author blocks that surface when you
need them. The logic lives in `scoreBlock` / `compileContext`
(`scripts/agentctx/compile.mjs`).

## The scoring table

Each block earns points for matching your **scope tags** and your **task words**,
weighted by *where* the match lands (a tag counts more than a heading word, which
counts more than a body word):

| Match location | Scope match | Task-word match |
|---|---:|---:|
| Block **tag** (`#foo`) | **+8** | +6 |
| Block **heading** word | +5 | +4 |
| Block **body** word | +2 | +1 |

Two consequences fall straight out of the numbers:

- **Scope beats task at every level** (8 > 6, 5 > 4, 2 > 1). Passing `--scope`
  is the strongest lever you have to focus a pack.
- **Tags beat headings beat bodies.** Tag your blocks deliberately; a `#tag` is
  worth far more than the same word buried in prose.

Scores are additive across all matches, so a block matching several scopes/words
in several places accumulates them.

> **Tags count twice.** A block's tags are *also* scanned as heading tokens, so a
> tag match earns both the tag points **and** the heading points (e.g. a scope
> that matches a tag scores 8 + 5 = 13, versus 5 for a heading-only match). Tags
> are decisively the strongest signal — which is why the schema leans on them.

## Selection rules

1. **`constraints.md` is always included** — every block, marked `score: "always"`
   (`reason: "always"`). Non-negotiable rules are never scored away.
2. Every other file's blocks are scored, sorted by score (descending; ties break
   by document order), then:
   - blocks scoring **below the minimum score (default `2`)** are dropped;
   - at most **`maxBlocksPerFile` (default `1`)** top block per file is kept.
3. Kept blocks are marked `reason: "matched"`; the rest are `omitted`.
4. **Risk forcing:** if the task reads as risky (see
   [task risk modes](mind-ontology-task-risk-modes-v0.md)), any omitted block
   carrying a safety-class tag is forced back in with `reason: "risk-forced"`,
   regardless of score.

The defaults (`minScore = 2`, `maxBlocksPerFile = 1`) favor a *small* pack: one
strong block per file plus all constraints. A single body-word match (+1) is
below the threshold, so incidental word overlap does not pad the pack — you need
a tag, a heading word, or multiple matches to clear the bar.

## Authoring implications

- Want a block to surface for a topic? **Tag it** with that topic and pass the
  topic as `--scope`.
- Want a rule to always apply? Put it in `constraints.md`.
- Pack too broad? Narrow `--scope`. Pack missing something? Tag the block or add
  the keyword to its heading.

Measure focus with `npm run agentctx:metrics` (see the
[quickstart](mind-ontology-quickstart.md)); these properties are pinned by
`tests/unit/scoring-behavior.test.mjs`.
