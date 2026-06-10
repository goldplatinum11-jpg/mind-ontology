import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => readFileSync(resolve(REPO_ROOT, p), "utf8");
const PKG = JSON.parse(read("package.json"));

// M47 — packaging is a documented DRY-RUN plan; publishing stays fail-closed.
describe("packaging stays a fail-closed dry-run plan (M47)", () => {
  it("ships the packaging doc and frames it as dry-run / no publish", () => {
    expect(existsSync(resolve(REPO_ROOT, "docs/packaging.md"))).toBe(true);
    const doc = read("docs/packaging.md");
    expect(doc).toContain("npm pack --dry-run");
    expect(doc.toLowerCase()).toContain("do not run `npm publish`".toLowerCase());
    expect(doc.toLowerCase()).toContain("fail-closed");
  });

  it("publish-ready: the private gate is removed; the files allowlist is applied (release prep)", () => {
    expect(PKG.private).toBeUndefined(); // gate moved to the explicit operator publish decision
    expect(PKG.license).toBe("Apache-2.0"); // license decided; publish gated by operator approval
    // The allowlist is APPLIED for the prepared 0.1.0 release.
    expect(Array.isArray(PKG.files)).toBe(true);
    expect(PKG.publishConfig).toBeUndefined();
  });

  it("the applied allowlist ships the engine + templates, not tests/examples", () => {
    const doc = read("docs/packaging.md");
    expect(doc).toContain("scripts/agentctx/**");
    expect(doc).toContain("templates/**");
    // explicitly documents excluding tests and examples from the tarball
    expect(doc).toContain("tests/**");
    expect(doc).toContain("docs/examples/**");
    // package.json and the doc agree on the engine + templates core
    expect(PKG.files).toContain("scripts/agentctx/**");
    expect(PKG.files).toContain("templates/**");
  });
});
