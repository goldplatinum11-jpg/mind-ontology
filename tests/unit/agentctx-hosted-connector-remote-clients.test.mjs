import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { createConnector } from "../../connector/worker/lib/index.mjs";
import { TOOLS } from "../../connector/worker/lib/mcp.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = JSON.parse(
  readFileSync(resolve(REPO_ROOT, "tests/fixtures/mcp-remote-client-sessions.json"), "utf8"),
);
const TOOL_NAMES = ["get_context", "list_constraints"];

function post(connector, message, headers) {
  return connector.fetch(
    new Request("https://connector.test/mcp", {
      method: "POST",
      body: JSON.stringify(message),
      headers: headers ?? {},
    }),
  );
}

describe("hosted connector — realistic remote client sessions (Phase 9)", () => {
  const connector = createConnector(FIXTURE.snapshot, {});

  for (const client of FIXTURE.clients) {
    it(`replays a ${client.client} (${client.transport}) session end-to-end`, async () => {
      for (const step of client.session) {
        const headers = { ...client.defaultHeaders, ...(step.headers ?? {}) };
        const res = await post(connector, step.request, headers);
        const e = step.expect;
        expect(res.status, `${client.client}/${step.name}: status`).toBe(e.status);

        const text = await res.text();
        if (e.bodyEmpty) {
          expect(text.trim(), `${client.client}/${step.name}: empty body`).toBe("");
          continue;
        }
        const body = JSON.parse(text);
        if ("json.result.protocolVersion" in e) expect(body.result.protocolVersion).toBe(e["json.result.protocolVersion"]);
        if ("json.result.serverInfo.name" in e) expect(body.result.serverInfo.name).toBe(e["json.result.serverInfo.name"]);
        if (e.toolNames) expect(body.result.tools.map((t) => t.name)).toEqual(e.toolNames);
        if ("contentJson.task" in e) expect(JSON.parse(body.result.content[0].text).task).toBe(e["contentJson.task"]);
        if (e.contentIncludes) expect(body.result.content[0].text).toContain(e.contentIncludes);
      }
    });
  }

  it("accepts both Accept header variants used by hosted clients (D50)", async () => {
    const init = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } };
    for (const accept of ["application/json", "application/json, text/event-stream"]) {
      const res = await post(connector, init, { accept, "content-type": "application/json" });
      expect(res.status, `Accept: ${accept}`).toBe(200);
    }
  });

  it("auth: correct fake bearer passes, wrong fake bearer is 401 (D49)", async () => {
    const FAKE = "fake-bearer-for-remote-client-tests";
    const guarded = createConnector(FIXTURE.snapshot, { CONNECTOR_BEARER_TOKEN: FAKE });
    const init = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } };

    const wrong = await post(guarded, init, { authorization: "Bearer nope", "content-type": "application/json" });
    expect(wrong.status).toBe(401);

    const ok = await post(guarded, init, { authorization: `Bearer ${FAKE}`, "content-type": "application/json" });
    expect(ok.status).toBe(200);
  });

  it("tool-name / schema drift guard: tools/list still matches the implemented TOOLS (D51)", async () => {
    const res = await post(connector, { jsonrpc: "2.0", id: 1, method: "tools/list" });
    const tools = (await res.json()).result.tools;

    // Names are exactly the two read-only tools — every connector manifest pins these.
    expect(tools.map((t) => t.name)).toEqual(TOOL_NAMES);
    // The wire tools are the implemented TOOLS verbatim (drift here means a client
    // contract changed without the fixtures/manifests catching it).
    expect(tools).toEqual(TOOLS);

    const gc = tools.find((t) => t.name === "get_context");
    expect(gc.inputSchema.required).toEqual(["task"]);
    expect(gc.inputSchema.properties.format.enum).toEqual(["markdown", "json"]);
    const lc = tools.find((t) => t.name === "list_constraints");
    expect(lc.inputSchema.properties.format.enum).toEqual(["markdown", "json"]);
  });

  it("the remote-client fixture leaks no real endpoint or credential", () => {
    const raw = readFileSync(resolve(REPO_ROOT, "tests/fixtures/mcp-remote-client-sessions.json"), "utf8");
    expect(raw).not.toMatch(/https:\/\/[a-z0-9.-]+\.(workers\.dev|com|net|org|io)\//i);
    expect(raw).not.toMatch(/bearer\s+[A-Za-z0-9._-]{12,}/i);
  });
});
