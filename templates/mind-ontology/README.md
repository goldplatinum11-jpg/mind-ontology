# Mind Ontology `.agentctx/` Template

This template gives a new user a neutral starting point for Mind Ontology MCP.

Copy `.agentctx/` into the repo or folder where the local MCP server will run,
then edit the files to match your own direction, projects, vocabulary, and
constraints.

```text
templates/mind-ontology/.agentctx/
  constraints.md
  direction.md
  decisions.md
  architecture.md
  identity.md
  projects.md
  glossary.md
  agent-roles.md
  cq.md
```

The v0 compiler currently uses the core source files first. The additional
files document the intended schema expansion and can be adopted as compiler
support grows.

Do not put secrets or private credentials in ontology files.
