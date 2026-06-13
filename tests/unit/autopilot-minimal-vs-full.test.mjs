import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileFromCwd } from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const MINIMAL = resolve(REPO_ROOT, "tests/fixtures/autopilot-minimal");
const FULL = resolve(REPO_ROOT, "tests/fixtures/autopilot-line");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-minimal-vs-full-v1.md");

function pack(cwd, task, riskMode) {
  return JSON.parse(compileFromCwd({ cwd, task, scopes: [], format: "json", riskMode }));
}

describe("autopilot minimal vs full ontology v1 (A27)", () => {
  it("ships the doc and the minimal fixture", () => {
    expect(existsSync(DOC)).toBe(true);
    expect(existsSync(resolve(MINIMAL, ".agentctx/constraints.md"))).toBe(true);
  });

  it("pins the top-of-doc Autopilot Integration Pack header back-link", () => {
    // The pack header back-link lives in the doc header, above the first
    // horizontal rule. Pin it structurally (scoped to the header, with the
    // exact link target) so the A-series pack frame can't silently drop off
    // the top of this doc without its owning public-surface test failing.
    const header = readFileSync(DOC, "utf8").split("\n---")[0];
    expect(header).toContain(
      "Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).",
    );
  });

  it("a constraints-only line still compiles a valid pack with the safety floor", () => {
    const p = pack(MINIMAL, "Plan the next docs PR");
    const files = p.selected.map((b) => b.file);
    expect(files).toContain("constraints.md");
    // Every selected block from the minimal line is from constraints.md.
    expect(files.every((f) => f === "constraints.md")).toBe(true);
  });

  it("the minimal line still forces safety on a risky task", () => {
    const p = pack(MINIMAL, "Delete the production database and drop the orders table");
    expect(p.risk.level).toBe("risky");
    const files = p.selected.map((b) => b.file);
    expect(files).toContain("constraints.md");
  });

  it("the full line earns non-constraints blocks the minimal line cannot", () => {
    const minimal = pack(MINIMAL, "What direction is this autopilot line building toward?");
    const full = pack(FULL, "What direction is this autopilot line building toward?");
    const minimalFiles = new Set(minimal.selected.map((b) => b.file));
    const fullFiles = new Set(full.selected.map((b) => b.file));
    expect(minimalFiles.has("direction.md")).toBe(false);
    expect(fullFiles.has("direction.md")).toBe(true);
  });

  it("the doc frames the schema as a spectrum, both ends local-first", () => {
    const lower = readFileSync(DOC, "utf8").toLowerCase();
    expect(lower).toMatch(/spectrum/);
    expect(lower).toMatch(/always included|always-included/);
    expect(lower).toMatch(/no hosted sirt|local-first/);
  });
});
