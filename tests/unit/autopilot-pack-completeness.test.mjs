import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOCS = resolve(REPO_ROOT, "docs");
const TESTS = resolve(REPO_ROOT, "tests/unit");
const INDEX = resolve(DOCS, "mind-ontology.md");
const FRAME = "mind-ontology-autopilot-pack-v1.md";

// The exact top-of-doc back-link every autopilot doc carries in its header.
const HEADER_LINK =
  "Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).";

// Auto-discover every autopilot doc so a new one cannot land unindexed/orphaned.
const AUTOPILOT_DOCS = readdirSync(DOCS)
  .filter((f) => /^mind-ontology-autopilot-.*\.md$/.test(f))
  .sort();

const indexText = readFileSync(INDEX, "utf8");

describe("autopilot pack completeness (A25)", () => {
  it("discovers the full set of autopilot docs", () => {
    expect(AUTOPILOT_DOCS).toContain(FRAME);
    expect(AUTOPILOT_DOCS.length).toBeGreaterThanOrEqual(9);
  });

  it.each(AUTOPILOT_DOCS)("%s is linked from the docs index", (doc) => {
    expect(indexText, `index does not link ${doc}`).toContain(doc);
  });

  it.each(AUTOPILOT_DOCS.filter((d) => d !== FRAME))(
    "%s cross-links back to the pack frame",
    (doc) => {
      const text = readFileSync(resolve(DOCS, doc), "utf8");
      expect(text, `${doc} does not link back to the frame`).toContain(FRAME);
    },
  );

  it("the frame is reachable and names itself as the pack entry point", () => {
    const frame = readFileSync(resolve(DOCS, FRAME), "utf8").toLowerCase();
    expect(frame).toContain("autopilot integration pack");
    expect(frame).toMatch(/portable semantic constitution/);
  });

  it("the index's autopilot section keeps the local-first framing", () => {
    const lower = indexText.toLowerCase();
    const idx = lower.indexOf("autopilot integration");
    expect(idx).toBeGreaterThan(-1);
    expect(lower.slice(idx, idx + 400)).toMatch(/local-first|no hosted/);
  });
});

// ---------------------------------------------------------------------------
// Aggregate owner-test coverage of the top-of-doc pack header (A25).
//
// The per-doc batches pinned the exact header back-link in each direct owner
// test individually. Nothing yet held the *aggregate* invariant: a brand-new
// autopilot doc carrying the standard top-of-doc header could land without its
// direct owner test pinning that exact link, and no single test would notice.
// This block discovers every header doc and derives its direct owner test by
// the documented slug rule, then requires the exact link to be pinned there.
//
// 25 header docs already pin the exact link in their direct owner test. 28 do
// not yet (whole doc categories the per-doc batches had not reached when this
// was written, 2026-06-14). Those are carried in a frozen, shrink-only ledger
// — the same allowlist discipline the docs-tree sweep uses for guarded counts.
// The ledger only ever shrinks: a new unpinned doc is a regression, and a
// freshly-pinned doc must be delisted. So the future doc this block guards
// against cannot land silently, while no existing owner test is rewritten.

// docs/mind-ontology-autopilot-<slug>-v1.md -> tests/unit/autopilot-<slug>.test.mjs
const ownerTestFor = (doc) =>
  `autopilot-${doc
    .replace(/^mind-ontology-autopilot-/, "")
    .replace(/-v1\.md$/, "")}.test.mjs`;

// Docs whose first 10 lines carry the exact top-of-doc pack header.
const HEADER_DOCS = AUTOPILOT_DOCS.filter((doc) =>
  readFileSync(resolve(DOCS, doc), "utf8")
    .split(/\r?\n/)
    .slice(0, 10)
    .join("\n")
    .includes(HEADER_LINK),
);

const pinsHeader = (doc) => {
  const owner = resolve(TESTS, ownerTestFor(doc));
  return existsSync(owner) && readFileSync(owner, "utf8").includes(HEADER_LINK);
};

const LIVE_PENDING = HEADER_DOCS.filter((doc) => !pinsHeader(doc)).sort();

// Frozen shrink-only ledger: header docs whose direct owner test does NOT yet
// pin the exact link. Captured 2026-06-14. Entries leave only by being fixed
// (pin the exact link in the owner test, then delete the entry here). No entry
// may be added without a real, pre-existing gap.
const KNOWN_PENDING = [].sort();

describe("autopilot top-of-doc header — aggregate owner-test coverage (A25)", () => {
  it("discovers a non-trivial set of header docs", () => {
    expect(HEADER_DOCS.length).toBeGreaterThanOrEqual(25);
    // The frame itself is the link target, so it does not carry the back-link.
    expect(HEADER_DOCS).not.toContain(FRAME);
  });

  it("every header doc outside the ledger pins the EXACT link in its direct owner test", () => {
    const required = HEADER_DOCS.filter((doc) => !KNOWN_PENDING.includes(doc));
    // Non-vacuous: the bulk of header docs are already covered.
    expect(required.length).toBeGreaterThanOrEqual(25);
    for (const doc of required) {
      const owner = ownerTestFor(doc);
      expect(
        existsSync(resolve(TESTS, owner)),
        `${doc}: derived direct owner test ${owner} is missing`,
      ).toBe(true);
      expect(
        readFileSync(resolve(TESTS, owner), "utf8"),
        `${owner} does not pin the exact top-of-doc header link for ${doc}`,
      ).toContain(HEADER_LINK);
    }
  });

  it("the known-gap ledger is exact and shrink-only", () => {
    // A new unpinned header doc would appear here but not in the ledger — a
    // regression. A freshly pinned ledger doc disappears here and must be
    // delisted. Either way the ledger must be edited deliberately.
    const newlyRegressed = LIVE_PENDING.filter((d) => !KNOWN_PENDING.includes(d));
    const nowFixed = KNOWN_PENDING.filter((d) => !LIVE_PENDING.includes(d));
    expect(
      newlyRegressed,
      `header doc(s) landed without owner-test pinning the exact link: ${newlyRegressed.join(", ")}`,
    ).toEqual([]);
    expect(
      nowFixed,
      `ledger doc(s) now pin the link — delete them from KNOWN_PENDING: ${nowFixed.join(", ")}`,
    ).toEqual([]);
  });

  it("every ledger entry is a real, still-present header doc", () => {
    for (const doc of KNOWN_PENDING) {
      expect(
        HEADER_DOCS,
        `${doc} is in KNOWN_PENDING but is no longer a current header doc — remove it`,
      ).toContain(doc);
    }
  });
});
