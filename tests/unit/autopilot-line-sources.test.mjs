import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileFromCwd } from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = resolve(REPO_ROOT, "tests/fixtures/autopilot-line");

function selectedFiles(task) {
  const pack = JSON.parse(compileFromCwd({ cwd: FIXTURE, task, scopes: [], format: "json" }));
  return pack.selected.map((b) => b.file);
}

// Each rounded-out source file plus a right-axis task that must surface it.
const SOURCES = [
  { file: "identity.md", task: "What is the operator and AI worker relationship in this line?" },
  { file: "projects.md", task: "Which repository and project does this autopilot pack lane build?" },
  { file: "decisions.md", task: "Why did we choose to keep the autopilot line self-hosted and local-first?" },
  { file: "architecture.md", task: "Explain the architecture layers of the autopilot line." },
];

describe("autopilot-line fixture full source set (A20)", () => {
  it("the fixture ships all four added source files", () => {
    for (const { file } of SOURCES) {
      expect(existsSync(resolve(FIXTURE, ".agentctx", file)), `missing ${file}`).toBe(true);
    }
  });

  it.each(SOURCES)("a right-axis task surfaces $file", ({ file, task }) => {
    expect(selectedFiles(task)).toContain(file);
  });

  it("the safety floor is co-present with every source read", () => {
    for (const { task } of SOURCES) {
      expect(selectedFiles(task)).toContain("constraints.md");
    }
  });
});
