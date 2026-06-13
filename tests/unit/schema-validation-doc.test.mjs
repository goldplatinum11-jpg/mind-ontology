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

// schema-validation-vs-reference-docs-v1 — a DIRECT cross-document audit. The
// central validation doc's "What it checks" table summarizes each source's
// rules; every per-file docs/mind-ontology-*-schema-v0.md reference doc carries
// its own "Validator enforcement" table. Both are independently pinned to
// ONTOLOGY_SCHEMA elsewhere, but nothing pins them to EACH OTHER — so a wording
// change that updates one doc's tags/fields/enum values and forgets the other
// can still match the schema while the two public docs disagree. This compares
// the two docs to each other, not to the schema, and fails on that drift.

// constraints.md is documented by the authoring guide; every other schema entry
// ships a per-file reference doc whose name mirrors the source file name.
const CROSS_REFERENCE_DOCS = Object.keys(ONTOLOGY_SCHEMA)
  .filter((file) => file !== "constraints.md")
  .map((file) => [file, `docs/mind-ontology-${file.replace(/\.md$/, "")}-schema-v0.md`]);

const REFERENCE_DOC_FOR = new Map(
  CROSS_REFERENCE_DOCS.map(([file, path]) => [
    file,
    readFileSync(resolve(REPO_ROOT, path), "utf8").replace(/\r\n/g, "\n"),
  ]),
);

