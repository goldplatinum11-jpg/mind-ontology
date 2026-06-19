import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-extending-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("extending the autopilot pack v1 (A54)", () => {
  it("ships the contributor doc", () => {
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

  it("documents the four-step doc invariant", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/name it `-v1\.md`|name it.*-v1/);
    expect(lower).toMatch(/index it/);
    expect(lower).toMatch(/link the frame/);
    expect(lower).toMatch(/list it in the manifest/);
  });

  it("covers kit-template and fixture rules", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/adding\s+a kit template/);
    expect(lower).toMatch(/adding\s+a fixture/);
    expect(lower).toMatch(/vocabulary disjoint|wrong-axis/);
  });

  it("passes on the guard-authoring lessons (so new guards don't flake)", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/\\s\+ between words|soft-wrap/);
    expect(lower).toMatch(/window before \*and\* after|actual heading/);
  });

  it("links the manifest and non-goals", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-manifest-v1.md");
    expect(t).toContain("mind-ontology-autopilot-non-goals-v1.md");
  });
});
