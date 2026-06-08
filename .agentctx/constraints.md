# Constraints

## No SIRT dependency in core #sirt #oss #core

The core compiler must work without SIRT, Obsidian, cloud services, or private
connectors. SIRT is allowed only as an optional adapter after v0.

## No UI in v0 #ui #scope

Do not build Map, Direction, Tensions, Seeds, or patch review tabs for the first
version. The CLI output is the product test.

## Product naming boundary #mind-ontology #agentctx #positioning

Use Mind Ontology as the product surface and agentctx as the internal compiler
name. Do not make external positioning depend on the implementation label
`agentctx`; it is too opaque for product adoption.

## Open-core boundary #oss #sirt #commercial

OSS may include the MCP server, ontology schema, Markdown source layout, and
context-pack compiler. Do not open-source the hosted SIRT backend value layer as
part of Mind Ontology v0.

Hosted SIRT owns durable memory, graph storage, vector retrieval, writeback,
typed edges, cross-agent persistence, and autonomous control-plane behavior.
Self-hosted OSS users run the MCP layer in their own environment and pay their
own infrastructure costs.

## Avoid context false-negatives #selection #safety

Never silently drop global constraints. `constraints.md` is always included in
compiled context packs.

## No graph database or custom vector store #architecture #scope

Do not add a graph database, custom embedding store, or general ontology
framework for v0. Selection should start with deterministic Markdown chunking
and lightweight lexical scoring.

