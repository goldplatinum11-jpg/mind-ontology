import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-tool-call-ordering-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot tool-call ordering v1 (A62)", () => {
  it("ships the ordering doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("fixes the within-step sequence: get_context first, list_constraints before the risky write", () => {
    const t = text();
    const lower = t.toLowerCase();
    expect(t).toContain("get_context(task)");
    expect(t).toContain("list_constraints()");
    expect(lower).toMatch(/before inspecting or editing/);
    expect(lower).toMatch(/before the risky write — not after|before.*performing it/);
  });

  it("states the rule of thumb", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/context before action,\s+constraints before the irreversible/);
  });

  it("argues order matters, not just presence", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/order matters, not just presence|presence is necessary but not sufficient/);
    expect(lower).toMatch(/edit was made blind|made blind/);
  });

  it("links the reading protocol and risk modes", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-reading-protocol-v1.md");
    expect(t).toContain("mind-ontology-autopilot-risk-modes-v1.md");
  });
});
