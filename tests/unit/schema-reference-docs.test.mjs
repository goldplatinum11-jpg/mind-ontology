import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ONTOLOGY_SCHEMA, RULE_REMEDIES, validateSource } from "../../scripts/agentctx/schema.mjs";
import { parseMarkdownBlocks } from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// constraints.md is documented by the authoring guide (schema-authoring.md);
// every other schema entry ships a per-file reference doc.
const REFERENCE_DOCS = Object.keys(ONTOLOGY_SCHEMA)
  .filter((file) => file !== "constraints.md")
  .map((file) => [file, `docs/mind-ontology-${file.replace(/\.md$/, "")}-schema-v0.md`]);

// Normalize CRLF so section/row parsing compares content, not line endings.
const DOC_FOR = new Map(
  REFERENCE_DOCS.map(([file, path]) => [
    file,
    readFileSync(resolve(REPO_ROOT, path), "utf8").replace(/\r\n/g, "\n"),
  ]),
);

// Mirror of validateSource's dispatch: the exact rule ids a schema entry can
// emit. Adding/removing a structural switch in ONTOLOGY_SCHEMA changes this
// set, which fails the exact-table test below until the doc is updated.
function enabledRules(rule) {
  const names = ["no-credentials"];
  if (rule.everyBlockHasTag) names.push("every-block-has-tag");
  if (rule.requiredTags?.length) names.push("required-tag");
  if (rule.recommendedTags?.length) names.push("recommended-tag");
  if (rule.fieldsByTag) names.push("required-field");
  if (rule.enumField) names.push("enum-field");
  if (rule.namespace) names.push("namespace-required");
  if (rule.perBlock?.requireExtraTopicTag) names.push("topic-tag");
  if (rule.perBlock?.exactlyOneExtraTag) names.push("one-role-tag");
  if (rule.perBlock?.nonEmptyBody) names.push("non-empty-body");
  if (rule.perBlock?.questionTitle) names.push("question-title");
  if (rule.uniqueTitles) names.push("unique-titles");
  return names.sort();
}

