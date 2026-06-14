import { describe, expect, it } from "vitest";
import {
  compileContext,
  parseBlockDate,
  renderContextPackJson,
} from "../../scripts/agentctx/compile.mjs";

// Lane A — deterministic recency tie-breaker. parseBlockDate is clock-free: it only
// reads a block's literal `Date:` line. The selection layer uses it to break score
// ties (newer first) and never to add score, so an unused flag is byte-for-byte legacy.

describe("parseBlockDate (Lane A)", () => {
  it("parses a real calendar date", () => {
    expect(parseBlockDate("Status: accepted\nDate: 2026-02-10\n\nbody")).toBe("2026-02-10");
  });

  it("is case-insensitive and tolerates surrounding whitespace", () => {
    expect(parseBlockDate("  date:   2026-03-01  ")).toBe("2026-03-01");
  });

  it("treats the placeholder YYYY-MM-DD as neutral (null)", () => {
    expect(parseBlockDate("Date: YYYY-MM-DD")).toBeNull();
  });

  it("rejects an impossible calendar date (null)", () => {
    expect(parseBlockDate("Date: 2026-13-40")).toBeNull();
    expect(parseBlockDate("Date: 2026-02-31")).toBeNull();
  });

  it("rejects a malformed / non-zero-padded date (null)", () => {
    expect(parseBlockDate("Date: 2026-2-3")).toBeNull();
    expect(parseBlockDate("Date: 2026/02/03")).toBeNull();
    expect(parseBlockDate("Date: not-a-date")).toBeNull();
  });

  it("returns null when no Date: line is present", () => {
    expect(parseBlockDate("Status: accepted\n\njust some body text")).toBeNull();
  });

  it("uses the first Date: line when several appear", () => {
    expect(parseBlockDate("Date: 2026-01-01\nDate: 2026-12-31")).toBe("2026-01-01");
  });
});

// Selection-level behavior. Two decisions blocks that score equally (both match the
// same scope) must order newer-first only when --recency is on; otherwise insertion
// order (index) wins, exactly as before.
const SOURCES = {
  "constraints.md": "# Constraints\n\n## Care #safety\n\nbe careful\n",
  "decisions.md":
    "# Decisions\n\n## Older choice #perf\n\nStatus: accepted\nDate: 2026-01-01\n\nuse redis perf\n\n" +
    "## Newer choice #perf\n\nStatus: accepted\nDate: 2026-09-01\n\nuse redis perf\n",
};

const sel = (opts) => {
  const p = JSON.parse(
    renderContextPackJson(compileContext({ sources: SOURCES, task: "perf", scopes: ["perf"], ...opts })),
  );
  return p.selected.filter((b) => b.file === "decisions.md").map((b) => `${b.title}/${b.score}`);
};

describe("--recency selection (Lane A)", () => {
  it("default (no recency): score-tied blocks keep insertion order (Older first by index)", () => {
    expect(sel({ maxBlocksPerFile: 2 })).toEqual(["Older choice/26", "Newer choice/26"]);
  });

  it("recency on: among score-tied blocks the newer Date: ranks first", () => {
    expect(sel({ maxBlocksPerFile: 2, recency: true })).toEqual([
      "Newer choice/26",
      "Older choice/26",
    ]);
  });

  it("recency never changes the score (tie-breaker only, no points added)", () => {
    const off = sel({ maxBlocksPerFile: 2 }).map((s) => s.split("/")[1]);
    const on = sel({ maxBlocksPerFile: 2, recency: true }).map((s) => s.split("/")[1]);
    expect(off.sort()).toEqual(on.sort()); // same multiset of scores
    expect(on.every((s) => s === "26")).toBe(true);
  });
});

describe("--recency does not override relevance (Lane A)", () => {
  // A newer but less-relevant block must NOT outrank an older, more-relevant one.
  const MIXED = {
    "constraints.md": "# Constraints\n\n## Care #safety\n\nbe careful\n",
    "decisions.md":
      "# Decisions\n\n## High relevance #perf\n\nDate: 2026-01-01\n\nperf perf cache redis\n\n" +
      "## Low relevance #misc\n\nDate: 2026-12-31\n\nperf mentioned once\n",
  };
  it("higher score wins even when the other block is newer", () => {
    const p = JSON.parse(
      renderContextPackJson(
        compileContext({
          sources: MIXED,
          task: "perf",
          scopes: ["perf"],
          maxBlocksPerFile: 2,
          recency: true,
        }),
      ),
    );
    const titles = p.selected.filter((b) => b.file === "decisions.md").map((b) => b.title);
    expect(titles[0]).toBe("High relevance");
  });
});

describe("--recency neutral dates (Lane A)", () => {
  const NEUTRAL = {
    "constraints.md": "# Constraints\n\n## Care #safety\n\nbe careful\n",
    "decisions.md":
      "# Decisions\n\n## Has date #perf\n\nDate: 2026-05-01\n\nperf cache\n\n" +
      "## Placeholder #perf\n\nDate: YYYY-MM-DD\n\nperf cache\n\n" +
      "## No date #perf\n\nperf cache\n",
  };
  it("a real date outranks placeholder/missing dates on a score tie", () => {
    const p = JSON.parse(
      renderContextPackJson(
        compileContext({
          sources: NEUTRAL,
          task: "perf",
          scopes: ["perf"],
          maxBlocksPerFile: 3,
          recency: true,
        }),
      ),
    );
    const titles = p.selected.filter((b) => b.file === "decisions.md").map((b) => b.title);
    expect(titles[0]).toBe("Has date");
    // The two neutral blocks keep their relative insertion order behind it.
    expect(titles.slice(1)).toEqual(["Placeholder", "No date"]);
  });
});

describe("recency byte-for-byte backward compatibility (Lane A)", () => {
  it("recency:false renders identically to recency omitted", () => {
    // Fix the clock so generatedAt (a timestamp) can't differ between the two calls.
    const now = new Date("2026-06-09T00:00:00.000Z");
    const ARGS = { sources: SOURCES, task: "perf", scopes: ["perf"], maxBlocksPerFile: 2, now };
    const a = renderContextPackJson(compileContext({ ...ARGS }));
    const b = renderContextPackJson(compileContext({ ...ARGS, recency: false }));
    expect(a).toBe(b);
  });

  it("recencyDate is internal and never leaks into rendered JSON", () => {
    const json = renderContextPackJson(
      compileContext({ sources: SOURCES, task: "perf", scopes: ["perf"], recency: true }),
    );
    expect(json).not.toContain("recencyDate");
  });
});
