import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ONTOLOGY_SCHEMA,
  SCHEMA_AUTHORING_DOC,
  renderReport,
  validateSource,
} from "../../scripts/agentctx/schema.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
// Normalize CRLF so verbatim-output checks compare content, not line endings.
const DOC = readFileSync(resolve(REPO_ROOT, "docs/mind-ontology-schema-validation-v0.md"), "utf8")
  .replace(/\r\n/g, "\n");

// The validation doc must stay consistent with the actual validate output
// contract (validate-remedy-hints-v1). If renderReport's format or the issue
// shape changes, this fails so the doc is updated rather than drifting.
describe("schema validation doc matches the validate output contract", () => {
  it("documents the issue shape including the remedy field", () => {
    expect(DOC).toContain("{ file, level, rule, message, remedy }");
    expect(DOC).not.toContain("{ file, level, rule, message }");
  });

  it("its invalid example is the verbatim renderReport output for the fixture", () => {
    // The doc's example: identity.md with #identity and #collaboration blocks,
    // so validation yields exactly one error (#style) and one warning (#operator).
    const raw = "# Identity\n\n## Who we serve #identity #collaboration\n\nOperator profile.\n";
    const issues = validateSource("identity.md", raw, ONTOLOGY_SCHEMA["identity.md"]);
    const errors = issues.filter((i) => i.level === "error").length;
    const warnings = issues.filter((i) => i.level === "warning").length;
    expect({ errors, warnings }).toEqual({ errors: 1, warnings: 1 });

    const text = renderReport({ ok: false, errors, warnings, issues });
    expect(DOC, "doc example drifted from real renderReport output").toContain(text.trimEnd());
  });

  it("its valid example is the verbatim renderReport output for a clean report", () => {
    const text = renderReport({ ok: true, errors: 0, warnings: 0, issues: [] });
    expect(DOC).toContain(text.trimEnd());
  });

  it("shows fix: continuation lines and the authoring-doc pointer for failures only in the invalid example", () => {
    expect(DOC).toContain("fix:");
    expect(DOC).toContain(SCHEMA_AUTHORING_DOC);
    // The clean example must not carry the failure-only pointer line.
    const validExample = DOC.slice(DOC.indexOf("VALID — 0 error(s)"));
    expect(validExample).not.toContain(`See ${SCHEMA_AUTHORING_DOC}`);
  });
});

// The "What it checks" table was prose-maintained; pin each row to the
// ONTOLOGY_SCHEMA rule set it summarizes (the way schema-authoring-guide
// pins the guide), so a schema change fails here instead of drifting.
const TABLE_SECTION = DOC.split("## What it checks")[1].split("\n---")[0];
const ROW_FOR = new Map(
  TABLE_SECTION.split("\n")
    .filter((line) => line.startsWith("| ") && !line.startsWith("| Source"))
    .map((line) => {
      const [source, rules] = line.split("|").map((cell) => cell.trim()).filter(Boolean);
      return [source.replace(/[`_]/g, ""), rules];
    }),
);

describe("'What it checks' table is pinned to ONTOLOGY_SCHEMA", () => {
  it("has exactly one row per schema source plus the all-files row", () => {
    const expected = [...Object.keys(ONTOLOGY_SCHEMA), "all files"].sort();
    expect([...ROW_FOR.keys()].sort()).toEqual(expected);
  });

  it("states the present-only and constraints-required preamble", () => {
    expect(TABLE_SECTION).toContain("Only files that are present are validated");
    expect(TABLE_SECTION).toContain("`constraints.md` itself is required");
  });

  it("each row names every tag, field, and enum value its rules enforce", () => {
    for (const [file, rule] of Object.entries(ONTOLOGY_SCHEMA)) {
      const row = ROW_FOR.get(file);
      for (const tag of rule.requiredTags ?? []) {
        expect(row, `${file} row omits required tag #${tag}`).toContain(`#${tag}`);
      }
      for (const tag of rule.recommendedTags ?? []) {
        expect(row, `${file} row omits recommended tag #${tag}`).toContain(`#${tag}`);
      }
      if (rule.recommendedTags?.length) {
        expect(row, `${file} row must mark recommended tags as such`).toMatch(/recommended/i);
      }
      if (rule.namespace) {
        expect(row, `${file} row omits namespace #${rule.namespace}`).toContain(`#${rule.namespace}`);
      }
      for (const fields of Object.values(rule.fieldsByTag ?? {})) {
        for (const field of fields) {
          expect(row, `${file} row omits required field ${field}:`).toContain(`${field}:`);
        }
      }
      if (rule.enumField) {
        expect(row, `${file} row omits enum field ${rule.enumField.name}:`).toContain(`${rule.enumField.name}:`);
        for (const value of rule.enumField.allowed) {
          expect(row, `${file} row omits allowed value ${value}`).toContain(value);
        }
      }
    }
  });

  it("each row states the structural rules its schema entry enables", () => {
    const MARKERS = [
      ["required (exists, non-empty)", (rule) => rule.required, /exist.*non-empty|non-empty.*exist/i],
      ["every-block-has-tag", (rule) => rule.everyBlockHasTag, /every block/i],
      ["unique-titles (case-insensitive)", (rule) => rule.uniqueTitles, /unique title.*case-insensitive/i],
      ["non-empty-body", (rule) => rule.perBlock?.nonEmptyBody, /non-empty body/i],
      ["question-title", (rule) => rule.perBlock?.questionTitle, /question/i],
      ["one-role-tag", (rule) => rule.perBlock?.exactlyOneExtraTag, /exactly one/i],
      ["topic-tag", (rule) => rule.perBlock?.requireExtraTopicTag, /topic tag/i],
    ];
    for (const [file, rule] of Object.entries(ONTOLOGY_SCHEMA)) {
      const row = ROW_FOR.get(file);
      for (const [name, enabled, pattern] of MARKERS) {
        if (enabled(rule)) {
          expect(row, `${file} row omits the ${name} rule`).toMatch(pattern);
        }
      }
    }
  });

  it("the all-files row covers the no-secrets credential scan", () => {
    expect(ROW_FOR.get("all files")).toMatch(/credential/i);
    expect(ROW_FOR.get("all files")).toContain("no-secrets");
  });
});