// The doc's "## Validator enforcement" section, ended at the next ## heading
// so prose elsewhere in the doc cannot satisfy a marker.
function enforcementSection(file) {
  const parts = DOC_FOR.get(file).split(/^## Validator enforcement$/m);
  expect(parts.length, `${file} reference doc has no "## Validator enforcement" section`).toBe(2);
  return parts[1].split(/\n## /)[0];
}

// Rule rows of the enforcement table: rule id -> { level, text }.
function tableRows(section) {
  return new Map(
    section
      .split("\n")
      .filter((line) => line.startsWith("| `"))
      .map((line) => {
        const cells = line.split("|").map((cell) => cell.trim()).filter(Boolean);
        return [cells[0].replace(/`/g, ""), { level: cells[1], text: cells[2] }];
      }),
  );
}

// schema-reference-structural-pins-v1 — the per-file reference docs each carry
// a "Validator enforcement" table; pin it to ONTOLOGY_SCHEMA the way the
// authoring guide and validation doc are pinned, so a schema change fails here
// instead of the reference docs drifting.
describe("per-file schema reference docs are pinned to ONTOLOGY_SCHEMA", () => {
  it("every documented rule id is a real RULE_REMEDIES rule", () => {
    for (const [file] of REFERENCE_DOCS) {
      for (const rule of tableRows(enforcementSection(file)).keys()) {
        expect(RULE_REMEDIES, `${file} doc names unknown rule "${rule}"`).toHaveProperty(rule);
      }
    }
  });

  it("each enforcement section names the validate command and applies present-only", () => {
    for (const [file] of REFERENCE_DOCS) {
      const section = enforcementSection(file);
      expect(section, `${file} doc omits the validate command`).toContain("npm run agentctx:validate");
      expect(section, `${file} doc omits the ONTOLOGY_SCHEMA source`).toContain("ONTOLOGY_SCHEMA");
      expect(section, `${file} doc omits present-only semantics`).toMatch(/only\s+when\s+the\s+file\s+is\s+present/i);
    }
  });

  it("each table lists exactly the rule ids its schema entry enables", () => {
    for (const [file] of REFERENCE_DOCS) {
      const rows = tableRows(enforcementSection(file));
      expect([...rows.keys()].sort(), `${file} doc table drifted from ONTOLOGY_SCHEMA`).toEqual(
        enabledRules(ONTOLOGY_SCHEMA[file]),
      );
    }
  });

  it("recommended-tag rows are warnings; every other row is an error", () => {
    for (const [file] of REFERENCE_DOCS) {
      for (const [rule, row] of tableRows(enforcementSection(file))) {
        const expected = rule === "recommended-tag" ? "warning" : "error";
        expect(row.level, `${file} doc misstates the level of ${rule}`).toBe(expected);
      }
    }
  });

  it("rows name every tag, field, namespace, and enum value their rules enforce", () => {
    for (const [file] of REFERENCE_DOCS) {
      const rule = ONTOLOGY_SCHEMA[file];
      const rows = tableRows(enforcementSection(file));
      for (const tag of rule.requiredTags ?? []) {
        expect(rows.get("required-tag").text, `${file} doc omits required tag #${tag}`).toContain(`#${tag}`);
      }
      for (const tag of rule.recommendedTags ?? []) {
        expect(rows.get("recommended-tag").text, `${file} doc omits recommended tag #${tag}`).toContain(`#${tag}`);
      }
      for (const fields of Object.values(rule.fieldsByTag ?? {})) {
        for (const field of fields) {
          expect(rows.get("required-field").text, `${file} doc omits field ${field}:`).toContain(`${field}:`);
        }
      }
      if (rule.enumField) {
        const row = rows.get("enum-field").text;
        expect(row, `${file} doc omits enum field ${rule.enumField.name}:`).toContain(`${rule.enumField.name}:`);
        for (const value of rule.enumField.allowed) {
          expect(row, `${file} doc omits allowed value ${value}`).toContain(value);
        }
      }
      if (rule.namespace) {
        expect(rows.get("namespace-required").text, `${file} doc omits namespace #${rule.namespace}`)
          .toContain(`#${rule.namespace}`);
      }
    }
  });

  it("rows state each structural rule's semantics", () => {
    const MARKERS = [
      ["every-block-has-tag", /at least one tag/i],
      ["unique-titles", /unique[\s\S]*case-insensitive/i],
      ["non-empty-body", /non-empty body/i],
      ["question-title", /question[\s\S]*\?/i],
      ["one-role-tag", /exactly one/i],
      ["topic-tag", /topic tag/i],
      ["namespace-required", /at least one block/i],
    ];
    for (const [file] of REFERENCE_DOCS) {
      const rows = tableRows(enforcementSection(file));
      for (const [rule, pattern] of MARKERS) {
        if (rows.has(rule)) {
          expect(rows.get(rule).text, `${file} doc misstates the ${rule} rule`).toMatch(pattern);
        }
      }
    }
  });

  it("enum docs do not claim out-of-enum values are accepted", () => {
    for (const [file] of REFERENCE_DOCS) {
      if (!ONTOLOGY_SCHEMA[file].enumField) continue;
      const doc = DOC_FOR.get(file);
      expect(doc, `${file} doc must not soften the enum`).not.toMatch(/allowed but discouraged/i);
      expect(doc, `${file} doc must state out-of-enum values fail`).toMatch(/any\s+other\s+value\s+fails\s+validation/i);
    }
  });
});

// The ```md fence under each doc's "## Example (minimal conformant file)"
// heading. The fence body contains "## " block headings of its own, so the
// section cannot be ended at the next ## line; instead the anchor is that the
// example heading leads directly into its fence, which keeps the docs'
// illustrative "Block model" fences (all before this heading) out of reach.
function exampleFixture(file) {
  const parts = DOC_FOR.get(file).split(/^## Example \(minimal conformant file\)$/m);
  expect(parts.length, `${file} reference doc has no "## Example (minimal conformant file)" section`).toBe(2);
  const fence = parts[1].match(/^```md\n([\s\S]*?)^```$/m);
  expect(fence, `${file} example section has no \`\`\`md fence`).toBeTruthy();
  expect(
    parts[1].slice(0, fence.index).trim(),
    `${file} example heading must lead directly into its \`\`\`md fence`,
  ).toBe("");
  return fence[1];
}

// schema-reference-examples-fixture-v1 — execute each doc's minimal example as
// a fixture through validateSource, so a schema change that stops accepting a
// documented example fails here instead of the docs shipping a broken example.
describe("per-file schema reference doc examples validate as fixtures", () => {
  it("every example fence is a non-trivial ontology source", () => {
    for (const [file] of REFERENCE_DOCS) {
      const fixture = exampleFixture(file);
      expect(fixture.trim().length, `${file} example fence is empty`).toBeGreaterThan(0);
      expect(fixture, `${file} example fence has no "## " block heading`).toMatch(/^## /m);
    }
  });

  it("every documented minimal example validates clean — no errors, no warnings", () => {
    for (const [file] of REFERENCE_DOCS) {
      const issues = validateSource(file, exampleFixture(file), ONTOLOGY_SCHEMA[file]);
      expect(issues, `${file} documented minimal example no longer validates`).toEqual([]);
    }
  });

  it("the fixture check is not vacuous: an emptied example fails every schema entry", () => {
    for (const [file] of REFERENCE_DOCS) {
      const issues = validateSource(file, "", ONTOLOGY_SCHEMA[file]);
      expect(
        issues.some((issue) => issue.level === "error"),
        `${file} schema accepts an empty source, so the example fixture proves nothing`,
      ).toBe(true);
    }
  });
});

// The two fence classes a reference doc may contain, keyed by the ## heading
// the fence sits under. Classification is by section, not by validation
// outcome: an illustrative fence may coincidentally validate (glossary's
// does), so only the heading is a deterministic signal.
const ILLUSTRATIVE_SECTION = "Block model";
const FIXTURE_SECTION = "Example (minimal conformant file)";

// Every fenced code block in a doc with its info string, body, and the ## section
// heading above it. Section tracking is fence-aware: "## " lines inside an open
// fence are example block headings, not document sections.
function fenceBlocks(file) {
  const fences = [];
  let section = null;
  let open = null;
  for (const line of DOC_FOR.get(file).split("\n")) {
    if (open === null && line.startsWith("## ")) section = line.slice(3);
    if (line.startsWith("```")) {
      if (open === null) {
        open = { section, lang: line.slice(3).trim(), lines: [] };
      } else {
        fences.push({ section: open.section, lang: open.lang, body: `${open.lines.join("\n")}\n` });
        open = null;
      }
    } else if (open !== null) {
      open.lines.push(line);
    }
  }
  expect(open, `${file} doc has an unterminated fence`).toBeNull();
  return fences;
}

// Prose between the "## Block model" heading and its fence opener.
function blockModelIntro(file) {
  const parts = DOC_FOR.get(file).split(/^## Block model$/m);
  expect(parts.length, `${file} reference doc has no "## Block model" section`).toBe(2);
  return parts[1].split("```")[0];
}

// schema-reference-fence-classification-v1 — every fence in the reference docs
// has a deterministic class: the "Block model" fence is illustrative and never
// validated; the example fence is the executable fixture validated above. A
// fence under any other heading is unclassified and fails here, so future
// fixture extraction cannot silently pick up (or skip) a fence.
describe("per-file schema reference doc fences are classified", () => {
  it("every fence sits under the Block model or example heading — none unclassified", () => {
    for (const [file] of REFERENCE_DOCS) {
      for (const fence of fenceBlocks(file)) {
        expect(
          [ILLUSTRATIVE_SECTION, FIXTURE_SECTION],
          `${file} doc has an unclassified \`\`\`${fence.lang} fence under "## ${fence.section}"`,
        ).toContain(fence.section);
      }
    }
  });

  it("each doc has exactly one illustrative fence and one fixture fence, both ```md", () => {
    for (const [file] of REFERENCE_DOCS) {
      const fences = fenceBlocks(file);
      for (const section of [ILLUSTRATIVE_SECTION, FIXTURE_SECTION]) {
        expect(
          fences.filter((fence) => fence.section === section).length,
          `${file} doc must have exactly one fence under "## ${section}"`,
        ).toBe(1);
      }
      for (const fence of fences) {
        expect(fence.lang, `${file} doc fence under "## ${fence.section}" is not \`\`\`md`).toBe("md");
      }
    }
  });

  it("the executed fixture is exactly the example-section fence, never an illustrative one", () => {
    for (const [file] of REFERENCE_DOCS) {
      const fixture = fenceBlocks(file).find((fence) => fence.section === FIXTURE_SECTION);
      expect(exampleFixture(file), `${file} fixture extractor disagrees with the fence inventory`).toBe(
        fixture.body,
      );
    }
  });

  it("each Block model section labels its fence illustrative and not validated", () => {
    for (const [file] of REFERENCE_DOCS) {
      const intro = blockModelIntro(file);
      expect(intro, `${file} doc does not label its Block model fence illustrative`).toMatch(
        /illustrative only/i,
      );
      expect(intro, `${file} doc does not state its Block model fence is not validated`).toMatch(
        /not\s+validated/i,
      );
    }
  });

  it("only the example heading claims a minimal conformant file", () => {
    for (const [file] of REFERENCE_DOCS) {
      const claims = DOC_FOR.get(file).match(/minimal conformant file/gi) ?? [];
      expect(
        claims.length,
        `${file} doc claims "minimal conformant file" outside its example heading`,
      ).toBe(1);
    }
  });
});

// The illustrative "Block model" fence is deliberately NOT run through
// validateSource: it may be a placeholder skeleton (projects' angle-bracket
// `Status: <active | ...>` would fail enum-field; identity's `<prose...>` body),
// so the fixture suite above leaves its CONTENT unchecked. But the fence's whole
// stated job is to show the canonical block SHAPE, and the defining part of that
// shape is the schema's namespace and required tags. We parse the illustrative
// fence with the real compiler parser (parseMarkdownBlocks — the same tag
// extraction the validator sees) and pin those tags to ONTOLOGY_SCHEMA. A
// namespace rename or required-tag change in the schema then fails here until
// the illustration is updated, without forcing the placeholder fence to fully
// validate.
function illustrativeBlocks(file) {
  const fence = fenceBlocks(file).find((f) => f.section === ILLUSTRATIVE_SECTION);
  expect(fence, `${file} doc has no Block model fence`).toBeTruthy();
  return parseMarkdownBlocks(fence.body, file);
}

describe("schema-reference-illustrative-tags-v1 — Block model fences illustrate the schema's tags", () => {
  it("each illustrative fence parses into at least one block, every block tagged", () => {
    for (const [file] of REFERENCE_DOCS) {
      const blocks = illustrativeBlocks(file);
      expect(blocks.length, `${file} Block model fence has no "## " block`).toBeGreaterThan(0);
      for (const block of blocks) {
        expect(
          block.tags.length,
          `${file} Block model block "${block.title}" illustrates no tags`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("namespaced docs illustrate the namespace tag on every shown block", () => {
    for (const [file] of REFERENCE_DOCS) {
      const rule = ONTOLOGY_SCHEMA[file];
      if (!rule.namespace) continue;
      for (const block of illustrativeBlocks(file)) {
        expect(
          block.tags,
          `${file} Block model block "${block.title}" omits namespace #${rule.namespace}`,
        ).toContain(rule.namespace);
      }
    }
  });

  it("docs with required tags illustrate at least one of them", () => {
    for (const [file] of REFERENCE_DOCS) {
      const rule = ONTOLOGY_SCHEMA[file];
      if (!rule.requiredTags?.length) continue;
      const shown = new Set(illustrativeBlocks(file).flatMap((block) => block.tags));
      const named = rule.requiredTags.map((tag) => `#${tag}`).join(", ");
      expect(
        rule.requiredTags.some((tag) => shown.has(tag)),
        `${file} Block model fence shows none of its required tags (${named})`,
      ).toBe(true);
    }
  });

  it("is not vacuous: a namespaced doc names a namespace its illustration carries", () => {
    // At least one reference doc must exercise the namespace assertion above,
    // otherwise the check could pass simply because no doc is namespaced.
    const namespaced = REFERENCE_DOCS.filter(([file]) => ONTOLOGY_SCHEMA[file].namespace);
    expect(namespaced.length, "no namespaced reference doc exercises the namespace pin").toBeGreaterThan(0);
  });
});
