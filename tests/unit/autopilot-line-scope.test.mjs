import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileFromCwd } from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = resolve(REPO_ROOT, "tests/fixtures/autopilot-line");

function files(task, scopes) {
  return JSON.parse(compileFromCwd({ cwd: FIXTURE, task, scopes, format: "json" }))
    .selected.map((b) => b.file);
}

// The compiler accepts a --scope tag; scope matches outscore plain task-word
// matches, so a scope should pull its tagged file into the pack.
describe("autopilot-line scoped retrieval (A83)", () => {
  it("scope 'glossary' surfaces glossary.md", () => {
    expect(files("explain a term", ["glossary"])).toContain("glossary.md");
  });

  it("scope 'agent' surfaces agent-roles.md", () => {
    expect(files("which role does what", ["agent"])).toContain("agent-roles.md");
  });

  it("scope 'direction' surfaces direction.md", () => {
    expect(files("what are we building", ["direction"])).toContain("direction.md");
  });

  it("the constraints safety floor is present regardless of scope", () => {
    for (const scope of [["glossary"], ["agent"], ["direction"], []]) {
      expect(files("any task", scope)).toContain("constraints.md");
    }
  });

  it("a scoped pack still emits no hosted endpoint or secret", () => {
    const blob = JSON.stringify(
      JSON.parse(compileFromCwd({ cwd: FIXTURE, task: "plan", scopes: ["agent"], format: "json" })),
    ).toLowerCase();
    expect(blob).not.toMatch(/sirtai\.org|workers\.dev|bearer /);
  });
});
