#!/usr/bin/env node
// Remote Worker smoke — verifies a DEPLOYED connector over real HTTP.
//
// Unlike smoke-local.mjs (which runs the fetch handler in-process), this drives
// a live endpoint with the platform `fetch`, so it proves the connector is
// reachable and correct *as deployed* — the step that turns "remote-ready" into
// "actually remote".
//
//   node connector/worker/scripts/smoke-remote.mjs --url https://<your-host>
//   node connector/worker/scripts/smoke-remote.mjs --url https://<your-host> --token "$TOK"
//   node connector/worker/scripts/smoke-remote.mjs --dry-run     # no network
//
// URL / token also read from env: CONNECTOR_URL (or CONNECTOR_BASE_URL) and
// CONNECTOR_BEARER_TOKEN. The token is NEVER printed — only "<set>" / "<none>".
//
// Modes (decided by whether a token is present):
//   public        — no token: positive checks run unauthenticated.
//   authenticated — token set: positive checks carry the bearer, AND an
//                   unauthenticated /mcp must come back 401.
// `--require-auth` fails fast if it is set but no token was supplied.
//
// `--dry-run` (or no URL) runs the exact same check sequence against an in-process
// connector over the bundled example snapshot — both a public and a guarded pass —
// so the script is self-testing and CI-runnable with no network, no deploy, and
// no real credential. Exits 0 if every check passes, 1 otherwise.

// ---- pure, importable core (unit-tested without network) -------------------

