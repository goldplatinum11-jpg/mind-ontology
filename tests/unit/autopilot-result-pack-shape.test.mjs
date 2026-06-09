import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-result-pack-v1.md");
const EXAMPLE = resolve(REPO_ROOT, "tests/fixtures/autopilot-result-pack.example.json");

const pack = JSON.parse(readFileSync(EXAMPLE, "utf8"));
const docText = readFileSync(DOC, "utf8");

const REQUIRED = {
  schema: "string",
  lane: "string",
  branch: "string",
  status: "string",
  runway: "object",
  write_scope_respected: "boolean",
  forbidden_scope_touched: "boolean",
  adls_completed: "object",
  validation: "object",
  uncommitted_changes: "object",
  handoff: "string",
};

describe("autopilot result-pack shape guard (A14)", () => {
  it("the example pack carries every required key with the right type", () => {
    for (const [key, type] of Object.entries(REQUIRED)) {
      expect(pack, `missing key: ${key}`).toHaveProperty(key);
      expect(typeof pack[key], `wrong type for ${key}`).toBe(type);
    }
  });

  it("the doc documents every required key it claims to enforce", () => {
    for (const key of Object.keys(REQUIRED)) {
      expect(docText, `doc omits key: ${key}`).toContain(key);
    }
  });

  it("a clean handoff never admits a forbidden-scope write", () => {
    expect(pack.forbidden_scope_touched).toBe(false);
    expect(pack.write_scope_respected).toBe(true);
  });

  it("adls_completed is non-empty and each entry names a guard test", () => {
    expect(Array.isArray(pack.adls_completed)).toBe(true);
    expect(pack.adls_completed.length).toBeGreaterThan(0);
    for (const adl of pack.adls_completed) {
      expect(adl).toHaveProperty("id");
      expect(adl).toHaveProperty("guard_test");
      expect(adl.guard_test).toMatch(/tests\/unit\/.+\.test\.mjs$/);
    }
  });

  it("the runway stop-state is self-consistent", () => {
    expect(pack.runway).toHaveProperty("checkpoint");
    expect(typeof pack.runway.checkpoint).toBe("number");
    if (pack.runway.valid_terminal_stop_reached === false) {
      expect(pack.status).toBe("in-progress");
      expect(typeof pack.runway.reason_for_continuation).toBe("string");
      expect(pack.runway.reason_for_continuation.length).toBeGreaterThan(0);
    }
  });

  it("the example pack embeds no hosted endpoint, token, or private clone path", () => {
    const blob = JSON.stringify(pack).toLowerCase();
    expect(blob).not.toMatch(/sirtai\.org|workers\.dev|bearer |authorization/);
    expect(blob).not.toContain("sirt-app-v2");
  });

  it("the doc states the handoff needs no hosted ingest", () => {
    const lower = docText.toLowerCase();
    expect(lower).toMatch(/no hosted sirt ingest|without.*hosted|copy-paste is the transport/);
    expect(lower).toMatch(/fail-closed|optional/);
  });
});
