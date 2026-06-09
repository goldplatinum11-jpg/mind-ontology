import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const README = resolve(REPO_ROOT, "README.md");

const text = () => readFileSync(README, "utf8");

describe("top-level README points at the autopilot pack (A34)", () => {
  it("links the autopilot pack frame doc", () => {
    expect(text()).toContain("docs/mind-ontology-autopilot-pack-v1.md");
    expect(text()).toContain("Autopilot Integration Pack");
  });

  it("keeps the mention local-first / no hosted SIRT", () => {
    const t = text();
    const idx = t.indexOf("Autopilot Integration Pack");
    // Look at the surrounding sentence (before and after the link).
    const window = t.slice(Math.max(0, idx - 80), idx + 200).toLowerCase();
    expect(window).toMatch(/local-first/);
    expect(window).toMatch(/no hosted sirt/);
  });

  it("the linked frame doc actually exists", () => {
    expect(existsSync(resolve(REPO_ROOT, "docs/mind-ontology-autopilot-pack-v1.md"))).toBe(true);
  });

  it("does not disturb the existing README contract markers", () => {
    const t = text();
    // The risk example and fail-closed note that risk-modes-doc.test.mjs relies on.
    expect(t).toContain("--risk auto");
    expect(t.toLowerCase()).toContain("fails closed");
    // No hosted host or secret introduced.
    expect(t.toLowerCase()).not.toMatch(/sirtai\.org|workers\.dev|bearer [a-z0-9]/);
  });
});
