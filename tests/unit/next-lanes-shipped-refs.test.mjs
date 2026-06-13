import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const NEXT_LANES = resolve(REPO_ROOT, "NEXT-LANES.md");

// NEXT-LANES.md records which candidates have shipped by naming the tests/docs that
// now own them. Those references must stay real, or the "shipped" claims rot and the
// backlog lies about what is done. Audit every inline-code `tests/...` and `docs/...`
// path the file cites and require it to exist.
const REF_RE = /`((?:tests|docs)\/[a-zA-Z0-9_./-]+\.(?:mjs|md))`/g;

describe("NEXT-LANES.md shipped references resolve", () => {
  const text = readFileSync(NEXT_LANES, "utf8");

  it("every cited tests/… and docs/… path exists", () => {
    const dead = [];
    const seen = new Set();
    let m;
    REF_RE.lastIndex = 0;
    while ((m = REF_RE.exec(text)) !== null) {
      const rel = m[1];
      if (seen.has(rel)) continue;
      seen.add(rel);
      if (!existsSync(resolve(REPO_ROOT, rel))) dead.push(rel);
    }
    expect(dead, `NEXT-LANES.md cites missing paths:\n${dead.join("\n")}`).toEqual([]);
  });

  it("actually cites shipped references (no false green from a non-matching regex)", () => {
    REF_RE.lastIndex = 0;
    const count = [...text.matchAll(REF_RE)].length;
    expect(count, "expected NEXT-LANES.md to cite shipped tests/docs").toBeGreaterThan(5);
  });
});
