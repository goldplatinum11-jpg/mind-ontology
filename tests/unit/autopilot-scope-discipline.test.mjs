import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-scope-discipline-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot scope discipline v1 (A29)", () => {
  it("ships the scope-discipline doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("states the edit-inside-allowed-scope rule and the forbidden wall", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/allowed write scope/);
    expect(lower).toMatch(/forbidden scope|forbidden path/);
    expect(lower).toMatch(/wall, not a hurdle/);
  });

  it("gives the stop/revert/report procedure for an out-of-scope edit", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/stop and assess/);
    expect(lower).toMatch(/git checkout -- /);
    expect(lower).toMatch(/valid terminal stop/);
  });

  it("covers the lockfile-hygiene trap with the exact revert command", () => {
    const t = text();
    expect(t).toContain("package-lock.json");
    expect(t).toContain("git checkout -- package-lock.json");
    expect(t.toLowerCase()).toMatch(/forbidden_scope_touched.*false|node_modules.*stays installed/);
  });

  it("is local and links the controller checklist + self-check", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-controller-checklist-v1.md");
    expect(t).toContain("mind-ontology-autopilot-worker-selfcheck-v1.md");
    expect(t.toLowerCase()).toMatch(/local|no.*hosted/);
  });
});
