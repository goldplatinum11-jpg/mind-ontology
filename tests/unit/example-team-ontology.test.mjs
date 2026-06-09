import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileFromCwd } from "../../scripts/agentctx/compile.mjs";
import { validateOntology } from "../../scripts/agentctx/schema.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const EXAMPLE = resolve(REPO_ROOT, "docs/examples/team-ontology");

const compile = (task, opts = {}) =>
  JSON.parse(compileFromCwd({ cwd: EXAMPLE, task, scopes: opts.scopes ?? [], format: "json", riskMode: opts.riskMode }));

// M45 — the richer worked example stays valid and demonstrates real scoping.
describe("team-ontology example compiles and scopes (M45)", () => {
  it("exists and validates with zero errors", () => {
    expect(existsSync(resolve(EXAMPLE, ".agentctx/constraints.md"))).toBe(true);
    const report = validateOntology(EXAMPLE);
    expect(report.errors).toBe(0);
    expect(report.ok).toBe(true);
  });

  it("scopes a focused task to a subset, always including constraints", () => {
    const pack = compile("speed up the booking confirmation path", { scopes: ["performance"] });
    const total = pack.selected.length + pack.omittedCount;
    expect(pack.selected.length).toBeLessThan(total); // genuinely focused
    expect(pack.selected.some((b) => b.file === "constraints.md" && b.reason === "always")).toBe(true);
    // The performance-relevant sources surface.
    const files = new Set(pack.selected.map((b) => b.file));
    expect(files.has("direction.md") || files.has("decisions.md") || files.has("projects.md")).toBe(true);
  });

  it("forces safety context on a destructive task", () => {
    const pack = compile("drop the production bookings table and delete records");
    expect(pack.risk.level).toBe("risky");
    expect(pack.risk.signals.length).toBeGreaterThan(0);
    expect(pack.selected.some((b) => b.reason === "risk-forced" || b.file === "constraints.md")).toBe(true);
  });

  it("a different scope surfaces a different slice (scoping actually discriminates)", () => {
    const perf = compile("improve throughput", { scopes: ["performance"] });
    const api = compile("stabilize the partner contract", { scopes: ["api"] });
    const perfTitles = perf.selected.map((b) => `${b.file}/${b.title}`).join("|");
    const apiTitles = api.selected.map((b) => `${b.file}/${b.title}`).join("|");
    expect(perfTitles).not.toBe(apiTitles);
  });
});
