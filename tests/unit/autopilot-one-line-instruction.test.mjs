import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-one-line-instruction-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot canonical one-line instruction v1 (A61)", () => {
  it("ships the one-line instruction doc", () => {
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

  it("contains the canonical instruction string naming both tools", () => {
    const t = text();
    expect(t).toMatch(/at task start, call get_context\(task\)/i);
    expect(t).toMatch(/before destructive or structural/i);
    expect(t).toContain("list_constraints()");
  });

  it("explains why two sentences are enough (one per tool)", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/two sentences are enough/);
    expect(lower).toMatch(/right-axis read/);
    expect(lower).toMatch(/safety re-read/);
  });

  it("notes the kit cheat-sheet and example prompt embed exactly this string", () => {
    const t = text();
    expect(t).toContain("templates/mind-ontology/autopilot/cheat-sheet.md");
    expect(t).toContain("templates/mind-ontology/autopilot/example-codex-agent.md");
  });

  it("the kit cheat-sheet and example prompt really do contain both tools", () => {
    const cheat = readFileSync(resolve(REPO_ROOT, "templates/mind-ontology/autopilot/cheat-sheet.md"), "utf8");
    const example = readFileSync(resolve(REPO_ROOT, "templates/mind-ontology/autopilot/example-codex-agent.md"), "utf8");
    for (const f of [cheat, example]) {
      expect(f).toContain("get_context(task)");
      expect(f).toContain("list_constraints()");
    }
  });
});
