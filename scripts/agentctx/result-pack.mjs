#!/usr/bin/env node

/**
 * Result Pack shape rules (Workbench W9).
 *
 * The five invariants the autopilot Result Pack shape guard enforces
 * (docs/mind-ontology-autopilot-result-pack-v1.md), extracted into one
 * callable module so the guard test (tests/unit/autopilot-result-pack-shape
 * .test.mjs) and the `mind-ontology review` command share a single set of
 * rules — one shape, two consumers, no drift.
 *
 * Invariant numbering is part of the W2 §9 JSON contract:
 *   1. required keys & types
 *   2. forbidden_scope_touched false (and write_scope_respected true)
 *   3. no hosted leakage (endpoint, token, private clone path)
 *   4. non-empty adls_completed, each entry naming a guard test
 *   5. self-consistent stop state
 */

export const RESULT_PACK_REQUIRED_KEYS = {
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

export const GUARD_TEST_PATTERN = /tests\/unit\/.+\.test\.mjs$/;
// Hosted endpoints, auth material, and the private clone path no pack may
// embed (the leakage sweep the original guard test encoded).
export const LEAKAGE_PATTERN = /sirtai\.org|workers\.dev|bearer |authorization|sirt-app-v2/;

// The controller checklist (docs/mind-ontology-autopilot-controller-checklist
// -v1.md) echoed with what shape validation actually covers: `machine` only
// where an invariant above mechanically verifies the item; everything else
// remains the human's call (W2 §9: review never pretends to have checked
// what it has not).
export const CONTROLLER_CHECKLIST = [
  { item: 1, title: "Write scope respected", verdict: "manual" },
  { item: 2, title: "Guards present", verdict: "machine" },
  { item: 3, title: "Validation green", verdict: "manual" },
  { item: 4, title: "No leakage", verdict: "manual" },
  { item: 5, title: "Stop state honest", verdict: "machine" },
  { item: 6, title: "Uncommitted changes match the Result Pack", verdict: "manual" },
  { item: 7, title: "Lockfile clean", verdict: "manual" },
  { item: 8, title: "Scope-only diff", verdict: "manual" },
];

function checkRequiredKeys(pack) {
  const violations = [];
  for (const [key, type] of Object.entries(RESULT_PACK_REQUIRED_KEYS)) {
    if (!(key in pack)) {
      violations.push(`missing required key: ${key}`);
    } else if (typeof pack[key] !== type) {
      violations.push(`wrong type for ${key}: expected ${type}, got ${typeof pack[key]}`);
    }
  }
  return violations;
}

function checkScopeFlags(pack) {
  const violations = [];
  if (pack.forbidden_scope_touched !== false) {
    violations.push("forbidden_scope_touched is true");
  }
  if (pack.write_scope_respected !== true) {
    violations.push("write_scope_respected is false");
  }
  return violations;
}

function checkLeakage(pack) {
  return LEAKAGE_PATTERN.test(JSON.stringify(pack).toLowerCase())
    ? ["pack embeds a hosted endpoint, token, or private clone path"]
    : [];
}

function checkAdls(pack) {
  if (!Array.isArray(pack.adls_completed) || pack.adls_completed.length === 0) {
    return ["adls_completed must be a non-empty array"];
  }
  const violations = [];
  pack.adls_completed.forEach((adl, i) => {
    if (typeof adl?.id !== "string" || adl.id.length === 0) {
      violations.push(`adls_completed[${i}] is missing an id`);
    }
    if (typeof adl?.guard_test !== "string" || !GUARD_TEST_PATTERN.test(adl.guard_test)) {
      violations.push(
        `adls_completed[${i}] does not name a guard test (tests/unit/*.test.mjs)`,
      );
    }
  });
  return violations;
}

function checkStopState(pack) {
  const violations = [];
  const runway = pack.runway;
  if (typeof runway !== "object" || runway === null) {
    return ["runway is not an object"];
  }
  if (typeof runway.checkpoint !== "number") {
    violations.push("runway.checkpoint is not a number");
  }
  if (runway.valid_terminal_stop_reached === false) {
    if (pack.status !== "in-progress") {
      violations.push(
        `status must be "in-progress" when no valid terminal stop was reached, got: ${pack.status}`,
      );
    }
    if (
      typeof runway.reason_for_continuation !== "string" ||
      runway.reason_for_continuation.length === 0
    ) {
      violations.push("runway.reason_for_continuation is missing or empty");
    }
  }
  return violations;
}

export const INVARIANTS = [
  { invariant: 1, title: "Required keys & types", check: checkRequiredKeys },
  { invariant: 2, title: "No forbidden-scope write admitted", check: checkScopeFlags },
  { invariant: 3, title: "No hosted leakage in the pack", check: checkLeakage },
  { invariant: 4, title: "ADLs completed, each naming a guard test", check: checkAdls },
  { invariant: 5, title: "Stop state self-consistent", check: checkStopState },
];

/**
 * Validate a parsed Result Pack against the five invariants.
 * Returns { ok, violations: [{ invariant, message }] }.
 */
export function validateResultPack(pack) {
  const violations = [];
  for (const { invariant, check } of INVARIANTS) {
    for (const message of check(pack)) {
      violations.push({ invariant, message });
    }
  }
  return { ok: violations.length === 0, violations };
}

/**
 * The guard tests a pack names, deduped in source order — the proof the
 * controller re-runs instead of trusting prose.
 */
export function guardTestsOf(pack) {
  if (!Array.isArray(pack.adls_completed)) return [];
  return [
    ...new Set(
      pack.adls_completed
        .map((adl) => adl?.guard_test)
        .filter((t) => typeof t === "string" && GUARD_TEST_PATTERN.test(t)),
    ),
  ];
}
