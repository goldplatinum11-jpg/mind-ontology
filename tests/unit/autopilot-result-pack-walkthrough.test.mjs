import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-result-pack-walkthrough-v1.md");
const EXAMPLE = resolve(REPO_ROOT, "tests/fixtures/autopilot-result-pack.example.json");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot result-pack walkthrough v1 (A31)", () => {
  it("ships the walkthrough doc and the example it annotates", () => {
    expect(existsSync(DOC)).toBe(true);
    expect(existsSync(EXAMPLE)).toBe(true);
  });

  it("annotates every required field of the example pack", () => {
    const example = JSON.parse(readFileSync(EXAMPLE, "utf8"));
    const t = text();
    for (const key of Object.keys(example)) {
      if (key.startsWith("_")) continue;
      expect(t, `walkthrough omits field: ${key}`).toContain(key);
    }
  });

  it("gives the controller a concrete reading order", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/reading order/);
    expect(lower).toMatch(/forbidden_scope_touched.*reject|if .*true.*reject/);
  });

  it("keeps the no-hosted-ingest framing and references the shape guard", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-result-pack-v1.md");
    expect(t.toLowerCase()).toMatch(/no hosted sirt\s+ingest|copy-paste is the transport/);
  });

  it("pins the top-of-doc Autopilot Integration Pack header back-link", () => {
    expect(text()).toContain(
      "Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).",
    );
  });
});
