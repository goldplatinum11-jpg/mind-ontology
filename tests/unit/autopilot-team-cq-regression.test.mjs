import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileFromCwd } from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = resolve(REPO_ROOT, "tests/fixtures/autopilot-team");
const CQ = resolve(FIXTURE, ".agentctx/cq.md");

function selectedFiles(task) {
  return JSON.parse(compileFromCwd({ cwd: FIXTURE, task, scopes: [], format: "json" }))
    .selected.map((b) => b.file);
}

const CASES = [
  { topic: "project", task: "Which project and repository does this billing lane belong to?", file: "projects.md" },
  { topic: "direction", task: "What is the current cross-project direction for checkout?", file: "direction.md" },
  { topic: "roles", task: "Which agent role owns the frontend storefront lane?", file: "agent-roles.md" },
];

describe("autopilot team CQ regression (A51)", () => {
  it("the team fixture ships a cq.md", () => {
    expect(existsSync(CQ)).toBe(true);
  });

  it.each(CASES)("$topic CQ is answerable: '$task' surfaces $file", ({ task, file }) => {
    expect(selectedFiles(task)).toContain(file);
  });

  it("every source file cq.md names is one a regression task surfaces", () => {
    const named = [...readFileSync(CQ, "utf8").matchAll(/`([a-z-]+\.md)`/g)].map((m) => m[1]);
    const surfaced = new Set(CASES.flatMap((c) => selectedFiles(c.task)));
    for (const file of new Set(named)) {
      expect(surfaced.has(file), `cq.md names ${file} but no regression task surfaces it`).toBe(true);
    }
  });

  it("an unrelated task surfaces only the constraints floor (matches are earned)", () => {
    const files = selectedFiles("Describe the weather in Tokyo today");
    expect(files).toContain("constraints.md");
    expect(files).not.toContain("projects.md");
    expect(files).not.toContain("direction.md");
  });
});
