import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// docs/testing.md ships in the npm pack (see packaging-dry-run-contract), so
// it is public operator surface. The doc once claimed "407 tests across 77
// files at last count" — a hand-maintained snapshot that was stale the moment
// the suite grew. This audit keeps the doc durable the other way around: the
// run itself is the count of record, and any future exact suite-count prose
// must be registered below with its own guard or the audit fails closed.
// CRLF-normalized like the sibling doc audits: working-tree EOLs are a git
// autocrlf artifact, not part of the prose.
const DOC = "docs/testing.md";
const docText = readFileSync(resolve(REPO_ROOT, DOC), "utf8").replace(/\r\n/g, "\n");

// testing-doc-count-freshness-v1 — the exact suite-count phrases the doc is
// allowed to carry. Empty is the pinned state, not an omission: a future
// entry must quote its phrase verbatim and name the focused test that keeps
// the number true, so a count can only ship deliberately and guarded.
//   { phrase: "exactly 4 gate scripts", guard: "package-metadata.test.mjs M32" }
const GUARDED_COUNT_PHRASES = [];

// The brittle shape: a digit glued to a suite-size noun. Word-form sizes
// ("one file", "four gates") and non-suite numbers ("0 errors", "W5", "M32")
// deliberately do not match — those are stable claims, not rolling totals.
const BRITTLE_COUNT =
  /\b\d[\d,]*\s*\+?\s*(?:unit[- ])?(?:tests?|test[- ]files?|files?|specs?|suites?|test\s+cases?)\b/i;

// The hedges that historically dressed a snapshot up as documentation. A
// phrase like "at last count" admits the number rots; the fix is to drop the
// number, not to hedge it.
const STALENESS_HEDGES = [/at last count/i, /as of (?:this|last) (?:writing|count)/i];

describe("testing doc suite-count freshness (testing-doc-count-freshness-v1)", () => {
  it("the stale 407/77 snapshot never returns, in any spelling", () => {
    for (const relic of ["407 tests", "across 77 files", "407", "at last count"]) {
      expect(docText, `${DOC} reintroduced the stale suite-count relic "${relic}"`).not.toContain(
        relic,
      );
    }
  });

  it("the guarded-phrase allowlist is internally sound and non-vacuous", () => {
    for (const entry of GUARDED_COUNT_PHRASES) {
      expect(
        BRITTLE_COUNT.test(entry.phrase),
        `allowlisted phrase "${entry.phrase}" carries no exact count — it does not need guarding; remove it`,
      ).toBe(true);
      expect(
        entry.guard,
        `allowlisted phrase "${entry.phrase}" must name the focused test that keeps its number true`,
      ).toBeTruthy();
      expect(
        docText,
        `allowlisted phrase "${entry.phrase}" no longer appears in ${DOC}; remove the stale entry`,
      ).toContain(entry.phrase);
    }
  });

  it("no unguarded exact suite-count wording anywhere in the doc", () => {
    docText.split("\n").forEach((line, i) => {
      let scrubbed = line;
      for (const entry of GUARDED_COUNT_PHRASES) {
        scrubbed = scrubbed.split(entry.phrase).join("");
      }
      const hit = BRITTLE_COUNT.exec(scrubbed);
      expect(
        hit,
        `${DOC}:${i + 1} states an exact suite count ("${hit?.[0]}") with no guard; ` +
          `prefer durable wording (the runner's summary is the count of record), or ` +
          `register the phrase in GUARDED_COUNT_PHRASES with the focused test that pins it`,
      ).toBeNull();
      for (const hedge of STALENESS_HEDGES) {
        expect(
          hedge.test(scrubbed),
          `${DOC}:${i + 1} hedges a snapshot ("${line.trim()}"); drop the rolling number instead`,
        ).toBe(false);
      }
    });
  });

  it("the Full gate row keeps the durable wording: run the suite, read its summary", () => {
    // The replacement contract: the doc tells operators how to get the live
    // totals instead of asserting a number that rots. If this row is reworded,
    // keep both halves — what npm test covers, and where the count comes from.
    for (const marker of [
      "| **Full** | `npm test` |",
      "The entire `tests/unit` suite",
      "the run itself is the count of record",
      "The release gate.",
    ]) {
      expect(docText, `${DOC} lost the durable Full-gate wording "${marker}"`).toContain(marker);
    }
  });

  it("this audit is declarative: no process spawning in this file", () => {
    const self = readFileSync(fileURLToPath(import.meta.url), "utf8");
    expect(self, "count freshness must stay a prose audit").not.toMatch(
      /from\s+["']node:child_process["']/,
    );
  });
});
