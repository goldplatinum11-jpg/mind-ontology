/**
 * harvest-sirt.test.mjs — Regression tests for Campaign C SIRT Adapter.
 *
 * Covers: SIRT client construction, listNodes HTTP mechanics, node→candidate
 * conversion, and import-sirt CLI surface.
 *
 * All SIRT API calls are replaced with a mock fetch; no real network contact.
 */

import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

import {
  createSirtClient,
  DEFAULT_BASE_URL,
  parseSirtNode,
  parseSirtNodes,
} from "../../scripts/agentctx/harvest-sirt.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = resolve(REPO_ROOT, "scripts/agentctx/cli.mjs");

// ---------------------------------------------------------------------------
// Temp directory helpers
// ---------------------------------------------------------------------------

const tempDirs = [];
afterEach(() => {
  while (tempDirs.length) rmSync(tempDirs.pop(), { recursive: true, force: true });
});

function tempProject() {
  const dir = mkdtempSync(join(tmpdir(), "mo-sirt-"));
  tempDirs.push(dir);
  mkdirSync(join(dir, ".agentctx"));
  return dir;
}

// ---------------------------------------------------------------------------
// Mock fetch helpers
// ---------------------------------------------------------------------------

/** Build a minimal MCP tool-call success response containing `payload`. */
function mcpOkResponse(payload) {
  return {
    jsonrpc: "2.0",
    id: "1",
    result: {
      content: [{ type: "text", text: JSON.stringify(payload) }],
    },
  };
}

/** Build a Response-like object that resolves to JSON. */
function mockFetchResponse(payload, status = 200) {
  return async (_url, _opts) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  });
}

// ---------------------------------------------------------------------------
// createSirtClient — construction
// ---------------------------------------------------------------------------