// Concatenated text of a reference doc's "## Validator enforcement" rule rows
// (lines that begin "| `"), ended at the next ## heading so prose elsewhere in
// the doc — e.g. projects' "does not require the #project namespace tag" note —
// cannot leak primitives into the comparison.
function enforcementTableText(file) {
  const parts = REFERENCE_DOC_FOR.get(file).split(/^## Validator enforcement$/m);
  expect(parts.length, `${file} reference doc has no "## Validator enforcement" section`).toBe(2);
  return parts[1]
    .split(/\n## /)[0]
    .split("\n")
    .filter((line) => line.startsWith("| `"))
    .join("\n");
}

// The schema primitives a doc fragment names, read straight from its text:
//   tags  — #tag tokens (required, recommended, and namespace tags)
//   fields — backticked `Name:`-style field-line names
//   enums  — backticked lowercase enum/status values
// Each is what a human reading that fragment would see, so equality across the
// two docs means the two public summaries genuinely agree.
function primitives(text) {
  return {
    tags: new Set([...text.matchAll(/#([a-z][a-z0-9-]*)/gi)].map((m) => m[1])),
    fields: new Set([...text.matchAll(/`([A-Z][A-Za-z]*):`/g)].map((m) => m[1])),
    enums: new Set([...text.matchAll(/`([a-z][a-z]+)`/g)].map((m) => m[1])),
  };
}

const sortedArray = (set) => [...set].sort();

describe("validation doc 'What it checks' rows agree with the per-file reference docs", () => {
  it("every per-file reference doc has a matching row in the validation doc", () => {
    for (const [file] of CROSS_REFERENCE_DOCS) {
      expect(ROW_FOR.has(file), `validation doc has no "What it checks" row for ${file}`).toBe(true);
    }
  });

  it("each validation-doc row names exactly the tags its reference doc's enforcement table names", () => {
    for (const [file] of CROSS_REFERENCE_DOCS) {
      const fromValidationDoc = primitives(ROW_FOR.get(file)).tags;
      const fromReferenceDoc = primitives(enforcementTableText(file)).tags;
      expect(
        sortedArray(fromValidationDoc),
        `${file}: validation doc row and reference enforcement table disagree on #tags`,
      ).toEqual(sortedArray(fromReferenceDoc));
    }
  });

  it("each row agrees with its reference doc on field-line names and enum values", () => {
    for (const [file] of CROSS_REFERENCE_DOCS) {
      const fromValidationDoc = primitives(ROW_FOR.get(file));
      const fromReferenceDoc = primitives(enforcementTableText(file));
      expect(
        sortedArray(fromValidationDoc.fields),
        `${file}: validation doc row and reference doc disagree on field-line names`,
      ).toEqual(sortedArray(fromReferenceDoc.fields));
      expect(
        sortedArray(fromValidationDoc.enums),
        `${file}: validation doc row and reference doc disagree on enum values`,
      ).toEqual(sortedArray(fromReferenceDoc.enums));
    }
  });

  it("is not vacuous: the audit exercises tag, field, and enum agreement on real sources", () => {
    const everyTag = new Set();
    const everyField = new Set();
    const everyEnum = new Set();
    for (const [file] of CROSS_REFERENCE_DOCS) {
      const { tags, fields, enums } = primitives(ROW_FOR.get(file));
      tags.forEach((tag) => everyTag.add(tag));
      fields.forEach((field) => everyField.add(field));
      enums.forEach((value) => everyEnum.add(value));
    }
    // projects.md contributes Name:/Status: fields and the Status enum values;
    // every namespaced/required-tag source contributes #tags. If any class went
    // empty the equality checks above would be trivially satisfiable.
    expect(everyTag.size, "no #tags compared across the two docs").toBeGreaterThan(0);
    expect(everyField.size, "no field-line names compared across the two docs").toBeGreaterThan(0);
    expect(everyEnum.size, "no enum values compared across the two docs").toBeGreaterThan(0);
  });
});

// schema-validation-vs-reference-docs-structural-rules-v1 — the primitive audit
// above ties the two public docs together on NAMED primitives (#tags, field
// lines, enum values). But each schema source also enforces STRUCTURAL rules
// that name no such primitive: every-block-has-tag, question-title, topic-tag,
// non-empty-body, one-role-tag, unique-titles. The central validation doc states
// these in prose ("each is phrased as a question", "a unique title
// (case-insensitive)"); each per-file reference doc names them as rule-id markers
// in its "Validator enforcement" Rule column (`question-title`, `unique-titles`).
// Both sides are independently pinned to ONTOLOGY_SCHEMA elsewhere, but nothing
// ties the central doc's structural PROSE to the reference doc's structural
// MARKERS directly — so dropping "question" from one row while the `question-title`
// marker stays in the other still reads as agreement. This audit links the two
// docs by structural rule and fails on that drift.

// Each structural rule: the rule id as it appears in a reference doc's
// enforcement-table Rule column, and the prose pattern that must appear in the
// central validation doc's row when the rule is enforced. Tag/field/enum rules
// (required-tag, recommended-tag, namespace-required, required-field, enum-field)
// are covered by the primitive audit above and are intentionally excluded here.
const STRUCTURAL_RULE_MARKERS = [
  ["every-block-has-tag", /every block/i],
  ["question-title", /question/i],
  ["topic-tag", /topic tag/i],
  ["non-empty-body", /non-empty body/i],
  ["one-role-tag", /exactly one/i],
  ["unique-titles", /unique title/i],
];

// Whether a reference doc's enforcement table names a rule id, read the way a
// human scanning its Rule column would: the id appears backticked in a row, e.g.
// "| `question-title` | error | ...". enforcementTableText already restricts the
// text to those rule rows, so prose elsewhere in the doc cannot satisfy this.
function enforcementNamesRule(file, rule) {
  return enforcementTableText(file).includes(`\`${rule}\``);
}

describe("validation doc rows and reference docs agree on structural-rule wording", () => {
  it("each structural rule is stated on both docs or neither, per source", () => {
    for (const [file] of CROSS_REFERENCE_DOCS) {
      const row = ROW_FOR.get(file);
      for (const [rule, prose] of STRUCTURAL_RULE_MARKERS) {
        const inReferenceDoc = enforcementNamesRule(file, rule);
        const inValidationDoc = prose.test(row);
        expect(
          inValidationDoc,
          `${file}: reference doc ${inReferenceDoc ? "names" : "omits"} the ${rule} rule, ` +
            `but the validation doc row ${inValidationDoc ? "states" : "omits"} its prose — ` +
            "the two public docs disagree on a structural rule",
        ).toBe(inReferenceDoc);
      }
    }
  });

  it("is not vacuous: real structural rules are exercised on both sides", () => {
    // Some reference doc must actually name a structural rule (else the reference
    // side is trivially false everywhere), and the matching prose must actually
    // appear in the corresponding validation-doc row (else the validation side is
    // trivially false everywhere) — otherwise the equality above proves nothing.
    let namedInReference = 0;
    let statedInValidation = 0;
    for (const [file] of CROSS_REFERENCE_DOCS) {
      const row = ROW_FOR.get(file);
      for (const [rule, prose] of STRUCTURAL_RULE_MARKERS) {
        if (enforcementNamesRule(file, rule)) namedInReference += 1;
        if (prose.test(row)) statedInValidation += 1;
      }
    }
    expect(namedInReference, "no structural rule named in any reference enforcement table").toBeGreaterThan(0);
    expect(statedInValidation, "no structural-rule prose found in any validation doc row").toBeGreaterThan(0);
  });
});
