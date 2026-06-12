import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// public-doc-rolling-count-sweep-v1 — the repo-wide sibling of the per-doc
// freshness audits (testing-doc-count-freshness-v1,
// product-status-suite-count-freshness-v1). Those pin two docs that already
// rotted once ("407 tests across 77 files", "1205 tests across 170 files",
// "22/22"); this sweep closes the gap for every other public-facing document,
// so a rolling suite count or gate score cannot reappear somewhere the focused
// audits don't look.
//
// The audited surface is declarative: the package-public markdown (derived
// statically from the package.json `files` allowlist — the same allowlist
// packaging-dry-run-contract.test.mjs proves equals the real `npm pack`
// listing) plus the public-facing root docs that are not packed. No process is
// spawned and no live totals are computed; the sweep only reads prose.
//
// CHANGELOG nuance: a changelog legitimately records the numbers a release
// shipped with. Lines under a *released* heading ("## [x.y.z] - YYYY-MM-DD")
// are historical evidence and exempt; the preamble and the [Unreleased]
// section describe the live product and are swept like any other doc. History
// is never rewritten to erase counts — it simply is not "current" prose.

const ROOT_DOCS = ["README.md", "CHANGELOG.md", "docs/testing.md", "docs/product-status.md"];

const walkMd = (relDir) => {
  const out = [];
  for (const entry of readdirSync(resolve(REPO_ROOT, relDir), { withFileTypes: true })) {
    const rel = `${relDir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walkMd(rel));
    else if (entry.isFile() && entry.name.endsWith(".md")) out.push(rel);
  }
  return out;
};

const PKG = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));
const packedMd = (PKG.files ?? []).flatMap((entry) =>
  entry.endsWith("/**") ? walkMd(entry.slice(0, -3)) : entry.endsWith(".md") ? [entry] : [],
);
const AUDITED_DOCS = [...new Set([...ROOT_DOCS, ...packedMd])].sort();

// CRLF-normalized like the sibling doc audits: working-tree EOLs are a git
// autocrlf artifact, not part of the prose.
const readDoc = (rel) => readFileSync(resolve(REPO_ROOT, rel), "utf8").replace(/\r\n/g, "\n");

// The allowlist for deliberate, guarded counts. Empty is the pinned state, not
// an omission: a future entry must name its file, quote its phrase verbatim,
// and name the focused test that keeps the number true, so a count can only
// ship deliberately and guarded.
//   { file: "docs/testing.md", phrase: "exactly 4 gate scripts", guard: "package-metadata.test.mjs M32" }
const GUARDED_COUNT_PHRASES = [];

// The brittle shape: a digit glued to a suite-size noun. Word-form sizes
// ("one file", "four gates") and non-suite numbers ("0 errors", "0.1.0",
// "M37") deliberately do not match — those are stable claims, not rolling
// totals.
const BRITTLE_COUNT =
  /\b\d[\d,]*\s*\+?\s*(?:unit[- ])?(?:tests?|test[- ]files?|files?|specs?|suites?|test\s+cases?)\b/i;

// The other rolling shape: a pass-rate gate score like "22/22" or "(12/12)".
// Gate scores grow with the suite; the gate's own output is where the live
// score lives.
const GATE_SCORE = /\b\d+\s*\/\s*\d+\b/;

// The hedges that historically dress a snapshot up as documentation. A phrase
// like "at last count" admits the number rots; the fix is to drop the number,
// not to hedge it.
const STALENESS_HEDGES = [/at last count/i, /as of (?:this|last) (?:writing|count)/i];

// A released changelog heading per Keep a Changelog: version + release date.
// Only this exact shape unlocks the historical exemption — "[Unreleased]" has
// no date and stays live.
const RELEASED_HEADING = /^## \[\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?\] - \d{4}-\d{2}-\d{2}\b/;

// Every line of every doc is live, except CHANGELOG lines inside a released
// section (from its dated heading until the next "## " heading).
const liveLines = (file, text) => {
  const lines = text.split("\n");
  if (file !== "CHANGELOG.md") return lines.map((line, i) => ({ line, n: i + 1 }));
  const out = [];
  let historical = false;
  lines.forEach((line, i) => {
    if (line.startsWith("## ")) historical = RELEASED_HEADING.test(line);
    if (!historical) out.push({ line, n: i + 1 });
  });
  return out;
};

describe("public doc rolling-count sweep (public-doc-rolling-count-sweep-v1)", () => {
  it("the audited surface is derived, non-vacuous, and covers the key root docs", () => {
    // The `files` allowlist is the packed surface of record (M48 proves the
    // dry-run matches it); if it disappears the sweep would silently shrink.
    expect(Array.isArray(PKG.files), "package.json files allowlist must exist").toBe(true);
    for (const doc of ROOT_DOCS) {
      expect(AUDITED_DOCS, `sweep lost key root doc ${doc}`).toContain(doc);
    }
    // Packed docs ride in via the allowlist, and the glob walk really walks:
    // templates/** ships markdown today, so the sweep must see it.
    expect(AUDITED_DOCS, "sweep lost the packed testing doc").toContain("docs/testing.md");
    expect(
      AUDITED_DOCS.some((d) => d.startsWith("templates/")),
      "the templates/** walk found no markdown — the glob expansion is broken",
    ).toBe(true);
    // Fail closed on unreadable files: every audited doc must exist.
    for (const doc of AUDITED_DOCS) expect(() => readDoc(doc), `${doc} is unreadable`).not.toThrow();
  });

  it("the known stale relics never return to any live region, in any audited doc", () => {
    const RELICS = ["1205 tests", "across 170 files", "407 tests", "22/22", "12/12", "at last count"];
    for (const doc of AUDITED_DOCS) {
      const live = liveLines(doc, readDoc(doc))
        .map(({ line }) => line)
        .join("\n");
      for (const relic of RELICS) {
        expect(live, `${doc} reintroduced the stale suite-count relic "${relic}"`).not.toContain(
          relic,
        );
      }
    }
  });

  it("the guarded-phrase allowlist is internally sound and non-vacuous", () => {
    for (const entry of GUARDED_COUNT_PHRASES) {
      expect(
        AUDITED_DOCS,
        `allowlist entry for "${entry.phrase}" names ${entry.file}, which the sweep does not audit`,
      ).toContain(entry.file);
      expect(
        BRITTLE_COUNT.test(entry.phrase) || GATE_SCORE.test(entry.phrase),
        `allowlisted phrase "${entry.phrase}" carries no exact count — it does not need guarding; remove it`,
      ).toBe(true);
      expect(
        entry.guard,
        `allowlisted phrase "${entry.phrase}" must name the focused test that keeps its number true`,
      ).toBeTruthy();
      expect(
        readDoc(entry.file),
        `allowlisted phrase "${entry.phrase}" no longer appears in ${entry.file}; remove the stale entry`,
      ).toContain(entry.phrase);
    }
  });

  it("no unguarded suite-count or gate-score wording in any live region of any audited doc", () => {
    for (const doc of AUDITED_DOCS) {
      for (const { line, n } of liveLines(doc, readDoc(doc))) {
        let scrubbed = line;
        for (const entry of GUARDED_COUNT_PHRASES) {
          if (entry.file === doc) scrubbed = scrubbed.split(entry.phrase).join("");
        }
        for (const [name, pattern] of [
          ["suite count", BRITTLE_COUNT],
          ["gate score", GATE_SCORE],
        ]) {
          const hit = pattern.exec(scrubbed);
          expect(
            hit,
            `${doc}:${n} states an exact ${name} ("${hit?.[0]}") with no guard; ` +
              `prefer durable wording (the gate's own output is the count of record), or ` +
              `register the phrase in GUARDED_COUNT_PHRASES with the focused test that pins it`,
          ).toBeNull();
        }
        for (const hedge of STALENESS_HEDGES) {
          expect(
            hedge.test(scrubbed),
            `${doc}:${n} hedges a snapshot ("${line.trim()}"); drop the rolling number instead`,
          ).toBe(false);
        }
      }
    }
  });

  it("the changelog historical carve-out is exactly the dated released-section shape", () => {
    // Pin the carve-out's behavior with a fixture so it is tested, not dormant:
    // the repo has no released sections yet, but the rule must already be
    // right when the first one lands.
    const fixture = [
      "# Changelog",
      "Preamble prose.",
      "## [Unreleased]",
      "- live claim: 9999 tests across 999 files",
      "## [0.1.0] - 2026-01-01",
      "- shipped green with 1205 tests across 170 files, gates 22/22",
      "## Notes",
      "Back to live prose.",
    ].join("\n");
    const live = liveLines("CHANGELOG.md", fixture).map(({ line }) => line);
    expect(live, "the [Unreleased] section must stay live").toContain(
      "- live claim: 9999 tests across 999 files",
    );
    expect(live, "a dated released section is historical evidence, left untouched").not.toContain(
      "- shipped green with 1205 tests across 170 files, gates 22/22",
    );
    expect(live, "a released section ends at the next heading").toContain("Back to live prose.");
    // Undated or malformed headings do not unlock history.
    expect(RELEASED_HEADING.test("## [Unreleased]")).toBe(false);
    expect(RELEASED_HEADING.test("## [0.1.0]")).toBe(false);
    expect(RELEASED_HEADING.test("## [0.1.0] - 2026-01-01")).toBe(true);
    // The exemption is changelog-only: the same text in any other doc is live.
    expect(
      liveLines("docs/product-status.md", fixture).map(({ line }) => line),
      "only CHANGELOG.md gets the historical carve-out",
    ).toContain("- shipped green with 1205 tests across 170 files, gates 22/22");
    // And today, with no released sections, every CHANGELOG line is live.
    const changelog = readDoc("CHANGELOG.md");
    expect(liveLines("CHANGELOG.md", changelog).length).toBe(changelog.split("\n").length);
  });

  it("this audit is declarative: no process spawning in this file", () => {
    const self = readFileSync(fileURLToPath(import.meta.url), "utf8");
    expect(self, "the rolling-count sweep must stay a prose audit").not.toMatch(
      /from\s+["']node:child_process["']/,
    );
  });
});
