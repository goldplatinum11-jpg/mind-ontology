import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_TARGET_IDS,
  EMIT_TARGETS,
  SUPPORTED_TARGET_IDS,
} from "../../scripts/agentctx/emit.mjs";

// The W1 guard (W2 §13 item 15): the spec's target-registry table in
// docs/workbench-w1-emit-target-spec.md §2 is normative; the engine's
// EMIT_TARGETS constant must stay in sync with it — ids, artifact paths, and
// the two independent capability flags (supported / default). A drift here
// means either the spec or the engine was changed unilaterally.

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SPEC_PATH = resolve(REPO_ROOT, "docs/workbench-w1-emit-target-spec.md");

function specRegistryRows() {
  const spec = readFileSync(SPEC_PATH, "utf8");
  const section = spec.split("## 2. Target registry")[1]?.split("\n## ")[0] ?? "";
  // | `id` | `path` | consumer | supported | default |
  const ROW = /^\| `([a-z-]+)` \| `([^`]+)` \| [^|]+ \| ([^|]+) \| ([^|]+) \|$/;
  return section
    .split("\n")
    .map((line) => ROW.exec(line.trim()))
    .filter(Boolean)
    .map((m) => ({
      id: m[1],
      path: m[2],
      supported: m[3].includes("**yes**"),
      default: m[4].includes("**yes**"),
    }));
}

describe("emit target registry stays in sync with the W1 spec table (W1 guard)", () => {
  const rows = specRegistryRows();

  it("the spec table parses and covers all four registered targets", () => {
    expect(rows.length, "W1 §2 table rows should parse").toBe(4);
    expect(rows.map((r) => r.id)).toEqual(Object.keys(EMIT_TARGETS));
  });

  it("every artifact path matches the engine registry", () => {
    for (const row of rows) {
      expect(EMIT_TARGETS[row.id]?.path, row.id).toBe(row.path);
    }
  });

  it("the supported flag matches the spec table (agents-md, claude-md, cursor)", () => {
    for (const row of rows) {
      expect(EMIT_TARGETS[row.id]?.supported, row.id).toBe(row.supported);
    }
    expect(SUPPORTED_TARGET_IDS).toEqual(["agents-md", "claude-md", "cursor"]);
  });

  it("the default flag matches: agents-md and claude-md only", () => {
    for (const row of rows) {
      expect(EMIT_TARGETS[row.id]?.default, row.id).toBe(row.default);
    }
    expect(DEFAULT_TARGET_IDS).toEqual(["agents-md", "claude-md"]);
  });

  it("cursor is supported-but-not-default; paste-block stays unsupported and non-default", () => {
    // cursor promoted to supported (Lane 2) but never added to the default set.
    expect(EMIT_TARGETS.cursor?.supported).toBe(true);
    expect(EMIT_TARGETS.cursor?.default).toBe(false);
    expect(SUPPORTED_TARGET_IDS).toContain("cursor");
    expect(DEFAULT_TARGET_IDS).not.toContain("cursor");
    // paste-block: still a reserved future target until its own fast-follow lane.
    expect(EMIT_TARGETS["paste-block"]?.supported).toBe(false);
    expect(EMIT_TARGETS["paste-block"]?.default).toBe(false);
    expect(SUPPORTED_TARGET_IDS).not.toContain("paste-block");
    expect(DEFAULT_TARGET_IDS).not.toContain("paste-block");
  });

  it("default is always a subset of supported (a target cannot default-emit without being buildable)", () => {
    const supported = new Set(SUPPORTED_TARGET_IDS);
    for (const id of DEFAULT_TARGET_IDS) {
      expect(supported.has(id), `${id} is default but not supported`).toBe(true);
    }
    // Same invariant straight off the registry flags (engine-side, no spec parse).
    for (const [id, spec] of Object.entries(EMIT_TARGETS)) {
      if (spec.default) expect(spec.supported, `${id}: default implies supported`).toBe(true);
    }
  });

  it("derived id lists are in registry order", () => {
    const order = Object.keys(EMIT_TARGETS);
    const inOrder = (ids) => [...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    expect(SUPPORTED_TARGET_IDS).toEqual(inOrder(SUPPORTED_TARGET_IDS));
    expect(DEFAULT_TARGET_IDS).toEqual(inOrder(DEFAULT_TARGET_IDS));
  });

  it("target ids are kebab-case and paths are cwd-relative (registry rules)", () => {
    for (const [id, spec] of Object.entries(EMIT_TARGETS)) {
      expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(spec.path).not.toMatch(/^([A-Za-z]:|\/|\\)/); // no absolute paths
    }
  });
});
