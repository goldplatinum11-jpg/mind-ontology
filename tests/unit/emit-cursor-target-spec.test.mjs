import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_TARGET_IDS,
  EMIT_TARGETS,
} from "../../scripts/agentctx/emit.mjs";

// Lane 1 spec-pin (cursor target). The cursor `.mdc` byte format is locked in
// docs/workbench-w1-emit-target-spec.md §13 ahead of engine support so the
// Lane 2 implementation cannot guess. These assertions pin the normative shape
// the golden/engine tests will enforce once cursor is supported. They are
// durable across lanes: every assertion holds while cursor is unsupported
// (Lane 1) and after it is promoted (Lane 2+) — none of them touch the
// `supported` flag, which the registry-sync guard owns.

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const W1 = readFileSync(
  resolve(REPO_ROOT, "docs/workbench-w1-emit-target-spec.md"),
  "utf8",
).replace(/\r\n/g, "\n");

// The exact frontmatter prelude bytes the spec locks (§13.3). buildArtifact in
// Lane 2 must emit these bytes verbatim before the emit header.
const EXPECTED_FRONTMATTER = [
  "---",
  "description: Mind Ontology generated project rules",
  'globs: "**/*"',
  "alwaysApply: false",
  "---",
].join("\n");

function cursorSection() {
  // §13 runs from its heading to EOF (it is the last section).
  const idx = W1.indexOf("## 13. Cursor target (`.mdc`) output specification");
  expect(idx, "W1 §13 cursor spec section is present").toBeGreaterThan(-1);
  return W1.slice(idx);
}

function firstTextFence(section) {
  const open = section.indexOf("```text");
  const start = section.indexOf("\n", open) + 1;
  const end = section.indexOf("```", start);
  return section.slice(start, end).replace(/\n$/, "");
}

describe("cursor target spec is decision-complete (Lane 1 pin)", () => {
  it("registry reserves the cursor path and never defaults it", () => {
    expect(EMIT_TARGETS.cursor?.path).toBe(".cursor/rules/mind-ontology.mdc");
    expect(DEFAULT_TARGET_IDS).not.toContain("cursor");
    // Title-less target: the body has no `# <title>` first heading (§13.4).
    expect(EMIT_TARGETS.cursor?.title).toBeNull();
  });

  it("§13.3 locks the exact three-field Cursor frontmatter prelude", () => {
    const fence = firstTextFence(cursorSection());
    expect(fence).toBe(EXPECTED_FRONTMATTER);
  });

  it("§13.3 documents the field rules and fixed order", () => {
    const section = cursorSection();
    expect(section).toContain("Field order is fixed");
    // globs is quoted because `**/*` starts with a YAML indicator char.
    expect(section).toContain('`globs: "**/*"` — double-quoted');
    expect(section).toContain("`alwaysApply: false` — unquoted YAML boolean");
  });

  it("§13 documents header-after-prelude, determinism, and drift-checkability", () => {
    const section = cursorSection();
    expect(section).toContain("separating it from the emit header's first line");
    expect(section).toContain("fixed engine constant");
    // Prelude excluded from both digests but caught by the byte comparison.
    expect(section).toContain("not** part of `content_digest`");
    expect(section).toContain("re-flags the artifact `STALE`");
    // Title-less handling is spelled out so buildArtifact emits no literal null.
    expect(section).toContain("no literal `null` and no blank first heading");
  });

  it("§6 scopes the prelude tolerance to cursor only (byte-0 strict otherwise)", () => {
    expect(W1).toContain("Target-specific prelude (header position)");
    expect(W1).toContain("tolerates this recognized prelude **for `cursor`\nonly**");
    expect(W1).toContain(
      "AGENTS.md, CLAUDE.md, and the paste-block target keep the strict byte-0\nrule",
    );
  });
});