// Join a base URL and a path without doubling or dropping the slash.
export function joinUrl(baseUrl, path) {
  return `${String(baseUrl).replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

// The only auth header this connector understands: `Authorization: Bearer <token>`.
export function authHeaders(token) {
  return token ? { authorization: `Bearer ${token}` } : {};
}

// Run the full remote-smoke check sequence against `fetchImpl` (signature mirrors
// global fetch: (url, init) => Promise<Response>). Returns { checks, passed, total }.
// Pure w.r.t. transport: pass a real fetch for a live host, or an in-process shim
// for dry-run/tests. Never throws on a failed check — it records and continues.
export async function runRemoteSmoke({ fetchImpl, baseUrl, token = null, onCheck } = {}) {
  if (typeof fetchImpl !== "function") throw new Error("runRemoteSmoke: fetchImpl is required");
  if (!baseUrl) throw new Error("runRemoteSmoke: baseUrl is required");

  const checks = [];
  function check(name, ok, detail) {
    const entry = { name, ok: !!ok, detail: ok ? undefined : detail };
    checks.push(entry);
    onCheck?.(entry);
  }

  // One HTTP call. `withAuth` controls whether the bearer (if any) is attached —
  // the 401 probe deliberately sends none.
  async function call(method, path, { body, withAuth = true } = {}) {
    const headers = {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(withAuth ? authHeaders(token) : {}),
    };
    const init = { method, headers };
    if (body !== undefined) init.body = JSON.stringify(body);
    const res = await fetchImpl(joinUrl(baseUrl, path), init);
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON body (e.g. 202 empty) */
    }
    return { status: res.status, json, text };
  }

  const mcp = (id, method, params) => call("POST", "/mcp", { body: { jsonrpc: "2.0", id, method, params } });

  // 1) liveness
  const health = await call("GET", "/health", { withAuth: false });
  check("GET /health -> 200 ok", health.status === 200 && health.json?.ok === true, JSON.stringify(health.json));

  // 2) MCP initialize negotiates a protocol version and identifies the server
  const init = await mcp(1, "initialize", {});
  check(
    "POST /mcp initialize -> serverInfo agentctx + protocolVersion",
    init.status === 200 &&
      init.json?.result?.serverInfo?.name === "agentctx" &&
      typeof init.json?.result?.protocolVersion === "string",
    JSON.stringify(init.json),
  );

  // 3) the two read-only tools are exported
  const list = await mcp(2, "tools/list");
  const names = (list.json?.result?.tools ?? []).map((t) => t.name);
  check(
    "POST /mcp tools/list -> exports get_context + list_constraints",
    list.status === 200 && names.includes("get_context") && names.includes("list_constraints"),
    JSON.stringify(names),
  );

  // 4) get_context returns content — and is DETERMINISTIC: the same task compiles
  //    the same selected context twice. The pack carries one clock-driven line
  //    (`Generated: <ISO>`), which we strip before comparing — everything that the
  //    selection produces must be byte-identical run to run.
  const stripClock = (s) => (typeof s === "string" ? s.replace(/^Generated: .*$/m, "Generated: <ts>") : s);
  const TASK = "remote smoke: deterministic context check";
  const c1 = await mcp(3, "tools/call", { name: "get_context", arguments: { task: TASK } });
  const c2 = await mcp(4, "tools/call", { name: "get_context", arguments: { task: TASK } });
  const t1 = c1.json?.result?.content?.[0]?.text;
  const t2 = c2.json?.result?.content?.[0]?.text;
  const deterministic = stripClock(t1) === stripClock(t2);
  check(
    "POST /mcp tools/call get_context -> deterministic non-empty context",
    c1.status === 200 &&
      c1.json?.result?.content?.[0]?.type === "text" &&
      typeof t1 === "string" &&
      t1.length > 0 &&
      deterministic,
    `len=${t1?.length ?? 0} deterministic=${deterministic}`,
  );

  // 5) list_constraints returns the constraint blocks
  const lc = await mcp(5, "tools/call", { name: "list_constraints" });
  const lcText = lc.json?.result?.content?.[0]?.text;
  check(
    "POST /mcp tools/call list_constraints -> constraints",
    lc.status === 200 && typeof lcText === "string" && /constraint/i.test(lcText),
    JSON.stringify(lc.json).slice(0, 120),
  );

  // 6) auth: only meaningful when a token is configured. An unauthenticated /mcp
  //    must be rejected with 401 — proof the bearer gate is actually live.
  if (token) {
    const unauth = await call("POST", "/mcp", { body: { jsonrpc: "2.0", id: 6, method: "initialize", params: {} }, withAuth: false });
    check("POST /mcp without bearer -> 401 (token configured)", unauth.status === 401, String(unauth.status));
  }

  const passed = checks.filter((c) => c.ok).length;
  return { checks, passed, total: checks.length };
}

// ---- CLI -------------------------------------------------------------------

function parseArgs(argv) {
  const out = { url: null, token: null, requireAuth: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url" || a === "--base-url") out.url = argv[++i];
    else if (a === "--token") out.token = argv[++i];
    else if (a === "--require-auth") out.requireAuth = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

const HELP = `Remote connector smoke

Usage:
  node scripts/smoke-remote.mjs --url https://<host> [--token <bearer>] [--require-auth]
  node scripts/smoke-remote.mjs --dry-run

Env: CONNECTOR_URL | CONNECTOR_BASE_URL, CONNECTOR_BEARER_TOKEN
The token value is never printed. Without --url (or --dry-run) the script runs an
in-process dry run over the bundled example snapshot — no network, no deploy.`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    process.exit(0);
  }

  const url = args.url || process.env.CONNECTOR_URL || process.env.CONNECTOR_BASE_URL || null;
  const token = args.token || process.env.CONNECTOR_BEARER_TOKEN || null;

  const printResult = ({ checks, passed, total }) => {
    for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.ok ? "" : ` — ${c.detail}`}`);
    console.log(`\n${passed}/${total} checks passed`);
    return passed === total;
  };

  // Dry run (explicit, or no URL): in-process over the example snapshot. We can
  // only import the connector lazily here so a real-host run stays dependency-free.
  if (args.dryRun || !url) {
    if (args.requireAuth) {
      console.error("--require-auth has no effect in dry-run (the fixture token is synthetic). Aborting.");
      process.exit(2);
    }
    if (!url) console.log("No --url / CONNECTOR_URL given -> in-process dry run (no network).\n");
    const { createConnector } = await import("../lib/index.mjs");
    const { default: snapshot } = await import("../agentctx.snapshot.example.json", { with: { type: "json" } });
    const inproc = (connector) => (u, init) => connector.fetch(new Request(u, init));
    const FAKE = "dry-run-fixture-token-not-a-real-secret";

    console.log("--- dry run: public mode (no token) ---");
    const pub = printResult(
      await runRemoteSmoke({ fetchImpl: inproc(createConnector(snapshot, {})), baseUrl: "https://dry-run.local", token: null }),
    );

    console.log("\n--- dry run: authenticated mode (synthetic token) ---");
    const guarded = printResult(
      await runRemoteSmoke({
        fetchImpl: inproc(createConnector(snapshot, { CONNECTOR_BEARER_TOKEN: FAKE })),
        baseUrl: "https://dry-run.local",
        token: FAKE,
      }),
    );

    process.exit(pub && guarded ? 0 : 1);
  }

  if (args.requireAuth && !token) {
    console.error("--require-auth set but no token supplied (--token or CONNECTOR_BEARER_TOKEN). Aborting.");
    process.exit(2);
  }

  console.log(`Remote smoke -> ${url}`);
  console.log(`Mode: ${token ? "authenticated" : "public"}   token: ${token ? "<set>" : "<none>"}\n`);
  const result = await runRemoteSmoke({ fetchImpl: fetch, baseUrl: url, token });
  process.exit(printResult(result) ? 0 : 1);
}

// Run as a CLI only when invoked directly, not when imported by tests.
import { argv } from "node:process";
import { pathToFileURL } from "node:url";
if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) {
  main().catch((err) => {
    console.error(`smoke-remote failed: ${err?.stack || err}`);
    process.exit(1);
  });
}
