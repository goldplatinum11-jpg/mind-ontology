import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// docs/product-status.md is the repo's status of record (repo-only, not packed).
// It once claimed "1205 tests across 170 files, green" — a hand-maintained
// snapshot that was stale the moment the suite grew, alongside rolling gate
// scores ("22/22", "12/12") with the same rot. This audit keeps the doc durable
// the other way around: the run itself is the count of record, and any future
// exact suite-count or gate-score prose must be registered below with its own
// guard or the audit fails closed. CRLF-normalized like the sibling doc audits:
// working-tree EOLs are a git autocrlf artifact, not part of the prose.
const DOC = "docs/product-status.md";
const docText = readFileSync(resolve(REPO_ROOT, DOC), "utf8").replace(/\r\n/g, "\n");

// product-status-suite-count-freshness-v1 — the exact suite-count phrases the
// doc is allowed to carry. Empty is the pinned state, not an omission: a future
// entry must quote its phrase verbatim and name the focused test that keeps the
// number true, so a count can only ship deliberately and guarded.
//   { phrase: "exactly 4 gate scripts", guard: "package-metadata.test.mjs M32" }
const GUARDED_COUNT_PHRASES = [];

// The brittle shape: a digit glued to a suite-size noun. Word-form sizes
// ("Nine-file schema", "four gates") and non-suite numbers ("0 errors",
// "0.1.0", "M37") deliberately do not match — those are stable claims, not
// rolling totals.
const BRITTLE_COUNT =
  /\b\d[\d,]*\s*\+?\s*(?:unit[- ])?(?:tests?|test[- ]files?|files?|specs?|suites?|test\s+cases?)\b/i;

// The other rolling shape this doc carried: a pass-rate gate score like
// "22/22" or "(12/12)". Gate scores grow with the suite; the gate's own
// output is where the live score lives.
const GATE_SCORE = /\b\d+\s*\/\s*\d+\b/;

// The hedges that historically dress a snapshot up as documentation. A phrase
// like "at last count" admits the number rots; the fix is to drop the number,
// not to hedge it.
const STALENESS_HEDGES = [/at last count/i, /as of (?:this|last) (?:writing|count)/i];

describe("product status suite-count freshness (product-status-suite-count-freshness-v1)", () => {
  it("the stale 1205/170 snapshot never returns, in any spelling", () => {
    for (const relic of ["1205", "across 170 files", "22/22", "(12/12)", "at last count"]) {
      expect(docText, `${DOC} reintroduced the stale suite-count relic "${relic}"`).not.toContain(
        relic,
      );
    }
  });

  it("the guarded-phrase allowlist is internally sound and non-vacuous", () => {
    for (const entry of GUARDED_COUNT_PHRASES) {
      expect(
        BRITTLE_COUNT.test(entry.phrase) || GATE_SCORE.test(entry.phrase),
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

  it("no unguarded exact suite-count or gate-score wording anywhere in the doc", () => {
    docText.split("\n").forEach((line, i) => {
      let scrubbed = line;
      for (const entry of GUARDED_COUNT_PHRASES) {
        scrubbed = scrubbed.split(entry.phrase).join("");
      }
      for (const [name, pattern] of [
        ["suite count", BRITTLE_COUNT],
        ["gate score", GATE_SCORE],
      ]) {
        const hit = pattern.exec(scrubbed);
        expect(
          hit,
          `${DOC}:${i + 1} states an exact ${name} ("${hit?.[0]}") with no guard; ` +
            `prefer durable wording (the gate's own output is the count of record), or ` +
            `register the phrase in GUARDED_COUNT_PHRASES with the focused test that pins it`,
        ).toBeNull();
      }
      for (const hedge of STALENESS_HEDGES) {
        expect(
          hedge.test(scrubbed),
          `${DOC}:${i + 1} hedges a snapshot ("${line.trim()}"); drop the rolling number instead`,
        ).toBe(false);
      }
    });
  });

  it("the Verification table keeps the durable wording: run the gates, read their output", () => {
    // The replacement contract: the doc tells operators what green looks like
    // and where the live totals come from, instead of asserting numbers that
    // rot. If this section is reworded, keep all three halves — the gates, the
    // count-of-record pointer, and the testing.md hand-off.
    for (const marker of [
      "| Gate | Command | Green looks like |",
      "the run itself is the count of record",
      "the runner's summary line carries the live file and test totals",
      "[`testing.md`](testing.md)",
    ]) {
      expect(docText, `${DOC} lost the durable Verification wording "${marker}"`).toContain(marker);
    }
  });

  it("this audit is declarative: no process spawning in this file", () => {
    const self = readFileSync(fileURLToPath(import.meta.url), "utf8");
    expect(self, "count freshness must stay a prose audit").not.toMatch(
      /from\s+["']node:child_process["']/,
    );
  });
});
