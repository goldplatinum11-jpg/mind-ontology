import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => readFileSync(resolve(REPO_ROOT, p), "utf8").replace(/\r\n/g, "\n");
const PKG = JSON.parse(read("package.json"));

// root-doc-public-surface-sweep-v1 — packaging-doc / manifest sync.
//
// docs/packaging.md inlines a copy of the package.json `files` allowlist for
// the reader, and it used to assert an exact tarball size ("47 files", "47-file
// product tarball"). Both rot independently of the manifest: the inlined copy
// drifted two entries behind the real allowlist (it omitted docs/agent-setup.md
// and docs/init-from-repo.md), and the file total was stale the moment the
// product surface grew (the real dry-run ships more than 47). Neither was
// guarded — packaging-dry-run-contract only asserts the live pack is under 60
// files, and packaging-plan only checks a couple of core allowlist entries.
//
// This guard ties the doc to the manifest two ways: (1) the allowlist printed
// in the doc must equal package.json `files` exactly, so the inlined copy
// cannot drift again; (2) the doc must state no exact tarball file total — the
// dry-run listing is the count of record. CRLF-normalized like the sibling doc
// audits; declarative (no process spawning).

const DOC = "docs/packaging.md";
const docText = read(DOC);

// Pull the `"files": [ ... ]` array out of the doc's ```jsonc allowlist block,
// strip // line comments and trailing commas, and JSON.parse it.
const parseDocAllowlist = (text) => {
  const start = text.indexOf('"files"');
  expect(start, `${DOC} no longer prints a "files" allowlist block`).toBeGreaterThan(-1);
  const open = text.indexOf("[", start);
  const close = text.indexOf("]", open);
  expect(open, `${DOC} files block has no opening [`).toBeGreaterThan(-1);
  expect(close, `${DOC} files block has no closing ]`).toBeGreaterThan(open);
  const body = text
    .slice(open, close + 1)
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, "")) // drop // comments
    .join("\n")
    .replace(/,(\s*])/g, "$1"); // tolerate a trailing comma before ]
  return JSON.parse(body);
};

// A digit glued to a tarball-size noun, in either spelling: "47 files",
// "47-file product tarball". Word-form ("one file") and the version ("0.1.0")
// deliberately do not match.
const TARBALL_COUNT = /\b\d[\d,]*[ -](?:files?|file\b)/i;

describe("packaging doc stays in sync with the manifest (root-doc-public-surface-sweep-v1)", () => {
  it("the allowlist printed in the doc equals package.json `files` exactly", () => {
    const docFiles = parseDocAllowlist(docText);
    expect(Array.isArray(PKG.files), "package.json files allowlist must exist").toBe(true);
    // Order-insensitive: add/remove drift is what matters, not list order.
    expect([...docFiles].sort()).toEqual([...PKG.files].sort());
  });

  it("the doc states no exact tarball file total — the dry-run is the count of record", () => {
    docText.split("\n").forEach((line, i) => {
      const hit = TARBALL_COUNT.exec(line);
      expect(
        hit,
        `${DOC}:${i + 1} states an exact tarball size ("${hit?.[0]}"); it rots when the ` +
          `product surface grows. Use durable wording — the npm pack dry-run listing is the ` +
          `count of record (regressed by packaging-dry-run-contract.test.mjs).`,
      ).toBeNull();
    });
  });

  it("the count ban is non-vacuous: it catches the stale spellings, not the version", () => {
    expect(TARBALL_COUNT.test("a 47 files tarball")).toBe(true);
    expect(TARBALL_COUNT.test("a 47-file product tarball")).toBe(true);
    expect(TARBALL_COUNT.test("~161 files not gitignored")).toBe(true);
    expect(TARBALL_COUNT.test("version `0.1.0`"), "the version is not a tarball count").toBe(false);
    expect(TARBALL_COUNT.test("the product surface only"), "durable wording is allowed").toBe(false);
  });

  it("the two formerly-missing product docs are in both the manifest and the doc", () => {
    const docFiles = parseDocAllowlist(docText);
    for (const doc of ["docs/agent-setup.md", "docs/init-from-repo.md"]) {
      expect(PKG.files, `package.json files allowlist must include ${doc}`).toContain(doc);
      expect(docFiles, `${DOC} allowlist must include ${doc}`).toContain(doc);
    }
  });

  it("this audit is declarative: no process spawning in this file", () => {
    const self = readFileSync(fileURLToPath(import.meta.url), "utf8");
    expect(self, "packaging-doc sync must stay a prose audit").not.toMatch(
      /from\s+["']node:child_process["']/,
    );
  });
});
