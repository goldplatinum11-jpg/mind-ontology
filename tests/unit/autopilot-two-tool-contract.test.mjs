import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-two-tool-contract-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot two-tool contract v1 (A28)", () => {
  it("ships the two-tool contract doc", () => {
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

  it("specifies both tools with their input/return shape", () => {
    const t = text();
    expect(t).toContain("get_context(task, scope?)");
    expect(t).toContain("list_constraints()");
    const lower = t.toLowerCase();
    expect(lower).toMatch(/task-scoped context pack|selected blocks/);
    expect(lower).toMatch(/every constraint block|non-negotiable floor/);
  });

  it("guarantees exactly two, read-only, no third tool", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/exactly two tools/);
    expect(lower).toMatch(/read-only/);
    expect(lower).toMatch(/no memory tool|no third tool|no writeback tool/);
  });

  it("names no tool other than the two read-only ones", () => {
    const lower = text().toLowerCase();
    // No hosted SIRT tool tokens should leak into the contract surface.
    expect(lower).not.toMatch(/sirt_|search_hybrid|node_put|writeback_execute/);
  });

  it("frames the surface as local with no hidden network and links the protocol", () => {
    const t = text();
    const lower = t.toLowerCase();
    expect(lower).toMatch(/no hidden network|make no network call|no outbound request/);
    expect(t).toContain("mind-ontology-autopilot-reading-protocol-v1.md");
    expect(t).toContain("agentctx-mcp.md");
  });
});
