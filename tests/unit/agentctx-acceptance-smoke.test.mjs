import { describe, expect, it } from "vitest";
import {
  EXPECTED_TEMPLATE_FILES,
  runAcceptanceSmoke,
} from "../../scripts/agentctx/acceptance-smoke.mjs";

describe("agentctx free-layer acceptance smoke", () => {
  it("passes every end-to-end check on the shipped template", () => {
    const report = runAcceptanceSmoke();

    const failed = report.checks.filter((c) => !c.ok);
    expect(
      failed,
      `failing checks: ${failed.map((c) => `${c.name} (${c.detail})`).join("; ")}`,
    ).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it("covers the documented free-layer journey steps", () => {
    const report = runAcceptanceSmoke();
    const names = report.checks.map((c) => c.name);

    expect(names).toEqual(
      expect.arrayContaining([
        "init: scaffolds all template sources",
        "init: refuses overwrite without --force",
        "compile(json): constraints.md always included",
        "compile(markdown): renders a context pack",
        "compile(bare dir): fails closed with agentctx:init hint",
      ]),
    );
  });

  it("expects the full Mind Ontology source set to scaffold", () => {
    expect(EXPECTED_TEMPLATE_FILES).toContain(".agentctx/constraints.md");
    expect(EXPECTED_TEMPLATE_FILES).toContain(".agentctx/identity.md");
    expect(EXPECTED_TEMPLATE_FILES.length).toBe(9);
  });
});
