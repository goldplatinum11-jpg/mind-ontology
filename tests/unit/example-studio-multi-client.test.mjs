import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileFromCwd } from "../../scripts/agentctx/compile.mjs";
import { validateOntology } from "../../scripts/agentctx/schema.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const EXAMPLE = resolve(REPO_ROOT, "docs/examples/studio-multi-client");

const compile = (task, opts = {}) =>
  JSON.parse(compileFromCwd({ cwd: EXAMPLE, task, scopes: opts.scopes ?? [], format: "json", riskMode: opts.riskMode }));

const projectTitles = (pack) => pack.selected.filter((b) => b.file === "projects.md").map((b) => b.title);
const directionTitles = (pack) => pack.selected.filter((b) => b.file === "direction.md").map((b) => b.title);

// A non-trivial MULTI-CLIENT ontology: several concurrent engagements that must stay
// isolated. Where team-ontology shows one team's internal projects, this shows the
// harder case — scoping to one client must surface that client and never leak another.
describe("studio-multi-client example compiles, scopes, and isolates clients", () => {
  it("exists and validates with zero errors", () => {
    expect(existsSync(resolve(EXAMPLE, ".agentctx/constraints.md"))).toBe(true);
    const report = validateOntology(EXAMPLE);
    expect(report.errors).toBe(0);
    expect(report.ok).toBe(true);
  });

  it("scopes to one client and always includes the safety floor (metrics: genuinely focused)", () => {
    const pack = compile("work on the storefront product search", { scopes: ["client-acme"] });
    // Metrics: a scoped pack drops material — it is not everything-always-included.
    expect(pack.omittedCount).toBeGreaterThan(0);
    expect(pack.selected.length).toBeLessThan(pack.selected.length + pack.omittedCount);
    expect(pack.selected.some((b) => b.file === "constraints.md" && b.reason === "always")).toBe(true);
  });

  it("isolation: a client scope surfaces that client's project and NOT another client's", () => {
    const acme = compile("work on the storefront product search", { scopes: ["client-acme"] });
    const titles = projectTitles(acme);
    expect(titles, "the scoped client's project must surface").toContain("Acme retail assistant");
    expect(titles, "another client's project must not leak in").not.toContain("Northwind clinic scheduler");
    expect(titles).not.toContain("Globex trading copilot");
  });

  it("different client scopes surface different client slices (scoping discriminates)", () => {
    const acme = compile("move the engagement forward", { scopes: ["client-acme"] });
    const northwind = compile("move the engagement forward", { scopes: ["client-northwind"] });
    expect(projectTitles(acme)).toContain("Acme retail assistant");
    expect(projectTitles(northwind)).toContain("Northwind clinic scheduler");
    // The two packs must not be identical — the scope actually changed the slice.
    const a = acme.selected.map((b) => `${b.file}/${b.title}`).join("|");
    const n = northwind.selected.map((b) => `${b.file}/${b.title}`).join("|");
    expect(a).not.toBe(n);
  });

  it("isolation regression: a generic task under a client scope does not leak another client's direction", () => {
    // Guards the bug independent review caught: with no per-client direction block, a
    // generic task ("move the engagement forward") under one client's scope let the
    // Acme direction win on common words and leak into the other client's pack.
    const northwind = compile("move the engagement forward", { scopes: ["client-northwind"] });
    const globex = compile("move the engagement forward", { scopes: ["client-globex"] });

    expect(directionTitles(northwind)).not.toContain("Ship the Acme retail assistant");
    expect(directionTitles(globex)).not.toContain("Ship the Acme retail assistant");
    expect(directionTitles(northwind).join(" ")).toContain("Northwind");
    expect(directionTitles(globex).join(" ")).toContain("Globex");
  });

  it("forces safety context on a cross-client destructive task", () => {
    const pack = compile("delete one client's records and copy them into another client's workspace");
    expect(pack.risk.level).toBe("risky");
    expect(pack.risk.signals.length).toBeGreaterThan(0);
    expect(pack.selected.some((b) => b.reason === "risk-forced" || b.file === "constraints.md")).toBe(true);
  });
});
