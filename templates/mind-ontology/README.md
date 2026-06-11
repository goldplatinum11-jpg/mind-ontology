# Mind Ontology `.agentctx/` Template

This template gives a new user a neutral, self-contained starting point for
Mind Ontology MCP. It needs no account, no network, and no hosted backend.

Copy `.agentctx/` into the repo or folder where the local MCP server will run,
then edit the files to match your own direction, projects, vocabulary, and
constraints.

```text
templates/mind-ontology/.agentctx/
  constraints.md   # non-negotiable rules — ALWAYS included in every pack
  identity.md      # who the AI is helping and how it should relate to them
  direction.md     # what you are building/deciding right now
  projects.md      # active products, repos, runways, business contexts
  decisions.md     # durable decisions and their reasons
  architecture.md  # how your system is shaped (optional but recommended)
  agent-roles.md   # what each AI/tool is responsible for
  glossary.md      # local vocabulary and product terms
  cq.md            # competency questions — the ontology's self-test layer
```

## All nine files are compiled

The compiler reads **all nine** source files (see `SOURCE_FILES` in
`scripts/agentctx/compile.mjs`). `constraints.md` is always included; the rest
are scored against the task and `--scope`, and only the highest-scoring blocks
are emitted. A file you omit simply contributes no blocks — a minimal project
that ships only `constraints.md` still works. There is no "core files first,
others later" split anymore; the schema is complete.

Each file's authoring contract is documented under `docs/`:

- constraints → `constraints.md` rules; see also the task risk modes doc.
- competency questions → `docs/mind-ontology-cq-schema-v0.md`
- identity / direction / projects / decisions / glossary / agent-roles →
  the matching `docs/mind-ontology-*-schema-v0.md` files.

## Self-test this template

From the repo root you can compile a pack straight from this template directory,
proving it is usable with no edits and no hosted dependency:

```sh
node scripts/agentctx/compile.mjs compile \
  --cwd templates/mind-ontology \
  --task "Plan the next PR and avoid forbidden writes" \
  --scope "mcp,safety"
```

`constraints.md` blocks appear as "always included"; scored blocks from the
other files appear when they match the task.

## Rules

- Do not put secrets, API keys, tokens, or private credentials in ontology files.
- Keep blocks portable: phrase them so any MCP client benefits, not just one tool.
- Every competency question in `cq.md` is a promise that some source file answers
  it. Keep them honest as the ontology grows.
