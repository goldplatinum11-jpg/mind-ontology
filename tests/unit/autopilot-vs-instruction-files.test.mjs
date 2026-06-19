import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-vs-instruction-files-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot vs per-tool instruction files v1 (A56)", () => {
  it("ships the comparison doc", () => {
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

  it("names the per-tool instruction files and the drift problem", () => {
    const t = text();
    expect(t).toContain("CLAUDE.md");
    expect(t).toContain("AGENTS.md");
    expect(t.toLowerCase()).toMatch(/drift between tools|quietly disagree|compounds/);
  });

  it("contrasts N hand-synced files with one compiled constitution", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/one compiled constitution/);
    expect(lower).toMatch(/task-scoped pack per step/);
    expect(lower).toMatch(/constraints\.md always included|safety floor/);
  });

  it("clarifies it does not forbid a tool-specific instruction file", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/does not forbid your `claude\.md`|can still exist/);
    expect(lower).toMatch(/shared meaning/);
  });

  it("links portability and the reading protocol", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-portability-v1.md");
    expect(t).toContain("mind-ontology-autopilot-reading-protocol-v1.md");
  });
});
