import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-onboarding-client-v1.md");
const PKG = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));
const text = () => readFileSync(DOC, "utf8");

describe("autopilot onboarding a new client v1 (A75)", () => {
  it("ships the onboarding doc", () => {
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
  it("gives the three onboarding steps: point, instruct, verify", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/point it at the same entrypoint/);
    expect(lower).toMatch(/give it the one-line instruction/);
    expect(lower).toMatch(/3\.\s*\*\*verify/);
  });
  it("names the kit configs and the two tools", () => {
    const t = text();
    expect(t).toContain("autopilot.mcp.json");
    expect(t).toContain("autopilot-codex.toml");
    expect(t).toContain("get_context(task)");
    expect(t).toContain("list_constraints");
  });
  it("cites only npm scripts that exist", () => {
    for (const s of new Set([...text().matchAll(/npm run ([a-z:]+)/g)].map((m) => m[1]))) {
      expect(PKG.scripts, `cited missing script: ${s}`).toHaveProperty(s);
    }
  });
  it("links portability and the one-line instruction", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-portability-v1.md");
    expect(t).toContain("mind-ontology-autopilot-one-line-instruction-v1.md");
  });
});
