import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileFromCwd } from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = resolve(REPO_ROOT, "tests/fixtures/autopilot-solo");

function files(task) {
  return JSON.parse(compileFromCwd({ cwd: FIXTURE, task, scopes: [], format: "json" }))
    .selected.map((b) => b.file);
}

const CASES = [
  { task: "Who is the operator and what role does the AI take?", file: "identity.md" },
  { task: "What is the current launch priority for the paid feature?", file: "direction.md" },
  { task: "Which product app and repository does this lane touch?", file: "projects.md" },
];

describe("autopilot solo-founder fixture (A67)", () => {
  it("ships the solo fixture source files", () => {
    for (const f of ["constraints.md", "identity.md", "direction.md", "projects.md"]) {
      expect(existsSync(resolve(FIXTURE, ".agentctx", f)), `missing ${f}`).toBe(true);
    }
  });

  it("always surfaces the constraints floor", () => {
    expect(files("Plan the next lane step")).toContain("constraints.md");
  });

  it.each(CASES)("'$task' surfaces $file", ({ task, file }) => {
    expect(files(task)).toContain(file);
  });

  it("classifies a destructive task as risky", () => {
    const pack = JSON.parse(
      compileFromCwd({ cwd: FIXTURE, task: "Delete the production database", scopes: [], format: "json" }),
    );
    expect(pack.risk.level).toBe("risky");
  });

  it("emits no hosted endpoint or secret", () => {
    const blob = JSON.stringify(
      JSON.parse(compileFromCwd({ cwd: FIXTURE, task: "Plan a lane", scopes: [], format: "json" })),
    ).toLowerCase();
    expect(blob).not.toMatch(/sirtai\.org|workers\.dev|bearer /);
  });
});
