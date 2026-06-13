import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-stop-policy-v1.md");

const text = () => readFileSync(DOC, "utf8").toLowerCase();

describe("autopilot stop policy v1 (A3)", () => {
  it("ships the stop policy doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("enumerates the valid terminal stop conditions", () => {
    const t = text();
    for (const phrase of [
      "operator stop",
      "deploy",
      "secrets",
      "irreversible",
      "forbidden-scope",
      "auth failure",
    ]) {
      expect(t).toContain(phrase);
    }
    // The repeat-blocker rule must be present.
    expect(t).toMatch(/same hard blocker repeats three times|repeats three times/);
  });

  it("pins the valid terminal definition as a closed, categorized set", () => {
    const t = text();
    // The valid list is exhaustive ("only"), not a set of examples. This
    // closure is what lets the controller "continue unless a valid terminal
    // condition is met" — drop the "only" and any reason becomes terminal.
    expect(t).toMatch(/may stop only when one of these is true/);
    expect(t).toMatch(/the only legitimate reasons to end a runway early/);
    // Every valid condition reduces to one of exactly three categories.
    for (const category of [
      "safety boundary",
      "budget boundary",
      "genuine dead end",
    ]) {
      expect(t).toContain(category);
    }
  });

  it("marks completed-work signals as invalid stop conditions", () => {
    const t = text();
    for (const phrase of [
      "tests passed",
      "docs updated",
      "templates created",
      "git commit was denied",
      "no remote",
    ]) {
      expect(t).toContain(phrase);
    }
  });

  it("states the safe-continuation principle, not safe-stopping", () => {
    const t = text();
    expect(t).toMatch(/safe continuation/);
    expect(t).toMatch(/more safe, in-scope work is not a stopping condition|next action/);
  });

  it("keeps the live-write boundary fail-closed regardless of continuation", () => {
    const t = text();
    expect(t).toMatch(/fails closed|fail-closed|off by default/);
    expect(t).toMatch(/writeback proposal-only|proposal-only/);
  });
});
