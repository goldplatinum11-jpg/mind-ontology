# Decisions

## Use one source for agent context #cross-agent #context #decision

Status: accepted
Date: YYYY-MM-DD

Maintain one `.agentctx/` source instead of separately rewriting the same
direction, vocabulary, and constraints for every AI tool.

Reason:

Separate instruction files drift. A single source lets every agent start from
the same meaning while still receiving task-specific context.

## Keep the free layer self-hosted #oss #self-host #decision

Status: accepted
Date: YYYY-MM-DD

The free Mind Ontology layer should work locally from Markdown files and a local
MCP server.

Reason:

Developers should be able to inspect and run the context layer they inject into
their AI agents without depending on a hosted service.
