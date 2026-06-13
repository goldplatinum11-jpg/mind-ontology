import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  GUARD_TEST_PATTERN,
  LEAKAGE_PATTERN,
  RESULT_PACK_REQUIRED_KEYS,
  validateResultPack,
} from "../../scripts/agentctx/result-pack.mjs";

// W9 rewired this guard through the shared shape module (result-pack.mjs) so
// the test and `mind-ontology review` enforce one set of rules. The coverage
// is unchanged from the original A14 guard; the rules just live in the engine
// now, asserted here against the example pack and the doc.

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-result-pack-v1.md");
const EXAMPLE = resolve(REPO_ROOT, "tests/fixtures/autopilot-result-pack.example.json");

const pack = JSON.parse(readFileSync(EXAMPLE, "utf8"));
const docText = readFileSync(DOC, "utf8");

// The runway sub-keys the doc's `runway` table documents and the fixture must
// carry. Pinned as a field list so the doc/fixture surface can't silently drop
// one — prose self-consistency (below) only guards the stop-state semantics.
const RUNWAY_SUBKEYS = [
  "checkpoint",
  "valid_terminal_stop_reached",
  "reason_for_continuation",
];

describe("autopilot result-pack shape guard (A14)", () => {
  it("the example pack passes every shared shape invariant", () => {
    const { ok, violations } = validateResultPack(pack);
    expect(violations).toEqual([]);
    expect(ok).toBe(true);
  });

  it("the example pack carries every required key with the right type", () => {
    for (const [key, type] of Object.entries(RESULT_PACK_REQUIRED_KEYS)) {
      expect(pack, `missing key: ${key}`).toHaveProperty(key);
      expect(typeof pack[key], `wrong type for ${key}`).toBe(type);
    }
  });

  it("the doc documents every required key it claims to enforce", () => {
    for (const key of Object.keys(RESULT_PACK_REQUIRED_KEYS)) {
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
      expect(adl.guard_test).toMatch(GUARD_TEST_PATTERN);
    }
  });

  it("the doc documents every runway sub-key", () => {
    for (const key of RUNWAY_SUBKEYS) {
      expect(docText, `doc omits runway sub-key: ${key}`).toContain(key);
    }
  });

  it("the example pack's runway object provides every runway sub-key", () => {
    for (const key of RUNWAY_SUBKEYS) {
      expect(pack.runway, `runway omits sub-key: ${key}`).toHaveProperty(key);
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
    expect(LEAKAGE_PATTERN.test(JSON.stringify(pack).toLowerCase())).toBe(false);
  });

  it("the doc states the handoff needs no hosted ingest", () => {
    const lower = docText.toLowerCase();
    expect(lower).toMatch(/no hosted sirt ingest|without.*hosted|copy-paste is the transport/);
    expect(lower).toMatch(/fail-closed|optional/);
  });
});
