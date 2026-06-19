import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { SOURCE_FILES } from "../../scripts/agentctx/compile.mjs";
import {
  SNAPSHOT_SCHEMA,
  buildSnapshot,
  loadSnapshot,
} from "../../connector/worker/lib/source-snapshot.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const EXAMPLE = resolve(REPO_ROOT, "connector/worker/agentctx.snapshot.example.json");

describe("hosted connector snapshot adapter (PR1)", () => {
  it("buildSnapshot carries every SOURCE_FILES slot, defaulting absent ones to ''", () => {
    const snap = buildSnapshot({ "constraints.md": "## C #x\nbody\n", "identity.md": undefined });
    expect(snap.schema).toBe(SNAPSHOT_SCHEMA);
    expect(Object.keys(snap.sources).sort()).toEqual([...SOURCE_FILES].sort());
    expect(snap.sources["constraints.md"]).toContain("## C #x");
    // Absent / non-string inputs normalize to "" — same as readAgentctx for a missing file.
    expect(snap.sources["identity.md"]).toBe("");
  });

  it("loadSnapshot returns the sources map for a valid snapshot", () => {
    const snap = buildSnapshot({ "constraints.md": "## Keep it portable #core\nbody\n" });
    const sources = loadSnapshot(snap);
    expect(sources["constraints.md"]).toContain("Keep it portable");
  });

  it("loadSnapshot rejects a wrong schema", () => {
    expect(() => loadSnapshot({ schema: "nope", sources: { "constraints.md": "x" } })).toThrow(
      /schema must be/,
    );
  });

  it("loadSnapshot rejects a missing or empty required source (constraints.md)", () => {
    expect(() => loadSnapshot({ schema: SNAPSHOT_SCHEMA, sources: {} })).toThrow(
      /missing required source: constraints\.md/,
    );
    expect(() =>
      loadSnapshot({ schema: SNAPSHOT_SCHEMA, sources: { "constraints.md": "   " } }),
    ).toThrow(/missing required source: constraints\.md/);
  });

  it("loadSnapshot rejects a non-object snapshot", () => {
    expect(() => loadSnapshot(null)).toThrow(/must be an object/);
    expect(() => loadSnapshot({ schema: SNAPSHOT_SCHEMA, sources: 5 })).toThrow(/sources must be/);
  });

  it("ships a valid example snapshot built from a real .agentctx/", () => {
    expect(existsSync(EXAMPLE)).toBe(true);
    const snap = JSON.parse(readFileSync(EXAMPLE, "utf8"));
    expect(snap.schema).toBe(SNAPSHOT_SCHEMA);
    expect(Object.keys(snap.sources).sort()).toEqual([...SOURCE_FILES].sort());
    // Loads cleanly (so it would actually serve), and constraints.md is real.
    const sources = loadSnapshot(snap);
    expect(sources["constraints.md"].trim().length).toBeGreaterThan(0);
  });

  it("the example snapshot leaks no secret or real endpoint", () => {
    const raw = readFileSync(EXAMPLE, "utf8");
    expect(raw).not.toMatch(/bearer\s+[A-Za-z0-9._-]{12,}/i);
    expect(raw).not.toMatch(/https:\/\/[a-z0-9.-]+\.(workers\.dev|com)\//i);
    expect(raw).not.toMatch(/\b(api[_-]?key|secret|token)\b\s*[:=]\s*["'][^"']+["']/i);
  });
});
