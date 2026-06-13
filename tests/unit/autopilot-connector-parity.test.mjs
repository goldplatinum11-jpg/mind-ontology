import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-connector-parity-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot connector parity v1 (A39)", () => {
  it("ships the connector-parity doc", () => {
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

  it("states the connector mirrors exactly the two read-only operations", () => {
    const t = text();
    expect(t).toContain("get_context");
    expect(t).toContain("list_constraints");
    const lower = t.toLowerCase();
    expect(lower).toMatch(/no.*third operation|no write path/);
    expect(lower).toMatch(/chatgpt|claude\.ai/);
  });

  it("keeps the connector self-hosted, placeholder-only, credential-free", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/self-hosted/);
    expect(lower).toMatch(/placeholder/);
    expect(lower).toMatch(/no endpoint|no credential|credential-free|no.*token/);
  });

  it("embeds no real hosted host or secret", () => {
    const lower = text().toLowerCase();
    expect(lower).not.toMatch(/sirtai\.org|workers\.dev|bearer [a-z0-9]/);
  });

  it("links portability and the two-tool contract", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-portability-v1.md");
    expect(t).toContain("mind-ontology-autopilot-two-tool-contract-v1.md");
  });
});
