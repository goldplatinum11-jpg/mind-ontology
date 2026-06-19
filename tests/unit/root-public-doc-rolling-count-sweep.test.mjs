import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// root-doc-public-surface-sweep-v1 — the complement of
// public-doc-rolling-count-sweep-v1. That sibling audits the package-public
// surface (the markdown shipped by the package.json `files` allowlist) plus the
// two named root docs that are also packed/public (README.md, CHANGELOG.md).
// It deliberately does NOT look at the root docs that live in the repo root but
// are excluded from the npm tarball — CONTRIBUTING.md, RELEASE-CHECKLIST.md,
// NEXT-LANES.md, CONTROL.md, MIGRATION-PLAN.md, EXTRACTION-INVENTORY.md,
// LICENSE-DECISION.md. Those are still public-facing: anyone browsing the
// GitHub repo reads them, and a rolling suite count or gate score that rots in
// one of them is exactly the drift the packed-doc sweep was built to stop.
//
// This audit closes that gap. Its surface is the *partition complement* of the
// sibling's root-level surface: every root-level `*.md`, minus the root docs the
// sibling already owns. So the two sweeps cover the whole root with no gap and
// no overlap, and if a new root doc appears it is audited here automatically.
//
// EXTRACTION-INVENTORY nuance (the analogue of the sibling's CHANGELOG
// carve-out): the inventory is a frozen provenance record of the 2026-06-08
// extraction run. Its "Test results (standalone)" section records the exact
// totals that one historical run produced ("22/22", "41 files, 202 tests",
// "12/12"). Those are dated historical evidence, not a live claim about the
// current suite, and rewriting them would falsify the provenance. That one
// section is carved out; every other line of every audited doc is live prose
// and is swept like any other doc.

const SIBLING_NAMED_ROOT_DOCS = ["README.md", "CHANGELOG.md"];

// Root-level markdown shipped by the npm `files` allowlist — these are packed
// and already audited by the sibling sweep, so they are not ours.
const PKG = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));
const packedRootMd = (PKG.files ?? []).filter(
  (entry) => entry.endsWith(".md") && !entry.includes("/"),
);

const SIBLING_OWNED_ROOT = new Set([...SIBLING_NAMED_ROOT_DOCS, ...packedRootMd]);

