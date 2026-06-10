import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EMIT_TARGETS, V1_TARGET_IDS } from "../../scripts/agentctx/emit.mjs";

// The W1 guard (W2 §13 item 15): the spec's target-registry table in
// docs/workbench-w1-emit-target-spec.md §2 is normative; the engine's
// EMIT_TARGETS constant must stay in sync with it — ids, artifact paths, and
// which targets are v1. A drift here means either the spec or the engine was
// changed unilaterally.

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SPEC_PATH = resolve(REPO_ROOT, "docs/workbench-w1-emit-target-spec.md");

function specRegistryRows() {
  const spec = readFileSync(SPEC_PATH, "utf8");
  const section = spec.split("## 2. Target registry")[1]?.split("\n## ")[0] ?? "";
  const ROW = /^\| `([a-z-]+)` \| `([^`]+)` \| [^|]+ \| ([^|]+) \|$/;
  return section
    .split("\n")
    .map((line) => ROW.exec(line.trim()))
    .filter(Boolean)
    .map((m) => ({ id: m[1], path: m[2], v1: m[3].includes("**v1**") }));
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

  it("the v1 flag matches: agents-md and claude-md only", () => {
    for (const row of rows) {
      expect(EMIT_TARGETS[row.id]?.v1, row.id).toBe(row.v1);
    }
    expect(V1_TARGET_IDS).toEqual(["agents-md", "claude-md"]);
  });

  it("target ids are kebab-case and paths are cwd-relative (registry rules)", () => {
    for (const [id, spec] of Object.entries(EMIT_TARGETS)) {
      expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(spec.path).not.toMatch(/^([A-Za-z]:|\/|\\)/); // no absolute paths
    }
  });
});
