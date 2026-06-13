import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-two-roles-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot why two roles v1 (A49)", () => {
  it("ships the two-roles doc", () => {
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

  it("defines worker and controller and the no-self-approval property", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/\*\*worker\*\*/);
    expect(lower).toMatch(/\*\*controller\*\*/);
    expect(lower).toMatch(/no self-approval/);
    expect(lower).toMatch(/builder and the approver are not the same/);
  });

  it("notes commit authority sits with review", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/commit authority sits with review|the controller commits/);
    expect(lower).toMatch(/denied\s+worker commit is never a blocker/);
  });

  it("concedes one agent is enough for single-shot", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/when one agent is enough|single-shot/);
  });

  it("links the protocol, controller checklist, and self-check", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-reading-protocol-v1.md");
    expect(t).toContain("mind-ontology-autopilot-controller-checklist-v1.md");
    expect(t).toContain("mind-ontology-autopilot-worker-selfcheck-v1.md");
  });
});
