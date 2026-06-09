import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileFromCwd } from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOCS = resolve(REPO_ROOT, "docs");
const GLOSSARY = resolve(DOCS, "mind-ontology-autopilot-glossary-tie-in-v1.md");
const TEAM = resolve(REPO_ROOT, "tests/fixtures/autopilot-team");

// Parse the glossary table: rows shaped "| **Term** | meaning | [link](doc.md) |".
function glossaryRows() {
  return readFileSync(GLOSSARY, "utf8")
    .split("\n")
    .filter((l) => /^\|\s*\*\*/.test(l))
    .map((l) => {
      const term = (l.match(/\*\*([^*]+)\*\*/) || [])[1];
      const doc = (l.match(/\(([a-z0-9-]+\.md)\)/) || [])[1];
      return { term, doc };
    });
}

function teamFiles(task) {
  return JSON.parse(compileFromCwd({ cwd: TEAM, task, scopes: [], format: "json" }))
    .selected.map((b) => b.file);
}

describe("autopilot glossary completeness (A55)", () => {
  const rows = glossaryRows();

  it("the glossary has a non-trivial set of term rows", () => {
    expect(rows.length).toBeGreaterThanOrEqual(10);
  });

  it.each(rows)("term '$term' has a source link to an existing doc", ({ term, doc }) => {
    expect(term, "row has no term").toBeTruthy();
    expect(doc, `term "${term}" has no source link`).toBeTruthy();
    expect(existsSync(resolve(DOCS, doc)), `term "${term}" links missing ${doc}`).toBe(true);
  });
});

describe("autopilot team fixture extra retrieval rows (A55)", () => {
  const CASES = [
    { task: "Improve accessibility in the storefront checkout flow", file: "projects.md" },
    { task: "Add a webhook handler to the billing service", file: "projects.md" },
    { task: "Which agent role handles the data-platform pipeline lane?", file: "agent-roles.md" },
  ];

  it.each(CASES)("'$task' surfaces $file", ({ task, file }) => {
    expect(teamFiles(task)).toContain(file);
  });
});
