import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-cost-model-v1.md");

const text = () => readFileSync(DOC, "utf8");

describe("autopilot cost model v1 (A59)", () => {
  it("ships the cost-model doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("states the free local path has no per-call cost, rate limit, or outage", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/no per-call cost/);
    expect(lower).toMatch(/no rate limit/);
    expect(lower).toMatch(/no outage/);
  });

  it("names the hosted layer as the one paid axis, opt-in and off by default", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/one paid axis|only paid axis|paid axis/);
    expect(lower).toMatch(/opt-in,\s+fail-closed,\s+and off by default|off by default/);
  });

  it("ties the cost to the runway being practical", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/thousands of context reads|5-hour runway|stopless runway/);
  });

  it("links why-local-first and commercial positioning", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-why-local-first-v1.md");
    expect(t).toContain("mind-ontology-commercial-positioning-v0.md");
  });
});
