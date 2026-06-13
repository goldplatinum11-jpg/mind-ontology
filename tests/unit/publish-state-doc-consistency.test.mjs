import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// root-doc-public-surface-sweep-v1 — publish-state consistency guard.
//
// The `private` gate was removed from package.json on 2026-06-11 (the package
// is publish-ready, version 0.1.0; publishing itself is a separate explicit
// operator decision). That manifest fact is pinned by package-metadata,
// license-boundary, packaging-plan, and changelog-scaffold (each asserts
// `PKG.private` is undefined). But two public docs lagged behind it: README.md
// and CONTRIBUTING.md both still asserted the package was "still `private`/
// pre-release" — a present-tense status claim that the manifest, and those
// docs' own bodies, already contradicted.
//
// This guard ties the prose to the manifest so the two cannot drift apart
// again. While the manifest carries no `private` gate, no public-facing root
// doc may assert the package is *currently* private. Docs that record the gate
// as **removed** (RELEASE-CHECKLIST, LICENSE-DECISION, CHANGELOG) are fine —
// the ban is only on the present-tense "still private" assertion, not on the
// word "private" itself. CRLF-normalized like the sibling doc audits.

const PKG = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));

const readDoc = (rel) => readFileSync(resolve(REPO_ROOT, rel), "utf8").replace(/\r\n/g, "\n");

const ROOT_DOCS = readdirSync(REPO_ROOT, { withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith(".md"))
  .map((e) => e.name)
  .sort();

// The stale present-tense claims that contradict a removed `private` gate.
// Each must name a doc that the audit reads (non-vacuous) and must currently
// be absent from every doc.
const STALE_PRIVATE_CLAIMS = [
  /\bstill\s+`?private`?/i,
  /`private`\s*\/\s*pre-release/i,
  /\bis\s+(?:still\s+)?(?:marked\s+)?`?private`?\b(?!\s+(?:gate|flag)\s+(?:is\s+)?removed)/i,
];

describe("publish-state doc consistency (root-doc-public-surface-sweep-v1)", () => {
  it("the manifest anchor holds: package.json carries no `private` gate", () => {
    // The premise of this guard. If the gate is ever re-added, this fails first
    // and tells the maintainer to reconcile the docs deliberately, rather than
    // letting the present-tense ban silently misfire.
    expect(
      PKG.private,
      "package.json regained a `private` field — reconcile the publish-ready docs before re-banning the claim",
    ).toBeUndefined();
  });

  it("no public root doc asserts the package is currently private", () => {
    for (const doc of ROOT_DOCS) {
      const text = readDoc(doc);
      for (const claim of STALE_PRIVATE_CLAIMS) {
        const hit = claim.exec(text);
        expect(
          hit,
          `${doc} asserts the package is still private ("${hit?.[0]}"), but the private gate ` +
            `was removed (PKG.private is undefined). State publish-ready/unpublished instead.`,
        ).toBeNull();
      }
    }
  });

  it("the two corrected docs now state the publish-ready, unpublished position", () => {
    // Pin the replacement so a future edit cannot quietly drop the corrected
    // framing back toward the stale claim. Both docs must say publish-ready and
    // not-yet-published, without re-introducing the private assertion.
    for (const doc of ["README.md", "CONTRIBUTING.md"]) {
      const text = readDoc(doc).toLowerCase();
      expect(text, `${doc} lost the durable "publish-ready" framing`).toContain("publish-ready");
      expect(
        /not\s+(?:yet\s+)?published|not\s+published\s+yet/.test(text),
        `${doc} must still say the package is not yet published`,
      ).toBe(true);
    }
  });

  it("the ban targets the present-tense claim, not the removed-gate record", () => {
    // Non-vacuity in both directions: the stale phrasing is caught, and the
    // legitimate "gate removed" record is not a false positive.
    const stale = "The package is still `private`/pre-release, so it is not published yet.";
    const removed = "The `\"private\"` gate has been removed (2026-06-11) — publish-ready.";
    expect(
      STALE_PRIVATE_CLAIMS.some((re) => re.test(stale)),
      "the guard must catch the stale present-tense private claim",
    ).toBe(true);
    expect(
      STALE_PRIVATE_CLAIMS.some((re) => re.test(removed)),
      "the guard must not flag a doc that records the private gate as removed",
    ).toBe(false);
  });

  it("this audit is declarative: no process spawning in this file", () => {
    const self = readFileSync(fileURLToPath(import.meta.url), "utf8");
    expect(self, "publish-state consistency must stay a prose audit").not.toMatch(
      /from\s+["']node:child_process["']/,
    );
  });
});
