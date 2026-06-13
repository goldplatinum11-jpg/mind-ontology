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

// The doc's key table names the schema shape identifier `sirt.result-pack/v1`
// (the `e.g.` literal under the `schema` row). The required-key guard only
// pins `schema` as a string; this literal is the actual contract the
// controller keys on, so pin it as a constant the doc and fixture must both
// carry — neither can rename the shape without the other following.
const DOCUMENTED_SCHEMA_LITERAL = "sirt.result-pack/v1";

// The runway sub-keys the doc's `runway` table documents and the fixture must
// carry. Pinned as a field list so the doc/fixture surface can't silently drop
// one — prose self-consistency (below) only guards the stop-state semantics.
const RUNWAY_SUBKEYS = [
  "checkpoint",
  "valid_terminal_stop_reached",
  "reason_for_continuation",
];

// Each `validation` entry is a gate the worker ran. The doc's key table now
// names the entry fields inline (`command`, `result`, `passed`), mirroring the
// adls_completed / uncommitted_changes rows, so this list is both a
// fixture-shape pin and the doc-surface contract: every entry must name its
// `command`, its `result`, and a boolean `passed` verdict, so the controller
// can re-run the gate rather than trust the summary, and the doc can't silently
// drop one of the three documented field names.
const VALIDATION_ENTRY_FIELDS = ["command", "result", "passed"];

// The doc's key table names `uncommitted_changes` as "`added` / `modified`
// file lists for controller review", so both names are public surface. Pinned
// as a sub-key list (like RUNWAY_SUBKEYS) so the doc/fixture can't silently
// drop one, plus the fixture must carry both as arrays for the controller to
// read the diff without re-running git.
const UNCOMMITTED_CHANGES_SUBKEYS = ["added", "modified"];

// The doc's key table documents each `adls_completed` entry as "`id`, `title`,
// `artifact`, `guard_test`", so all four names are public surface. The existing
// guard above only pins `id` and `guard_test` (the re-runnable proof); pinned
// here as the full documented field list so the doc/fixture can't silently drop
// `title` or `artifact`, which the controller reads to label each ADL.
const ADLS_COMPLETED_ENTRY_FIELDS = ["id", "title", "artifact", "guard_test"];

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

  it("the doc documents every adls_completed entry field", () => {
    for (const field of ADLS_COMPLETED_ENTRY_FIELDS) {
      expect(docText, `doc omits adls_completed entry field: ${field}`).toContain(field);
    }
  });

  it("each adls_completed entry provides id, title, artifact, and guard_test", () => {
    for (const adl of pack.adls_completed) {
      for (const field of ADLS_COMPLETED_ENTRY_FIELDS) {
        expect(adl, `adls_completed entry omits field: ${field}`).toHaveProperty(field);
        expect(
          typeof adl[field],
          `adls_completed entry field ${field} is not a string`,
        ).toBe("string");
      }
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

  it("each validation entry names a command, a result, and a boolean passed", () => {
    expect(typeof pack.validation).toBe("object");
    expect(pack.validation).not.toBeNull();
    const entries = Object.entries(pack.validation);
    expect(entries.length).toBeGreaterThan(0);
    for (const [gate, entry] of entries) {
      expect(typeof entry, `validation.${gate} is not an object`).toBe("object");
      for (const field of VALIDATION_ENTRY_FIELDS) {
        expect(entry, `validation.${gate} omits ${field}`).toHaveProperty(field);
      }
      expect(typeof entry.command, `validation.${gate}.command is not a string`).toBe("string");
      expect(typeof entry.result, `validation.${gate}.result is not a string`).toBe("string");
      expect(typeof entry.passed, `validation.${gate}.passed is not a boolean`).toBe("boolean");
    }
  });

  it("the doc documents every validation entry field", () => {
    for (const field of VALIDATION_ENTRY_FIELDS) {
      expect(docText, `doc omits validation entry field: ${field}`).toContain(field);
    }
  });

  it("the doc documents every uncommitted_changes sub-key", () => {
    for (const key of UNCOMMITTED_CHANGES_SUBKEYS) {
      expect(docText, `doc omits uncommitted_changes sub-key: ${key}`).toContain(key);
    }
  });

  it("the example pack's uncommitted_changes provides added and modified as arrays", () => {
    expect(typeof pack.uncommitted_changes).toBe("object");
    expect(pack.uncommitted_changes).not.toBeNull();
    for (const key of UNCOMMITTED_CHANGES_SUBKEYS) {
      expect(pack.uncommitted_changes, `uncommitted_changes omits sub-key: ${key}`).toHaveProperty(key);
      expect(
        Array.isArray(pack.uncommitted_changes[key]),
        `uncommitted_changes.${key} is not an array`,
      ).toBe(true);
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

  it("the example pack's schema equals the documented shape literal", () => {
    expect(pack.schema).toBe(DOCUMENTED_SCHEMA_LITERAL);
  });

  it("the doc documents the schema shape literal", () => {
    expect(docText, `doc omits schema literal: ${DOCUMENTED_SCHEMA_LITERAL}`).toContain(
      DOCUMENTED_SCHEMA_LITERAL,
    );
  });

  it("the example pack's handoff is a non-empty string", () => {
    expect(typeof pack.handoff).toBe("string");
    expect(pack.handoff.trim().length).toBeGreaterThan(0);
  });

  // The doc documents `branch` as "the git branch the work landed on"; the
  // required-key guard only pins it as type string, so an empty string would
  // pass while naming no branch. Pin it as a non-empty string (mirroring the
  // handoff pin above) — the controller keys off this value to find the work.
  it("the example pack's branch is a non-empty string", () => {
    expect(typeof pack.branch).toBe("string");
    expect(pack.branch.trim().length).toBeGreaterThan(0);
  });

  // Many assertions above pin doc surface that the runtime guard
  // (validateResultPack) does not enforce — the schema literal, the table
  // sub-key names, non-empty branch/handoff. The doc now carries an explicit
  // note distinguishing the five runtime invariants from this test-pinned
  // documented surface, so a reader knows why those extra pins are load-bearing.
  // Pin the note's three load-bearing references (the engine module that holds
  // the runtime invariants, this shape test that holds the documented surface,
  // and the "test-pinned documented surface" concept) rather than its full
  // prose, so the distinction can't be dropped without this test failing while
  // leaving the wording free to change.
  it("the doc distinguishes runtime invariants from the test-pinned documented surface", () => {
    const lower = docText.toLowerCase();
    expect(lower).toContain("scripts/agentctx/result-pack.mjs");
    expect(lower).toContain("tests/unit/autopilot-result-pack-shape.test.mjs");
    expect(lower).toContain("test-pinned documented surface");
  });

  // The same note makes an architectural claim the assertion above does not
  // pin: the shared rule set (validateResultPack) has *two* consumers — the
  // engine guard and the `mind-ontology review` command. That "two consumers"
  // framing is what tells a reader the CLI verdict and the module verdict come
  // from one rule set; the behavioral proof of the equivalence lives in
  // tests/unit/review-command.test.mjs, but no doc-surface test held the doc's
  // own naming of the second consumer. Pin the two stable tokens — the command
  // name and the "two consumers" concept — so the doc can't drop the second
  // consumer or the shared-rule-set framing while leaving the wording free.
  it("the doc names the second consumer (`mind-ontology review`) and the two-consumers concept", () => {
    const lower = docText.toLowerCase();
    expect(lower).toContain("mind-ontology review");
    expect(lower).toContain("two consumers");
  });

  it("pins the top-of-doc Autopilot Integration Pack header back-link", () => {
    expect(docText).toContain(
      "Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).",
    );
  });
});
