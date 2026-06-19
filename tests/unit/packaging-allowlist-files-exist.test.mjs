import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => readFileSync(resolve(REPO_ROOT, p), "utf8").replace(/\r\n/g, "\n");
const PKG = JSON.parse(read("package.json"));

// root-doc-public-surface-sweep-v1 — packaging manifest ⇄ filesystem audit.
//
// packaging-doc-allowlist-sync.test.mjs ties the doc snippet to package.json
// `files`, and packaging-dry-run-contract.test.mjs inspects the live pack. But a
// gap sat between them: nothing checked that the allowlist entries actually
// resolve on disk. The doc-sync guard only proves the doc and the manifest agree
// *with each other* — if a shipped doc is renamed or deleted and the manifest
// entry left dangling, the doc and manifest stay mutually consistent (both
// stale) and that test still passes. The dry-run guard only spot-checks a couple
// of docs by name and bounds the total under 60, so a thinned tarball from a
// dead allowlist entry slips through silently.
//
// This guard closes that gap mechanically: every concrete entry in `files` must
// resolve to a real file, and every glob entry's base directory must exist and
// contain at least one file. Derived straight from package.json (the source of
// truth) against the working tree — no hand-copied list to rot. Declarative:
// no process spawning, CRLF-normalized like the sibling doc audits.

// Recursively count files under a directory; stop early once one is found.
const hasAnyFile = (absDir) => {
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    if (entry.isFile()) return true;
    if (entry.isDirectory() && hasAnyFile(resolve(absDir, entry.name))) return true;
  }
  return false;
};

const existsAsFile = (rel) => {
  try {
    return statSync(resolve(REPO_ROOT, rel)).isFile();
  } catch {
    return false;
  }
};

const existsAsDir = (rel) => {
  try {
    return statSync(resolve(REPO_ROOT, rel)).isDirectory();
  } catch {
    return false;
  }
};

describe("packaging allowlist entries resolve on disk (root-doc-public-surface-sweep-v1)", () => {
  it("package.json ships a non-empty `files` allowlist", () => {
    expect(Array.isArray(PKG.files), "package.json `files` allowlist must exist").toBe(true);
    expect(PKG.files.length, "the allowlist must not be empty").toBeGreaterThan(0);
  });

  it("no allowlist entry is absolute or escapes the repo", () => {
    for (const entry of PKG.files) {
      expect(typeof entry, `allowlist entry ${JSON.stringify(entry)} must be a string`).toBe(
        "string",
      );
      expect(
        /^([a-zA-Z]:[\\/]|[\\/])/.test(entry) || entry.split(/[\\/]/).includes(".."),
        `allowlist entry "${entry}" must stay a repo-relative path (no absolute, no ..)`,
      ).toBe(false);
    }
  });

  it("every concrete allowlist entry resolves to an existing file", () => {
    const concrete = PKG.files.filter((e) => !e.includes("*"));
    // Sanity: the allowlist still names concrete files (the docs), not only globs.
    expect(concrete.length, "expected concrete file entries in the allowlist").toBeGreaterThan(0);
    for (const entry of concrete) {
      expect(
        existsAsFile(entry),
        `package.json \`files\` lists "${entry}", which is not a file on disk — ` +
          `the allowlist points at a renamed/deleted path and the published tarball would silently thin.`,
      ).toBe(true);
    }
  });

  it("every glob allowlist entry has an existing, non-empty base directory", () => {
    const globs = PKG.files.filter((e) => e.includes("*"));
    // The engine + templates ship via globs; this is the load-bearing product surface.
    expect(globs.length, "expected glob entries (engine + templates) in the allowlist").toBeGreaterThan(0);
    for (const entry of globs) {
      const base = entry.slice(0, entry.indexOf("*")).replace(/[\\/]+$/, "");
      expect(base, `glob entry "${entry}" must have a base directory before the wildcard`).not.toBe(
        "",
      );
      expect(
        existsAsDir(base),
        `package.json \`files\` glob "${entry}" has no base directory "${base}/" on disk.`,
      ).toBe(true);
      expect(
        hasAnyFile(resolve(REPO_ROOT, base)),
        `package.json \`files\` glob "${entry}" matches no files — base "${base}/" is empty, ` +
          `so this slice of the product surface would not ship.`,
      ).toBe(true);
    }
  });

  it("this audit is declarative: no process spawning in this file", () => {
    const self = readFileSync(fileURLToPath(import.meta.url), "utf8");
    expect(self, "manifest ⇄ filesystem audit must stay a declarative check").not.toMatch(
      /from\s+["']node:child_process["']/,
    );
  });
});
