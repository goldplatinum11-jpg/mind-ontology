import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileFromCwd } from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = resolve(REPO_ROOT, "tests/fixtures/autopilot-team");

function pack(task, opts = {}) {
  return JSON.parse(
    compileFromCwd({ cwd: FIXTURE, task, scopes: opts.scopes ?? [], format: "json", riskMode: opts.riskMode }),
  );
}
const files = (task, opts) => pack(task, opts).selected.map((b) => b.file);
const titles = (task, opts) => pack(task, opts).selected.map((b) => `${b.file}:${b.title}`);

// Multi-project tasks, each phrased as an agent would, plus the block that must surface.
const CASES = [
  { task: "Plan a checkout change in the storefront web app", title: "projects.md:Storefront web app" },
  { task: "Fix the invoice API in the billing service", title: "projects.md:Billing service" },
  { task: "Add a scheduled transform to the data platform pipelines", title: "projects.md:Data platform" },
];

describe("autopilot team (multi-project) fixture (A48)", () => {
  it("ships the multi-project fixture", () => {
    for (const f of ["constraints.md", "projects.md", "direction.md", "agent-roles.md"]) {
      expect(existsSync(resolve(FIXTURE, ".agentctx", f)), `missing ${f}`).toBe(true);
    }
  });

  it("always surfaces the constraints floor", () => {
    expect(files("Plan the next lane")).toContain("constraints.md");
  });

  it.each(CASES)("a project task surfaces its project block: $title", ({ task, title }) => {
    expect(titles(task)).toContain(title);
  });

  it("scopes to the named project, not a dump of every project block", () => {
    // A storefront task should not also pull the billing/data project blocks.
    const t = titles("Plan a checkout change in the storefront web app");
    expect(t).toContain("projects.md:Storefront web app");
    expect(t).not.toContain("projects.md:Billing service");
    expect(t).not.toContain("projects.md:Data platform");
  });

  it("classifies a destructive cross-project task as risky", () => {
    expect(pack("Drop the billing invoices table in production").risk.level).toBe("risky");
  });

  it("emits no hosted endpoint or secret", () => {
    const blob = JSON.stringify(pack("Plan a billing lane")).toLowerCase();
    expect(blob).not.toMatch(/sirtai\.org|workers\.dev|bearer /);
  });
});
