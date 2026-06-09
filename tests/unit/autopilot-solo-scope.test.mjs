import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileFromCwd } from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = resolve(REPO_ROOT, "tests/fixtures/autopilot-solo");

function files(task, scopes) {
  return JSON.parse(compileFromCwd({ cwd: FIXTURE, task, scopes, format: "json" }))
    .selected.map((b) => b.file);
}

// The solo fixture tags its files (#operator/#launch/#app); a scope should pull
// the matching file into the pack. Completes scope coverage across the
// multi-file fixtures (line, team, solo).
describe("autopilot-solo scoped retrieval (A85)", () => {
  it("scope 'operator' surfaces identity.md", () => {
    expect(files("who is involved", ["operator"])).toContain("identity.md");
  });

  it("scope 'launch' surfaces direction.md", () => {
    expect(files("what is the priority", ["launch"])).toContain("direction.md");
  });

  it("scope 'app' surfaces projects.md", () => {
    expect(files("which repo", ["app"])).toContain("projects.md");
  });

  it("the constraints floor is present under any scope", () => {
    for (const scope of [["operator"], ["launch"], ["app"], []]) {
      expect(files("any task", scope)).toContain("constraints.md");
    }
  });

  it("a scoped solo pack emits no hosted endpoint or secret", () => {
    const blob = JSON.stringify(
      JSON.parse(compileFromCwd({ cwd: FIXTURE, task: "plan", scopes: ["launch"], format: "json" })),
    ).toLowerCase();
    expect(blob).not.toMatch(/sirtai\.org|workers\.dev|bearer /);
  });
});
