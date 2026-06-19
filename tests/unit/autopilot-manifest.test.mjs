import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-manifest-v1.md");
const KIT_DIR = resolve(REPO_ROOT, "templates/mind-ontology/autopilot");
const KIT_README = resolve(KIT_DIR, "README.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot pack manifest v1 (A37)", () => {
  it("ships the manifest doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("pins the top-of-doc Autopilot Integration Pack header back-link", () => {
    // The pack header back-link lives in the doc header, above the first
    // horizontal rule. Pin it structurally (scoped to the header, with the
    // exact link target) so the A-series pack frame can't silently drop off
    // the top of this doc without its owning public-surface test failing.
    const header = text().split("\n---")[0];
    expect(header).toContain(
      "Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).",
    );
  });

  it("covers docs, templates, fixtures, and tests sections", () => {
    const t = text();
    expect(t).toMatch(/## Docs/);
    expect(t).toMatch(/## Templates/);
    expect(t).toMatch(/## Fixtures/);
    expect(t).toMatch(/## Tests/);
  });

  it("every docs/*.md the manifest lists exists on disk", () => {
    const linked = [...text().matchAll(/\(([a-z0-9-]+\.md)\)/g)].map((m) => m[1]);
    expect(linked.length).toBeGreaterThanOrEqual(15);
    for (const doc of new Set(linked)) {
      expect(existsSync(resolve(REPO_ROOT, "docs", doc)), `manifest lists missing doc: ${doc}`).toBe(true);
    }
  });

  it("names every template kit file that exists on disk", () => {
    const t = text();
    for (const f of readdirSync(KIT_DIR)) {
      expect(t, `manifest omits kit file: ${f}`).toContain(f);
    }
  });

  it("keeps the local-first / OSS-safe framing", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/local-first/);
    expect(lower).toMatch(/no hosted sirt/);
  });
});

describe("autopilot kit completeness (A37)", () => {
  it("every file in the kit dir is documented in the kit README", () => {
    const readme = readFileSync(KIT_README, "utf8");
    for (const f of readdirSync(KIT_DIR)) {
      if (f === "README.md") continue;
      expect(readme, `kit README omits ${f}`).toContain(f);
    }
  });
});
