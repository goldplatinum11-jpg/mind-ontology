import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ENRICHMENT_HEADER,
  hasEnrichment,
  renderEnrichmentSection,
} from "../../scripts/agentctx/adapters/enrichment.mjs";
import { retrieveMemory } from "../../scripts/agentctx/adapters/memory-adapter.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = resolve(REPO_ROOT, "tests/fixtures/hosted-memory-enrichment.sample.json");

function loadFixture() {
  return JSON.parse(readFileSync(FIXTURE, "utf8"));
}

describe("hosted-memory enrichment (P4-PR07)", () => {
  it("renders nothing when there are no results (flag-off / null adapter parity)", () => {
    expect(renderEnrichmentSection([])).toBe("");
    expect(renderEnrichmentSection(undefined)).toBe("");
    expect(hasEnrichment(renderEnrichmentSection([]))).toBe(false);
  });

  it("renders a labeled, separated section from the sample fixture", () => {
    const { results } = loadFixture();
    const section = renderEnrichmentSection(results);
    expect(section).toContain(ENRICHMENT_HEADER);
    expect(section.toLowerCase()).toContain("separate from local source blocks");
    expect(section).toContain("mem-001");
    expect(hasEnrichment(section)).toBe(true);
  });

  it("drops malformed results from the section", () => {
    const section = renderEnrichmentSection([
      { id: "ok", text: "good" },
      { id: "", text: "bad" },
      { text: "no id" },
    ]);
    expect(section).toContain("ok");
    expect(section).not.toContain("no id");
  });

  it("flows from a fixture-backed adapter through retrieveMemory into a section", async () => {
    const { results, query } = loadFixture();
    const adapter = { name: "fixture", async retrieve() { return { results }; } };
    const out = await retrieveMemory(adapter, query);
    expect(out.degraded).toBe(false);
    const section = renderEnrichmentSection(out.results);
    expect(hasEnrichment(section)).toBe(true);
    expect(out.results.length).toBe(3);
  });

  it("the fixture carries no credential or endpoint", () => {
    const raw = readFileSync(FIXTURE, "utf8");
    expect(raw).not.toMatch(/\bbearer\s+[A-Za-z0-9._-]{12,}/i);
    expect(raw).not.toMatch(/https?:\/\/[a-z0-9.-]+/i);
  });
});
