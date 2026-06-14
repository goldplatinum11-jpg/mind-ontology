import { describe, expect, it } from "vitest";
import { compileContext, renderContextPackJson } from "../../scripts/agentctx/compile.mjs";

// Lane 5 — recency and aliases compose cleanly and deterministically. Aliases decide
// *whether/how strongly* a block matches (score); recency only breaks the remaining
// score ties. The two never fight: score is resolved first, recency second, index last.

const SOURCES = {
  "constraints.md": "# Constraints\n\n## Care #safety\n\nbe careful\n",
  "decisions.md":
    "# Decisions\n\n## Older session #session\n\n" +
    "Aliases: auth, authentication\nDate: 2026-01-01\n\nsigned cookie session\n\n" +
    "## Newer session #session\n\n" +
    "Aliases: auth, authentication\nDate: 2026-09-01\n\nsigned cookie session\n",
};

const titles = (opts) => {
  const p = JSON.parse(
    renderContextPackJson(
      compileContext({ sources: SOURCES, task: "auth", scopes: [], maxBlocksPerFile: 2, ...opts }),
    ),
  );
  return p.selected.filter((b) => b.file === "decisions.md").map((b) => b.title);
};

describe("--recency + --aliases combined (Lane 5)", () => {
  it("aliases surface both blocks; recency orders the score-tie newest-first", () => {
    expect(titles({ aliases: true, recency: true })).toEqual(["Newer session", "Older session"]);
  });

  it("aliases alone (no recency) keeps insertion order on the score tie", () => {
    expect(titles({ aliases: true })).toEqual(["Older session", "Newer session"]);
  });

  it("recency alone does not surface the alias-only blocks (auth never scores)", () => {
    // Without --aliases, task 'auth' only hits the body via the literal Aliases line
    // (+1), below min-score 2 → nothing from decisions.md is selected.
    expect(titles({ recency: true })).toEqual([]);
  });
});

describe("combined sort is deterministic (Lane 5)", () => {
  it("repeated combined compiles are byte-identical", () => {
    const now = new Date("2026-06-09T00:00:00.000Z");
    const args = { sources: SOURCES, task: "auth", scopes: [], maxBlocksPerFile: 2, aliases: true, recency: true, now };
    expect(renderContextPackJson(compileContext({ ...args }))).toBe(
      renderContextPackJson(compileContext({ ...args })),
    );
  });

  it("enabling both flags is byte-for-byte identical to neither when no block declares a date or alias", () => {
    const PLAIN = {
      "constraints.md": "# Constraints\n\n## Care #safety\n\nbe careful\n",
      "decisions.md": "# Decisions\n\n## D #perf\n\nperf cache redis\n",
    };
    const now = new Date("2026-06-09T00:00:00.000Z");
    const base = { sources: PLAIN, task: "perf", scopes: ["perf"], now };
    expect(renderContextPackJson(compileContext({ ...base, aliases: true, recency: true }))).toBe(
      renderContextPackJson(compileContext({ ...base })),
    );
  });
});
