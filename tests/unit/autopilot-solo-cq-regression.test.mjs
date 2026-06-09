import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileFromCwd } from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = resolve(REPO_ROOT, "tests/fixtures/autopilot-solo");
const CQ = resolve(FIXTURE, ".agentctx/cq.md");

function files(task) {
  return JSON.parse(compileFromCwd({ cwd: FIXTURE, task, scopes: [], format: "json" }))
    .selected.map((b) => b.file);
}

const CASES = [
  { topic: "identity", task: "Who is the operator and what role does the AI take here?", file: "identity.md" },
  { topic: "direction", task: "What is the current launch priority for the paid feature?", file: "direction.md" },
  { topic: "projects", task: "Which product app and repository does a lane touch?", file: "projects.md" },
];

describe("autopilot solo CQ regression (A81)", () => {
  it("the solo fixture ships a cq.md", () => {
    expect(existsSync(CQ)).toBe(true);
  });
  it.each(CASES)("$topic CQ is answerable: surfaces $file", ({ task, file }) => {
    expect(files(task)).toContain(file);
  });
  it("every source file cq.md names is one a regression task surfaces", () => {
    const named = [...readFileSync(CQ, "utf8").matchAll(/`([a-z-]+\.md)`/g)].map((m) => m[1]);
    const surfaced = new Set(CASES.flatMap((c) => files(c.task)));
    for (const f of new Set(named)) {
      expect(surfaced.has(f), `cq.md names ${f} but no regression task surfaces it`).toBe(true);
    }
  });
  it("an unrelated task surfaces only the constraints floor (matches are earned)", () => {
    const f = files("Describe the weather in Tokyo today");
    expect(f).toContain("constraints.md");
    expect(f).not.toContain("identity.md");
    expect(f).not.toContain("direction.md");
  });
});
