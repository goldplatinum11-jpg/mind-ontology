import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileFromCwd } from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = resolve(REPO_ROOT, "tests/fixtures/autopilot-team");

function titles(task, scopes) {
  return JSON.parse(compileFromCwd({ cwd: FIXTURE, task, scopes, format: "json" }))
    .selected.map((b) => `${b.file}:${b.title}`);
}

// The team fixture tags each project block (#storefront / #billing / #data);
// a project scope should pull that project's block into the pack.
describe("autopilot-team scoped retrieval by project (A84)", () => {
  it("scope 'storefront' surfaces the storefront project block", () => {
    expect(titles("plan a lane", ["storefront"])).toContain("projects.md:Storefront web app");
  });

  it("scope 'billing' surfaces the billing project block", () => {
    expect(titles("plan a lane", ["billing"])).toContain("projects.md:Billing service");
  });

  it("scope 'data' surfaces the data-platform project block", () => {
    expect(titles("plan a lane", ["data"])).toContain("projects.md:Data platform");
  });

  it("the constraints floor is present under any project scope", () => {
    for (const scope of [["storefront"], ["billing"], ["data"]]) {
      expect(titles("plan a lane", scope).some((t) => t.startsWith("constraints.md:"))).toBe(true);
    }
  });

  it("a scoped team pack emits no hosted endpoint or secret", () => {
    const blob = JSON.stringify(
      JSON.parse(compileFromCwd({ cwd: FIXTURE, task: "plan", scopes: ["billing"], format: "json" })),
    ).toLowerCase();
    expect(blob).not.toMatch(/sirtai\.org|workers\.dev|bearer /);
  });
});
