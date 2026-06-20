#!/usr/bin/env node
// Local Worker smoke — runs the connector's fetch handler in Node against the
// bundled example snapshot, WITHOUT Cloudflare / wrangler / any deploy / network.
// Lets an operator verify the connector responds correctly before deploying.
//
//   node connector/worker/scripts/smoke-local.mjs
//
// Exits 0 if every check passes, 1 otherwise. No network, no credential, no deploy.

import { createConnector } from "../lib/index.mjs";
import snapshot from "../agentctx.snapshot.example.json" with { type: "json" };

const connector = createConnector(snapshot, {});

async function call(method, path, body, headers) {
  const init = { method, headers: headers ?? {} };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await connector.fetch(new Request(`https://smoke.local${path}`, init));
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body (e.g. 202 empty) */
  }
  return { status: res.status, json, text };
}

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: !!ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
}

const health = await call("GET", "/health");
check("GET /health -> 200 ok", health.status === 200 && health.json?.ok === true, JSON.stringify(health.json));

const init = await call("POST", "/mcp", { jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
check(
  "POST /mcp initialize -> serverInfo agentctx",
  init.status === 200 && init.json?.result?.serverInfo?.name === "agentctx" && !!init.json?.result?.protocolVersion,
  JSON.stringify(init.json),
);

const list = await call("POST", "/mcp", { jsonrpc: "2.0", id: 2, method: "tools/list" });
const names = (list.json?.result?.tools ?? []).map((t) => t.name);
check(
  "POST /mcp tools/list -> [get_context, list_constraints]",
  JSON.stringify(names) === JSON.stringify(["get_context", "list_constraints"]),
  JSON.stringify(names),
);

const callTool = await call("POST", "/mcp", {
  jsonrpc: "2.0",
  id: 3,
  method: "tools/call",
  params: { name: "get_context", arguments: { task: "smoke check" } },
});
check(
  "POST /mcp tools/call get_context -> content text",
  callTool.json?.result?.content?.[0]?.type === "text" && !!callTool.json?.result?.content?.[0]?.text,
  JSON.stringify(callTool.json).slice(0, 120),
);

const http = await call("POST", "/get_context", { task: "smoke check" });
check(
  "POST /get_context (GPT Action) -> ContextPack JSON",
  http.status === 200 && http.json?.task === "smoke check" && http.json?.content === undefined,
  JSON.stringify(http.json).slice(0, 120),
);

const notFound = await call("GET", "/nope");
check("unknown route -> 404", notFound.status === 404, String(notFound.status));

const passed = checks.filter((c) => c.ok).length;
console.log(`\n${passed}/${checks.length} checks passed`);
process.exit(passed === checks.length ? 0 : 1);
