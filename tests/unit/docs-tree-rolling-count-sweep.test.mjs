import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// root-doc-public-surface-sweep-v1 — the third and final tile of the rolling-
// count coverage map. The public markdown surface partitions three ways:
//
//   1. package-public docs (npm `files` allowlist) + README + CHANGELOG
//      → public-doc-rolling-count-sweep-v1  (the sibling)
//   2. the unpacked root docs (CONTRIBUTING, RELEASE-CHECKLIST, …)
//      → root-public-doc-rolling-count-sweep.test.mjs  (this lane's first tile)
//   3. the unpacked docs/ reference tree (design/contract/reference docs that
//      live in the public GitHub repo but are excluded from the npm tarball)
//      → THIS file.
//
// Tile 3 was the last seam: a rolling suite count or gate score could rot in
// any of ~100 reference docs with nothing to catch it. packaging.md proved the
// risk was real — it carried a stale "47 files" tarball size (the live pack
// ships more) until this lane fixed it. This sweep keeps the whole reference
// tree durable: the gate's own output is the count of record, never prose.
//
// Historical carve-out (the analogue of the sibling's CHANGELOG released-section
// rule): dated phase-closeout records and the extraction provenance docs are
// frozen evidence of a completed phase, not live claims about the current
// product. They are exempt by a filename rule; every other reference doc is
// live and is swept.

const SIBLING_NAMED_DOCS = ["README.md", "CHANGELOG.md", "docs/testing.md", "docs/product-status.md"];

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
// Owned by tiles 1 & 2 — the sibling sweep audits these, so we never do.
const SIBLING_OWNED = new Set([...SIBLING_NAMED_DOCS, ...packedMd]);

// Frozen provenance / dated closeout records: historical evidence, not live
// prose. A phase-closeout doc records the totals a finished phase shipped with
// (its filename carries the phase + a version), exactly like a dated changelog
// release section; the extraction-map and phase-a-runbook are read-only history.
const isHistorical = (rel) =>
  /-closeout-v\d+\.md$/.test(rel) ||
  /extraction-map|extraction-inventory/i.test(rel) ||
  /phase-a-runbook/i.test(rel);

const allDocsMd = walkMd("docs");
const AUDITED_DOCS = allDocsMd
  .filter((rel) => !SIBLING_OWNED.has(rel) && !isHistorical(rel))
  .sort();
const HISTORICAL_DOCS = allDocsMd.filter(isHistorical).sort();

// CRLF-normalized like the sibling doc audits.
const readDoc = (rel) => readFileSync(resolve(REPO_ROOT, rel), "utf8").replace(/\r\n/g, "\n");

// The allowlist for deliberate, guarded counts. Empty is the pinned state, not
// an omission: a future entry must name its file, quote its phrase verbatim,
// and name the focused test that keeps the number true.
//   { file: "docs/foo.md", phrase: "exactly 4 gate scripts", guard: "package-metadata.test.mjs M32" }
const GUARDED_COUNT_PHRASES = [];

// Identical shapes to the sibling sweeps so all three tiles classify prose the
// same way. Word-form sizes and non-suite numbers (versions, milestone ids)
// deliberately do not match.
const BRITTLE_COUNT =
  /\b\d[\d,]*\s*\+?\s*(?:unit[- ])?(?:tests?|test[- ]files?|files?|specs?|suites?|test\s+cases?)\b/i;
const GATE_SCORE = /\b\d+\s*\/\s*\d+\b/;
const STALENESS_HEDGES = [/at last count/i, /as of (?:this|last) (?:writing|count)/i];

describe("docs tree rolling-count sweep (root-doc-public-surface-sweep-v1)", () => {
  it("the audited surface is the unpacked, non-historical reference tree", () => {
    // Non-vacuous: the reference tree is large.
    expect(AUDITED_DOCS.length).toBeGreaterThan(50);
    // Disjoint from the sibling's surface: packed/named docs are not ours.
    for (const owned of ["docs/testing.md", "docs/product-status.md", "docs/cli-errors.md"]) {
      expect(AUDITED_DOCS, `${owned} belongs to the packed/named sweep`).not.toContain(owned);
    }
    // The historical records are carved out, not audited.
    for (const h of HISTORICAL_DOCS) {
      expect(AUDITED_DOCS, `${h} is historical and must be carved out`).not.toContain(h);
    }
    // The `files` allowlist is the packed surface of record; if it vanished the
    // audited tree would wrongly swallow packed docs.
    expect(Array.isArray(PKG.files), "package.json files allowlist must exist").toBe(true);
    expect(packedMd.length, "the files allowlist must contribute packed markdown").toBeGreaterThan(0);
    // Fail closed on unreadable files.
    for (const doc of AUDITED_DOCS) expect(() => readDoc(doc), `${doc} is unreadable`).not.toThrow();
  });

  it("the historical carve-out is principled and non-vacuous", () => {
    // The filename rule must classify the canonical shapes correctly.
    expect(isHistorical("docs/mind-ontology-phase-2-closeout-v0.md")).toBe(true);
    expect(isHistorical("docs/mind-ontology-extraction-map.md")).toBe(true);
    expect(isHistorical("docs/agentctx-phase-a-runbook.md")).toBe(true);
    expect(isHistorical("docs/packaging.md"), "a live reference doc is not historical").toBe(false);
    expect(isHistorical("docs/schema-authoring.md"), "a live reference doc is not historical").toBe(
      false,
    );
    // The carve-out must actually exclude something, and at least one excluded
    // doc must really carry a count/score — otherwise the exemption is dead code.
    expect(HISTORICAL_DOCS.length, "no historical docs found — the filename rule rotted").toBeGreaterThan(0);
    const someHistoricalHasCount = HISTORICAL_DOCS.some((rel) => {
      const t = readDoc(rel);
      return BRITTLE_COUNT.test(t) || GATE_SCORE.test(t);
    });
    expect(
      someHistoricalHasCount,
      "no carved-out doc carries a count/score — the historical exemption guards nothing",
    ).toBe(true);
  });

  it("the known stale relics never appear in any audited reference doc", () => {
    const RELICS = ["1205 tests", "across 170 files", "407 tests", "22/22", "12/12", "at last count"];
    for (const doc of AUDITED_DOCS) {
      const text = readDoc(doc);
      for (const relic of RELICS) {
        expect(text, `${doc} reintroduced the stale suite-count relic "${relic}"`).not.toContain(
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
        `allowlisted phrase "${entry.phrase}" carries no exact count — remove it`,
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

  it("no unguarded suite-count or gate-score wording in any audited reference doc", () => {
    for (const doc of AUDITED_DOCS) {
      readDoc(doc)
        .split("\n")
        .forEach((line, i) => {
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
              `${doc}:${i + 1} states an exact ${name} ("${hit?.[0]}") with no guard; ` +
                `prefer durable wording (the gate's own output is the count of record), or ` +
                `register the phrase in GUARDED_COUNT_PHRASES with the focused test that pins it`,
            ).toBeNull();
          }
          for (const hedge of STALENESS_HEDGES) {
            expect(
              hedge.test(scrubbed),
              `${doc}:${i + 1} hedges a snapshot ("${line.trim()}"); drop the rolling number instead`,
            ).toBe(false);
          }
        });
    }
  });

  it("this audit is declarative: no process spawning in this file", () => {
    const self = readFileSync(fileURLToPath(import.meta.url), "utf8");
    expect(self, "the docs-tree sweep must stay a prose audit").not.toMatch(
      /from\s+["']node:child_process["']/,
    );
  });
});