const rootMd = readdirSync(REPO_ROOT, { withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith(".md"))
  .map((e) => e.name);

const AUDITED_DOCS = rootMd.filter((name) => !SIBLING_OWNED_ROOT.has(name)).sort();

const EXPECTED_DOCS = [
  "CONTRIBUTING.md",
  "CONTROL.md",
  "EXTRACTION-INVENTORY.md",
  "LICENSE-DECISION.md",
  "MIGRATION-PLAN.md",
  "NEXT-LANES.md",
  "RELEASE-CHECKLIST.md",
];

// CRLF-normalized like the sibling doc audits: working-tree EOLs are a git
// autocrlf artifact, not part of the prose.
const readDoc = (rel) => readFileSync(resolve(REPO_ROOT, rel), "utf8").replace(/\r\n/g, "\n");

// The allowlist for deliberate, guarded counts. Empty is the pinned state, not
// an omission: a future entry must name its file, quote its phrase verbatim,
// and name the focused test that keeps the number true, so a count can only
// ship deliberately and guarded.
//   { file: "RELEASE-CHECKLIST.md", phrase: "exactly 4 gate scripts", guard: "package-metadata.test.mjs M32" }
const GUARDED_COUNT_PHRASES = [];

// The brittle shapes, identical to the sibling sweep so the two audits classify
// prose the same way. A digit glued to a suite-size noun ("202 tests", "41
// files"); word-form sizes ("one file", "four gates") and non-suite numbers
// ("0 errors", "0.1.0", "M40") deliberately do not match.
const BRITTLE_COUNT =
  /\b\d[\d,]*\s*\+?\s*(?:unit[- ])?(?:tests?|test[- ]files?|files?|specs?|suites?|test\s+cases?)\b/i;
// A pass-rate gate score like "22/22" or "(12/12)" — grows with the suite.
const GATE_SCORE = /\b\d+\s*\/\s*\d+\b/;

const STALENESS_HEDGES = [/at last count/i, /as of (?:this|last) (?:writing|count)/i];

// The single historical carve-out: in EXTRACTION-INVENTORY.md, the dated
// extraction-run snapshot under "## Test results ...". Lines from that heading
// until the next "## " heading are frozen provenance, exempt from the live
// sweep. Every other doc, and every other section of the inventory, is live.
const isExtractionResultsHeading = (line) => /^##\s+Test results\b/.test(line);

const liveLines = (file, text) => {
  const lines = text.split("\n");
  if (file !== "EXTRACTION-INVENTORY.md") return lines.map((line, i) => ({ line, n: i + 1 }));
  const out = [];
  let historical = false;
  lines.forEach((line, i) => {
    if (line.startsWith("## ")) historical = isExtractionResultsHeading(line);
    if (!historical) out.push({ line, n: i + 1 });
  });
  return out;
};

describe("root public doc rolling-count sweep (root-doc-public-surface-sweep-v1)", () => {
  it("the audited surface is the sibling's complement: the unpacked public root docs", () => {
    // Non-vacuous and exactly the known set of unpacked root docs.
    expect(AUDITED_DOCS).toEqual(EXPECTED_DOCS);
    // The partition is clean: the sibling owns README/CHANGELOG, we never do.
    for (const owned of SIBLING_OWNED_ROOT) {
      expect(AUDITED_DOCS, `${owned} is the sibling sweep's doc, not ours`).not.toContain(owned);
    }
    expect(AUDITED_DOCS, "README.md is packed/public — the sibling sweep owns it").not.toContain(
      "README.md",
    );
    expect(AUDITED_DOCS, "CHANGELOG.md is named in the sibling sweep").not.toContain("CHANGELOG.md");
    // The `files` allowlist is the packed surface of record; if it disappears
    // the complement would silently swell to include packed docs.
    expect(Array.isArray(PKG.files), "package.json files allowlist must exist").toBe(true);
    expect(packedRootMd, "README.md must be in the files allowlist").toContain("README.md");
    // Fail closed on unreadable files: every audited doc must exist.
    for (const doc of AUDITED_DOCS) expect(() => readDoc(doc), `${doc} is unreadable`).not.toThrow();
  });

  it("the known stale relics never appear in any live region of any audited doc", () => {
    // The same rolling relics the packed sweep bans — they must not surface in
    // a live region of an unpacked root doc either. The extraction snapshot is
    // the only place these legitimately live, and it is carved out below.
    const RELICS = ["1205 tests", "across 170 files", "407 tests", "at last count"];
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
        `allowlist entry for "${entry.phrase}" names ${entry.file}, which this sweep does not audit`,
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

  it("the extraction-inventory carve-out is exactly the dated test-results section", () => {
    // Fixture-pin the carve-out so it is tested, not dormant: a results section
    // is historical, the surrounding prose is live, and the rule fires only for
    // the inventory.
    const fixture = [
      "# Extraction Inventory",
      "Preamble prose.",
      "## Extracted asset families",
      "- live claim: 9999 tests across 999 files",
      "## Test results (standalone)",
      "- `npm test` → 1205 tests across 170 files, gates 22/22",
      "## Safety confirmations",
      "Back to live prose.",
    ].join("\n");
    const live = liveLines("EXTRACTION-INVENTORY.md", fixture).map(({ line }) => line);
    expect(live, "non-results sections stay live").toContain(
      "- live claim: 9999 tests across 999 files",
    );
    expect(live, "the frozen results snapshot is historical, left untouched").not.toContain(
      "- `npm test` → 1205 tests across 170 files, gates 22/22",
    );
    expect(live, "the results section ends at the next heading").toContain("Back to live prose.");
    // The carve-out is inventory-only: the same heading elsewhere is live.
    expect(
      liveLines("CONTROL.md", fixture).map(({ line }) => line),
      "only EXTRACTION-INVENTORY.md gets the historical carve-out",
    ).toContain("- `npm test` → 1205 tests across 170 files, gates 22/22");

    // And against the real doc: the carve-out must be doing real work, not
    // guarding an empty section. The live region must be free of any gate
    // score, while the carved-out snapshot section must still hold one.
    const inventory = readDoc("EXTRACTION-INVENTORY.md");
    const liveText = liveLines("EXTRACTION-INVENTORY.md", inventory)
      .map(({ line }) => line)
      .join("\n");
    expect(liveText, "the extraction snapshot numbers must not leak into live prose").not.toMatch(
      GATE_SCORE,
    );
    const resultsSection = inventory.slice(inventory.indexOf("## Test results"));
    const resultsBody = resultsSection.slice(0, resultsSection.indexOf("\n## ", 3));
    expect(resultsBody, "the carved-out section must still hold its historical gate score").toMatch(
      GATE_SCORE,
    );
  });

  it("this audit is declarative: no process spawning in this file", () => {
    const self = readFileSync(fileURLToPath(import.meta.url), "utf8");
    expect(self, "the root-doc sweep must stay a prose audit").not.toMatch(
      /from\s+["']node:child_process["']/,
    );
  });
});
