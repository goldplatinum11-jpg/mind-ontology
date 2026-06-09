import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOCS = resolve(REPO_ROOT, "docs");
const MANIFEST = readFileSync(resolve(DOCS, "mind-ontology-autopilot-manifest-v1.md"), "utf8");

// Every autopilot doc on disk, and every autopilot doc the manifest references.
// The manifest does not list itself, so exclude it from both sets.
const SELF = "mind-ontology-autopilot-manifest-v1.md";
const onDisk = new Set(
  readdirSync(DOCS).filter((f) => /^mind-ontology-autopilot-.*\.md$/.test(f) && f !== SELF),
);
const inManifest = new Set(
  [...MANIFEST.matchAll(/mind-ontology-autopilot-[a-z0-9-]+-v1\.md/g)]
    .map((m) => m[0])
    .filter((d) => d !== SELF),
);

describe("autopilot manifest freshness (A74)", () => {
  it("the manifest references every autopilot doc on disk (nothing missing)", () => {
    const missing = [...onDisk].filter((d) => !inManifest.has(d));
    expect(missing, `manifest is missing: ${missing.join(", ")}`).toEqual([]);
  });

  it("the manifest references no autopilot doc that is not on disk (nothing stale)", () => {
    const stale = [...inManifest].filter((d) => !onDisk.has(d));
    expect(stale, `manifest references nonexistent: ${stale.join(", ")}`).toEqual([]);
  });

  it("the on-disk and manifest sets are exactly equal", () => {
    expect([...onDisk].sort()).toEqual([...inManifest].sort());
  });
});
