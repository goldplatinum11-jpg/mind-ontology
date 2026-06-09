import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileFromCwd } from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = resolve(REPO_ROOT, "tests/fixtures/autopilot-line");
const GLOSSARY = resolve(FIXTURE, ".agentctx/glossary.md");

function selectedFiles(task) {
  const pack = JSON.parse(compileFromCwd({ cwd: FIXTURE, task, scopes: [], format: "json" }));
  return pack.selected.map((b) => b.file);
}

const TERMS = [
  { term: "Runway", task: "What does the term runway mean in this autopilot line?" },
  { term: "Result Pack", task: "What is a Result Pack and what does it contain?" },
  { term: "Wrong-axis read", task: "Define a wrong-axis read for the constitution." },
];

describe("autopilot glossary retrieval (A16)", () => {
  it("the fixture ships a glossary.md", () => {
    expect(existsSync(GLOSSARY)).toBe(true);
  });

  it.each(TERMS)("a definition task for '$term' surfaces glossary.md", ({ task }) => {
    expect(selectedFiles(task)).toContain("glossary.md");
  });

  it("the glossary defines the core autopilot vocabulary", () => {
    const lower = readFileSync(GLOSSARY, "utf8").toLowerCase();
    for (const term of ["runway", "lane", "result pack", "wrong-axis", "stop policy"]) {
      expect(lower, `glossary omits: ${term}`).toContain(term);
    }
  });

  it("a non-vocabulary memory task does not pull the glossary (still scoped)", () => {
    // Guards the wrong-axis corpus invariant against the new glossary file.
    const files = selectedFiles("Recall every conversation we have ever had about pricing.");
    expect(files).toContain("constraints.md");
    expect(files).not.toContain("glossary.md");
  });
});
