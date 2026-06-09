import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-failure-modes-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot failure modes v1 (A26)", () => {
  it("ships the failure-modes doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("enumerates the protocol-skip failures", () => {
    const lower = text().toLowerCase();
    for (const f of [
      "skipping `get_context`",
      "wrong-axis reasoning",
      "skipping `list_constraints`",
      "unscoped dump",
      "optimistic closeout",
    ]) {
      expect(lower, `missing failure: ${f}`).toContain(f);
    }
  });

  it("pairs every failure with a Symptom and a Containment", () => {
    const t = text();
    const symptoms = (t.match(/\*\*Symptom:\*\*/g) || []).length;
    const containments = (t.match(/\*\*Containment:\*\*/g) || []).length;
    expect(symptoms).toBeGreaterThanOrEqual(5);
    expect(containments).toBe(symptoms);
  });

  it("keeps every containment local — never a hosted fix", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/local and mechanical|no failure here is fixed by reaching for hosted/);
    expect(lower).toMatch(/fails closed|fail-closed/);
  });

  it("links the protocol, self-check, and controller-checklist it relies on", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-reading-protocol-v1.md");
    expect(t).toContain("mind-ontology-autopilot-worker-selfcheck-v1.md");
    expect(t).toContain("mind-ontology-autopilot-controller-checklist-v1.md");
  });
});
