import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { createConnector } from "../../connector/worker/lib/index.mjs";
import { authHeaders, joinUrl, runRemoteSmoke } from "../../connector/worker/scripts/smoke-remote.mjs";

// The remote smoke (connector/worker/scripts/smoke-remote.mjs) drives a DEPLOYED
// connector over real HTTP. There is no deployed endpoint in this repo, so these
// tests exercise it in its mockable mode: an in-process `fetch` shim over the
// bundled example snapshot. They prove (a) request construction — method, path,
// JSON-RPC envelope, bearer header — is correct, and (b) the check sequence
// passes against the real connector logic and flags the auth gate.

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SCRIPT = "connector/worker/scripts/smoke-remote.mjs";
const snapshot = JSON.parse(
  readFileSync(resolve(REPO_ROOT, "connector/worker/agentctx.snapshot.example.json"), "utf8"),
);

// Wrap a connector as a global-fetch-shaped impl, recording every request so the
// tests can assert exactly what the smoke put on the wire.
function recordingFetch(connector) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return connector.fetch(new Request(url, init));
  };
  return { impl, calls };
}

describe("remote smoke — pure helpers", () => {
  it("joinUrl normalizes the slash between base and path", () => {
    expect(joinUrl("https://h.example", "/mcp")).toBe("https://h.example/mcp");
    expect(joinUrl("https://h.example/", "/mcp")).toBe("https://h.example/mcp");
    expect(joinUrl("https://h.example///", "mcp")).toBe("https://h.example/mcp");
  });

  it("authHeaders emits a Bearer header only when a token is given", () => {
    expect(authHeaders("abc")).toEqual({ authorization: "Bearer abc" });
    expect(authHeaders(null)).toEqual({});
    expect(authHeaders("")).toEqual({});
  });

  it("runRemoteSmoke requires fetchImpl and baseUrl", async () => {
    await expect(runRemoteSmoke({ baseUrl: "https://x" })).rejects.toThrow(/fetchImpl/);
    await expect(runRemoteSmoke({ fetchImpl: () => {} })).rejects.toThrow(/baseUrl/);
  });
});

describe("remote smoke — request construction (public mode)", () => {
  it("issues exactly the documented HTTP calls with correct envelopes", async () => {
    const { impl, calls } = recordingFetch(createConnector(snapshot, {}));
    const { passed, total } = await runRemoteSmoke({ fetchImpl: impl, baseUrl: "https://host.example/", token: null });

    expect(passed).toBe(total);
    expect(total).toBe(5); // no auth check without a token

    // every URL is absolute, joined under the given base, and hits a known route
    for (const c of calls) expect(c.url.startsWith("https://host.example/")).toBe(true);
    const paths = calls.map((c) => new URL(c.url).pathname);
    expect(paths[0]).toBe("/health");
    expect(paths.filter((p) => p === "/mcp").length).toBeGreaterThanOrEqual(4);

    // health is a GET; never carries a bearer in public mode
    expect(calls[0].init.method).toBe("GET");
    for (const c of calls) expect(c.init.headers?.authorization).toBeUndefined();

    // every /mcp call is a POST carrying a well-formed JSON-RPC 2.0 request
    for (const c of calls.filter((x) => new URL(x.url).pathname === "/mcp")) {
      expect(c.init.method).toBe("POST");
      expect(c.init.headers["content-type"]).toMatch(/application\/json/);
      const msg = JSON.parse(c.init.body);
      expect(msg.jsonrpc).toBe("2.0");
      expect(typeof msg.method).toBe("string");
      expect(msg.id).toBeDefined();
    }

    // the two get_context calls (determinism probe) target the same task
    const getCtx = calls
      .filter((x) => new URL(x.url).pathname === "/mcp")
      .map((x) => JSON.parse(x.init.body))
      .filter((m) => m.method === "tools/call" && m.params?.name === "get_context");
    expect(getCtx.length).toBe(2);
    expect(getCtx[0].params.arguments.task).toBe(getCtx[1].params.arguments.task);
  });
});

describe("remote smoke — authenticated mode", () => {
  const TOKEN = "fixture-token-not-a-real-secret";

  it("attaches the bearer to authed calls and the 401 probe omits it", async () => {
    const { impl, calls } = recordingFetch(createConnector(snapshot, { CONNECTOR_BEARER_TOKEN: TOKEN }));
    const { passed, total } = await runRemoteSmoke({ fetchImpl: impl, baseUrl: "https://host.example", token: TOKEN });

    expect(passed).toBe(total);
    expect(total).toBe(6); // includes the 401 probe

    const mcpCalls = calls.filter((c) => new URL(c.url).pathname === "/mcp");
    const authed = mcpCalls.filter((c) => c.init.headers?.authorization === `Bearer ${TOKEN}`);
    const unauthed = mcpCalls.filter((c) => c.init.headers?.authorization === undefined);
    expect(authed.length).toBeGreaterThanOrEqual(4); // initialize, tools/list, 2x get_context, list_constraints
    expect(unauthed.length).toBe(1); // exactly one deliberate no-bearer probe
  });

  it("fails the auth check when the connector does NOT actually enforce the token", async () => {
    // Smoke claims a token is configured, but the connector is unguarded — the 401
    // probe will get a 200, so the auth check must FAIL. Guards against a false
    // "connected" when the bearer gate was never wired up.
    const { impl } = recordingFetch(createConnector(snapshot, {}));
    const { checks } = await runRemoteSmoke({ fetchImpl: impl, baseUrl: "https://host.example", token: "claims-a-token" });
    const authCheck = checks.find((c) => /401/.test(c.name));
    expect(authCheck?.ok).toBe(false);
  });
});

describe("remote smoke — no committed secret / endpoint", () => {
  it("the script embeds no real host or bearer value", () => {
    const raw = readFileSync(resolve(REPO_ROOT, SCRIPT), "utf8");
    expect(raw).not.toMatch(/[a-z0-9-]+\.workers\.dev/i);
    expect(raw).not.toMatch(/bearer\s+[A-Za-z0-9._-]{20,}/i);
  });
});
