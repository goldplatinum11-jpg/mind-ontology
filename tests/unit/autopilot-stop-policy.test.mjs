import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-autopilot-stop-policy-v1.md");

const text = () => readFileSync(DOC, "utf8").toLowerCase();

describe("autopilot stop policy v1 (A3)", () => {
  it("ships the stop policy doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("enumerates the valid terminal stop conditions", () => {
    const t = text();
    for (const phrase of [
      "operator stop",
      "deploy",
      "secrets",
      "irreversible",
      "forbidden-scope",
      "auth failure",
    ]) {
      expect(t).toContain(phrase);
    }
    // The repeat-blocker rule must be present.
    expect(t).toMatch(/same hard blocker repeats three times|repeats three times/);
  });

  it("pins the valid terminal definition as a closed, categorized set", () => {
    const t = text();
    // The valid list is exhaustive ("only"), not a set of examples. This
    // closure is what lets the controller "continue unless a valid terminal
    // condition is met" — drop the "only" and any reason becomes terminal.
    expect(t).toMatch(/may stop only when one of these is true/);
    expect(t).toMatch(/the only legitimate reasons to end a runway early/);
    // Every valid condition reduces to one of exactly three categories.
    for (const category of [
      "safety boundary",
      "budget boundary",
      "genuine dead end",
    ]) {
      expect(t).toContain(category);
    }
  });

  it("marks completed-work signals as invalid stop conditions", () => {
    const t = text();
    for (const phrase of [
      "tests passed",
      "docs updated",
      "templates created",
      "git commit was denied",
      "no remote",
    ]) {
      expect(t).toContain(phrase);
    }
  });

  it("states the safe-continuation principle, not safe-stopping", () => {
    const t = text();
    expect(t).toMatch(/safe continuation/);
    expect(t).toMatch(/more safe, in-scope work is not a stopping condition|next action/);
  });

  it("keeps the live-write boundary fail-closed regardless of continuation", () => {
    const t = text();
    expect(t).toMatch(/fails closed|fail-closed|off by default/);
    expect(t).toMatch(/writeback proposal-only|proposal-only/);
  });

  // The apply-order procedure is load-bearing: an agent must consult the valid
  // list *before* the invalid list, treat forbidden/destructive boundaries as
  // hard stops, and continue past denied-commit / missing-remote non-blockers.
  // Pin it inside the "How an agent applies it" section so the order, not just
  // the presence of the words, is asserted.
  it("pins the apply-order: valid list is checked before the invalid list", () => {
    const t = text();
    const applyIdx = t.indexOf("## how an agent applies it");
    expect(applyIdx).toBeGreaterThan(0);
    const next = t.indexOf("## boundary, not behavior change");
    const apply = t.slice(applyIdx, next > applyIdx ? next : undefined);
    // Step 1 checks the valid list first; if nothing matches, stopping is not
    // authorized. Step 2 checks the invalid list. The "valid first" ordering is
    // the safeguard — checking invalid first would let a soft reason pre-empt.
    const validIdx = apply.search(/checks the \*\*valid\*\* list first|valid\*\* list first/);
    const invalidIdx = apply.search(/checks the \*\*invalid\*\* list|invalid\*\* list/);
    expect(validIdx).toBeGreaterThanOrEqual(0);
    expect(invalidIdx).toBeGreaterThan(validIdx);
    expect(apply).toMatch(/stopping is not authorized/);
    expect(apply).toMatch(/continue to the next adl/);
  });

  it("treats forbidden/destructive stops as hard but non-blockers as continuation", () => {
    const t = text();
    const applyIdx = t.indexOf("## how an agent applies it");
    const next = t.indexOf("## boundary, not behavior change");
    const apply = t.slice(applyIdx, next > applyIdx ? next : undefined);
    // Hard side: forbidden-scope and destructive-action stops mean stop+report,
    // not work around the boundary.
    expect(apply).toMatch(/forbidden-scope and destructive-action stops are \*hard\*|are \*hard\*/);
    expect(apply).toMatch(/stops and\s+reports rather than working around/);
    // Soft side: denied commits and a missing remote are explicitly not
    // blockers — the worker leaves changes uncommitted and the controller
    // commits if appropriate.
    expect(apply).toMatch(/denied commits and a missing remote are explicitly \*\*not\*\* blockers|explicitly \*\*not\*\* blockers/);
    expect(apply).toMatch(/leaves changes uncommitted/);
    expect(apply).toMatch(/the controller reviews and\s+commits/);
  });

  // The closing paragraph of "How an agent applies it" mirrors the reading
  // protocol: it couples the worker's get_context(task) read to the controller's
  // list_constraints() + this-policy re-read, and gates continuation on a *valid*
  // terminal condition. This coupling — not just the valid/invalid lists — is the
  // load-bearing claim, and it must back-link to the reading-protocol doc so the
  // two halves stay in sync. Pin the sentence structurally inside the section.
  it("pins the reading-protocol mirror: worker get_context, controller list_constraints, continue-unless-valid", () => {
    const t = text();
    const applyIdx = t.indexOf("## how an agent applies it");
    const next = t.indexOf("## boundary, not behavior change");
    const apply = t.slice(applyIdx, next > applyIdx ? next : undefined);
    // Back-link to the reading protocol keeps the mirror anchored to its source.
    expect(apply).toMatch(
      /this mirrors the \[reading protocol\]\(mind-ontology-autopilot-reading-protocol-v1\.md\)/,
    );
    // Worker side of the mirror: get_context(task) at each lane step.
    const workerIdx = apply.search(/the worker calls `get_context\(task\)`/);
    expect(workerIdx).toBeGreaterThanOrEqual(0);
    // Controller side: re-reads list_constraints() *and this policy* before
    // approving continuation — both halves, not just the constraints read.
    const controllerIdx = apply.search(
      /the controller re-reads `list_constraints\(\)` and this policy/,
    );
    expect(controllerIdx).toBeGreaterThan(workerIdx);
    // Continuation is gated on a *valid* terminal condition — the same closure the
    // valid list and the controller's reading-protocol step depend on.
    expect(apply).toMatch(/continues unless a \*valid\* terminal condition is met/);
  });

  it("guarantees continuation never crosses a forbidden boundary to stay busy", () => {
    const t = text();
    const boundaryIdx = t.indexOf("## boundary, not behavior change");
    expect(boundaryIdx).toBeGreaterThan(0);
    const boundary = t.slice(boundaryIdx);
    // "Continue" is bounded: it never licenses crossing a forbidden boundary,
    // and continuation stays inside the write scope and constraints.
    expect(boundary).toMatch(/never means .{0,4}cross a forbidden boundary/);
    expect(boundary).toMatch(/inside\*? the write scope/);
    // Both failure modes are named: mistaking invalid-for-valid wastes a runway,
    // crossing a valid boundary to avoid stopping is unsafe.
    expect(boundary).toMatch(/mistakes an invalid condition for a valid one wastes a runway/);
    expect(boundary).toMatch(/crosses a valid boundary to avoid stopping is unsafe/);
    // The boundary claim ("continue stays inside scope; risky work still gets
    // safety context") is anchored to the task-risk-modes doc. That cross-link is
    // the bridge between the stop policy and the compiler's force-safety-into-
    // risky-packs behavior; pin it so the boundary section can't drift loose from
    // its risk-modes companion.
    expect(boundary).toMatch(/\[task risk modes\]\(mind-ontology-task-risk-modes-v0\.md\)/);
  });
});
