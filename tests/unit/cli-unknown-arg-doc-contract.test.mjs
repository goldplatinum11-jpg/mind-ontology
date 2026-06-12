import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// Doc-side guard for the unknown-argument contract. The engine side is locked
// by `cli-error-ux.test.mjs` / `cli-error-ux-catalog.test.mjs`; this sweep
// keeps the *documented* contract from drifting back to the old bare
// `Unknown argument: <arg>` form. Every catalog/spec table row that states the
// unknown-argument message must also point at the command's own `--help`:
//
//   Unknown argument: <arg>. Run "mind-ontology <command> --help" for the
//   list of options.
//
// Prose that merely *names* the message (e.g. the closed-lanes note in
// cli-errors.md) is exempt: the rule applies to table rows, where the quoted
// text is the normative wording an operator will actually see.

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith(".md")) out.push(full);
  }
  return out;
}

const DOCS = walk(resolve(REPO_ROOT, "docs")).map((f) =>
  relative(REPO_ROOT, f).replace(/\\/g, "/")
);

const HELP_POINTER = /Run "mind-ontology [a-z-]+ --help" for the list of options/;

function contractRows(rel) {
  const lines = readFileSync(resolve(REPO_ROOT, rel), "utf8").split("\n");
  const rows = [];
  lines.forEach((line, i) => {
    if (line.trimStart().startsWith("|") && line.includes("Unknown argument:")) {
      rows.push({ line: i + 1, text: line });
    }
  });
  return rows;
}

describe("docs: unknown-argument rows carry the --help pointer", () => {
  it("sweeps a non-trivial doc set", () => {
    expect(DOCS.length).toBeGreaterThanOrEqual(15);
  });

  it.each(DOCS)("%s has no bare unknown-argument contract row", (rel) => {
    for (const row of contractRows(rel)) {
      expect(
        HELP_POINTER.test(row.text),
        `${rel}:${row.line} states the unknown-argument contract without the --help pointer:\n${row.text}`
      ).toBe(true);
    }
  });

  it("covers the normative sources (non-vacuous)", () => {
    expect(contractRows("docs/cli-errors.md").length).toBeGreaterThanOrEqual(8);
    expect(contractRows("docs/workbench-w2-cli-spec.md").length).toBeGreaterThanOrEqual(1);
  });
});
