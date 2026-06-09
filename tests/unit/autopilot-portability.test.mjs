import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-portability-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot portability across clients v1 (A32)", () => {
  it("ships the portability doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("names every supported client and the same two-tool surface", () => {
    const lower = text().toLowerCase();
    for (const client of ["claude code", "codex", "cursor", "chatgpt", "claude.ai"]) {
      expect(lower, `missing client: ${client}`).toContain(client);
    }
    expect(text()).toContain("get_context");
    expect(text()).toContain("list_constraints");
  });

  it("argues no-per-tool-drift and mixed-line agreement", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/no per-tool drift|drift/);
    expect(lower).toMatch(/mixed lines|cannot disagree|identical/);
  });

  it("keeps the local, no-account framing", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/local|no.*account|hosted sirt account/);
  });

  it("links the reading protocol and two-tool contract", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-reading-protocol-v1.md");
    expect(t).toContain("mind-ontology-autopilot-two-tool-contract-v1.md");
  });
});
