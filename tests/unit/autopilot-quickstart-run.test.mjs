import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-quickstart-run-v1.md");
const PKG = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));

const text = () => readFileSync(DOC, "utf8");

describe("autopilot quickstart run v1 (A18)", () => {
  it("ships the worked-run doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("every cited `npm run <script>` exists in package.json", () => {
    const cited = [...text().matchAll(/npm run ([a-z:]+)/g)].map((m) => m[1]);
    expect(cited.length).toBeGreaterThanOrEqual(4);
    for (const script of new Set(cited)) {
      expect(PKG.scripts, `cited missing script: ${script}`).toHaveProperty(script);
    }
  });

  it("shows a right-axis step, a risky-forcing step, and a verify step", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/right-axis/);
    expect(lower).toMatch(/risk-forced|--risk auto|forces safety/);
    expect(lower).toContain("agentctx:proof");
    expect(lower).toContain("agentctx:validate");
  });

  it("demonstrates the wrong-axis call returns only the safety floor (no dump)", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/wrong-axis|does \*\*not\*\* dump|safety floor/);
    expect(lower).toMatch(/memory adapter/);
  });

  it("keeps the local-first / no-hosted framing", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/no account/);
    expect(lower).toMatch(/no hosted|fail-closed|optional hosted/);
  });

  it("pins the top-of-doc Autopilot Integration Pack header back-link", () => {
    expect(text()).toContain(
      "Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).",
    );
  });
});