describe("createSirtClient construction", () => {
  it("throws when apiKey is empty string", () => {
    expect(() => createSirtClient("")).toThrow(/SIRT_API_KEY/);
  });

  it("throws when apiKey is undefined", () => {
    expect(() => createSirtClient(undefined)).toThrow(/SIRT_API_KEY/);
  });

  it("throws when fetch is not available (null fetch)", () => {
    expect(() => createSirtClient("valid-key", DEFAULT_BASE_URL, null)).toThrow(
      /fetch/i,
    );
  });

  it("returns an object with a listNodes function", () => {
    const client = createSirtClient("key", DEFAULT_BASE_URL, () => {});
    expect(typeof client.listNodes).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// createSirtClient.listNodes — HTTP mechanics
// ---------------------------------------------------------------------------

describe("createSirtClient.listNodes HTTP mechanics", () => {
  it("sends Authorization header with Bearer token", async () => {
    let capturedHeaders;
    const fakeFetch = async (_url, opts) => {
      capturedHeaders = opts.headers;
      return { ok: true, status: 200, json: async () => mcpOkResponse({ nodes: [] }) };
    };
    const client = createSirtClient("my-key", DEFAULT_BASE_URL, fakeFetch);
    await client.listNodes();
    expect(capturedHeaders?.Authorization).toBe("Bearer my-key");
  });

  it("sends a tools/call JSON-RPC body for sirt_nodes_list", async () => {
    let capturedBody;
    const fakeFetch = async (_url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 200, json: async () => mcpOkResponse({ nodes: [] }) };
    };
    const client = createSirtClient("key", DEFAULT_BASE_URL, fakeFetch);
    await client.listNodes({ limit: 25 });
    expect(capturedBody.method).toBe("tools/call");
    expect(capturedBody.params.name).toBe("sirt_nodes_list");
    expect(capturedBody.params.arguments.limit).toBe(25);
  });

  it("forwards optional query argument to the API", async () => {
    let capturedArgs;
    const fakeFetch = async (_url, opts) => {
      capturedArgs = JSON.parse(opts.body).params.arguments;
      return { ok: true, status: 200, json: async () => mcpOkResponse([]) };
    };
    const client = createSirtClient("key", DEFAULT_BASE_URL, fakeFetch);
    await client.listNodes({ query: "architecture" });
    expect(capturedArgs.query).toBe("architecture");
  });

  it("returns nodes array from wrapped MCP response { nodes: [...] }", async () => {
    const nodes = [{ node_id: "n1", summary: "Test decision." }];
    const client = createSirtClient(
      "key",
      DEFAULT_BASE_URL,
      mockFetchResponse(mcpOkResponse({ nodes })),
    );
    const result = await client.listNodes();
    expect(result).toEqual(nodes);
  });

  it("returns nodes from unwrapped array MCP response", async () => {
    const nodes = [{ node_id: "n2", summary: "Another node." }];
    const client = createSirtClient(
      "key",
      DEFAULT_BASE_URL,
      mockFetchResponse(mcpOkResponse(nodes)),
    );
    const result = await client.listNodes();
    expect(result).toEqual(nodes);
  });

  it("throws on 401 with a message mentioning authentication", async () => {
    const client = createSirtClient(
      "bad-key",
      DEFAULT_BASE_URL,
      mockFetchResponse({}, 401),
    );
    await expect(client.listNodes()).rejects.toThrow(/authentication failed/i);
  });

  it("throws on 403 with a message mentioning authentication", async () => {
    const client = createSirtClient(
      "bad-key",
      DEFAULT_BASE_URL,
      mockFetchResponse({}, 403),
    );
    await expect(client.listNodes()).rejects.toThrow(/authentication failed/i);
  });

  it("throws on non-ok status (500)", async () => {
    const client = createSirtClient(
      "key",
      DEFAULT_BASE_URL,
      mockFetchResponse({}, 500),
    );
    await expect(client.listNodes()).rejects.toThrow(/HTTP 500/);
  });

  it("throws on network error with descriptive message", async () => {
    const brokenFetch = async () => { throw new Error("ECONNREFUSED"); };
    const client = createSirtClient("key", DEFAULT_BASE_URL, brokenFetch);
    await expect(client.listNodes()).rejects.toThrow(/network error/i);
  });

  it("throws when MCP returns an error object", async () => {
    const errorResponse = {
      jsonrpc: "2.0",
      id: "1",
      error: { code: -32600, message: "Invalid request" },
    };
    const client = createSirtClient(
      "key",
      DEFAULT_BASE_URL,
      mockFetchResponse(errorResponse),
    );
    await expect(client.listNodes()).rejects.toThrow(/Invalid request/);
  });
});

// ---------------------------------------------------------------------------
// parseSirtNode — node → candidates conversion
// ---------------------------------------------------------------------------

describe("parseSirtNode", () => {
  it("splits body into sentence-level candidates (≥ 30 chars)", () => {
    const node = {
      node_id: "test-node-1",
      node_type: "decision",
      summary: "We chose ESM modules over CJS for this project.",
      body: "We chose ESM modules over CJS for this project. All internal scripts use .mjs extension.",
    };
    const { source, candidates } = parseSirtNode(node, "2026-06-16T00:00:00.000Z");
    expect(source.type).toBe("sirt-node");
    expect(source.id).toBe("sirt:test-node-1");
    expect(source.importedAt).toBe("2026-06-16T00:00:00.000Z");
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every(c => c.text.length >= 30)).toBe(true);
  });

  it("includes node_id in source ID", () => {
    const node = { node_id: "abc123", summary: "Something important about the system." };
    const { source } = parseSirtNode(node);
    expect(source.id).toBe("sirt:abc123");
  });

  it("falls back to node.id if node_id is missing", () => {
    const node = { id: "fallback-id", summary: "Something important about the system." };
    const { source } = parseSirtNode(node);
    expect(source.id).toBe("sirt:fallback-id");
  });

  it("returns empty candidates for a node with no body or summary", () => {
    const node = { node_id: "empty-node" };
    const { candidates } = parseSirtNode(node);
    expect(candidates).toEqual([]);
  });

  it("does not duplicate text when body === summary", () => {
    const text = "The deployment process must be fully automated without manual steps.";
    const node = { node_id: "dup", summary: text, body: text };
    const { candidates } = parseSirtNode(node);
    // Only one occurrence of the sentence
    expect(candidates.filter(c => c.text === text)).toHaveLength(1);
  });

  it("sets speakerRole to 'assistant' for all candidates", () => {
    const node = {
      node_id: "role-node",
      body: "We always use ESM. This is a firm constraint.",
    };
    const { candidates } = parseSirtNode(node);
    expect(candidates.every(c => c.speakerRole === "assistant")).toBe(true);
  });

  it("includes sourceId matching source.id on each candidate", () => {
    const node = {
      node_id: "link-check",
      body: "We always use ESM. This is a firm constraint.",
    };
    const { source, candidates } = parseSirtNode(node);
    expect(candidates.every(c => c.sourceId === source.id)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseSirtNodes
// ---------------------------------------------------------------------------

describe("parseSirtNodes", () => {
  it("maps each node to a { source, candidates } pair", () => {
    const nodes = [
      { node_id: "n1", summary: "We chose Node over Deno for the CLI runtime." },
      { node_id: "n2", summary: "TypeScript is the standard for new modules." },
    ];
    const result = parseSirtNodes(nodes);
    expect(result).toHaveLength(2);
    expect(result[0].source.id).toBe("sirt:n1");
    expect(result[1].source.id).toBe("sirt:n2");
  });

  it("returns empty array for non-array input", () => {
    expect(parseSirtNodes(null)).toEqual([]);
    expect(parseSirtNodes(undefined)).toEqual([]);
    expect(parseSirtNodes("oops")).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(parseSirtNodes([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// CLI surface — import-sirt registered in cli.mjs
// ---------------------------------------------------------------------------

describe("import-sirt CLI surface", () => {
  it("is listed in mind-ontology --help", () => {
    const result = spawnSync(process.execPath, [CLI, "--help"], { encoding: "utf8" });
    expect(result.stdout).toContain("import-sirt");
  });

  it("exits 1 with an error when SIRT_API_KEY is unset", () => {
    const dir = tempProject();
    const env = { ...process.env };
    delete env.SIRT_API_KEY;
    const result = spawnSync(
      process.execPath,
      [CLI, "import-sirt", "--cwd", dir, "--dry-run"],
      { encoding: "utf8", env },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("SIRT_API_KEY");
  });

  it("exits 1 with an error when .agentctx/ is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "mo-noagentctx-"));
    tempDirs.push(dir);
    const env = { ...process.env, SIRT_API_KEY: "fake-key" };
    const result = spawnSync(
      process.execPath,
      [CLI, "import-sirt", "--cwd", dir],
      { encoding: "utf8", env },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(".agentctx/");
  });
});
