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

// schema-reference-cq-question-title-terminator-v1 — question-title is the only
// structural rule that constrains a block's TITLE text: each #cq title must end
// with "?". The cq.md reference doc states and shows that terminator in five
// places — the "CQ block rules" prose, the "Validator enforcement" row, the
// Block model illustration, the minimal example, and the Required/Recommended
// CQ tables. Only the example fence is executed through validateSource (above),
// so the prose, the illustration title, and the CQ-table questions are otherwise
// unguarded: any of them could drop the "?" and silently contradict the rule the
// doc itself documents. This audit pins every CQ-title surface in the doc to the
// "?" terminator, and self-guards so it fails loudly rather than passing
// vacuously if cq.md ever stops enforcing question-title.
describe("cq.md reference doc states and shows the question-title '?' terminator", () => {
  const CQ_FILE = "cq.md";

  // The last ("Question it tests") cell of every `| #tag | ... |` row under a
  // "## <heading>" table, ended at the next ## heading so later prose can't leak.
  function questionColumn(heading) {
    const parts = DOC_FOR.get(CQ_FILE).split(new RegExp(`^## ${heading}$`, "m"));
    expect(parts.length, `cq.md reference doc has no "## ${heading}" section`).toBe(2);
    return parts[1]
      .split(/\n## /)[0]
      .split("\n")
      .filter((line) => line.startsWith("| `#"))
      .map((line) => line.split("|").map((cell) => cell.trim()).filter(Boolean).at(-1));
  }

  it("cq.md still enforces question-title (guard against a vacuous suite)", () => {
    expect(
      ONTOLOGY_SCHEMA[CQ_FILE]?.perBlock?.questionTitle,
      "cq.md no longer enforces question-title — retarget or retire this suite",
    ).toBe(true);
  });

  it("the 'CQ block rules' prose states the title ends with '?'", () => {
    const parts = DOC_FOR.get(CQ_FILE).split(/^## CQ block rules$/m);
    expect(parts.length, "cq.md reference doc has no '## CQ block rules' section").toBe(2);
    const section = parts[1].split(/\n## /)[0];
    expect(section, "CQ block rules prose omits the question-title '?' terminator").toMatch(
      /title ends with `\?`/i,
    );
  });

  it("the enforcement-table question-title row requires a '?' terminator", () => {
    const row = tableRows(enforcementSection(CQ_FILE)).get("question-title");
    expect(row, "cq.md enforcement table has no question-title row").toBeTruthy();
    expect(row.text, "question-title row omits the '?' terminator").toMatch(
      /end(?:s|ing)? (?:in|with) `\?`/i,
    );
  });

  it("every Block model illustration title ends with '?'", () => {
    for (const block of illustrativeBlocks(CQ_FILE)) {
      expect(
        block.title.trim().endsWith("?"),
        `Block model CQ "${block.title}" contradicts the question-title rule`,
      ).toBe(true);
    }
  });

  it("every minimal-example title ends with '?'", () => {
    const blocks = parseMarkdownBlocks(exampleFixture(CQ_FILE), CQ_FILE);
    expect(blocks.length, "cq.md example fence parsed into no blocks").toBeGreaterThan(0);
    for (const block of blocks) {
      expect(
        block.title.trim().endsWith("?"),
        `example CQ "${block.title}" contradicts the question-title rule`,
      ).toBe(true);
    }
  });

  it("every Required/Recommended CQ-table question ends with '?'", () => {
    const questions = [
      ...questionColumn("Required competency questions"),
      ...questionColumn("Recommended competency questions"),
    ];
    expect(questions.length, "cq.md CQ tables yielded no questions").toBeGreaterThan(0);
    for (const question of questions) {
      expect(
        question.endsWith("?"),
        `CQ-table entry "${question}" is not phrased as a question`,
      ).toBe(true);
    }
  });
});

// schema-reference-cq-topic-tag-besides-namespace-v1 — topic-tag (the
// requireExtraTopicTag rule) is what stops a #cq block from carrying ONLY the
// #cq namespace tag: every CQ must also carry a real topic tag (#context,
// #safety, ...) that maps it to the source area it tests. The cq.md reference
// doc states and shows that requirement in five places — the "CQ block rules"
// prose (a #cq bullet AND a separate topic-tag bullet), the "Validator
// enforcement" topic-tag row, the Block model illustration, the minimal
// example, and the Required/Recommended CQ tables' "Topic tag" column. Only the
// example fence runs through validateSource (above), so the prose, the
// enforcement row's "besides #cq" phrasing, the illustration's tag pairing, and
// the CQ-table topic tags are otherwise unguarded: any could drop the topic tag
// (or pair the table row with #cq itself) and silently contradict the rule the
// doc documents. This audit pins every topic-tag surface to "at least one topic
// tag besides #cq", and self-guards so it fails loudly rather than passing
// vacuously if cq.md ever stops enforcing topic-tag.
describe("cq.md reference doc states and shows the topic-tag (besides #cq) requirement", () => {
  const CQ_FILE = "cq.md";
  const NAMESPACE = "cq";

  // The first ("Topic tag") cell of every `| #tag | ... |` row under a
  // "## <heading>" table, ended at the next ## heading so later prose can't leak.
  function topicTagColumn(heading) {
    const parts = DOC_FOR.get(CQ_FILE).split(new RegExp(`^## ${heading}$`, "m"));
    expect(parts.length, `cq.md reference doc has no "## ${heading}" section`).toBe(2);
    return parts[1]
      .split(/\n## /)[0]
      .split("\n")
      .filter((line) => line.startsWith("| `#"))
      .map((line) => line.split("|").map((cell) => cell.trim()).filter(Boolean)[0].replace(/`/g, ""));
  }

  it("cq.md still enforces topic-tag (guard against a vacuous suite)", () => {
    expect(
      ONTOLOGY_SCHEMA[CQ_FILE]?.perBlock?.requireExtraTopicTag,
      "cq.md no longer enforces topic-tag — retarget or retire this suite",
    ).toBe(true);
  });

  it("the 'CQ block rules' prose requires a topic tag in addition to the #cq namespace", () => {
    const parts = DOC_FOR.get(CQ_FILE).split(/^## CQ block rules$/m);
    expect(parts.length, "cq.md reference doc has no '## CQ block rules' section").toBe(2);
    const section = parts[1].split(/\n## /)[0];
    expect(section, "CQ block rules prose omits the #cq namespace tag bullet").toMatch(
      /`#cq` namespace tag/i,
    );
    expect(section, "CQ block rules prose omits the 'at least one topic tag' requirement").toMatch(
      /at least one\s+\*{0,2}topic tag/i,
    );
  });

  it("the enforcement-table topic-tag row requires a topic tag besides #cq", () => {
    const row = tableRows(enforcementSection(CQ_FILE)).get("topic-tag");
    expect(row, "cq.md enforcement table has no topic-tag row").toBeTruthy();
    expect(row.text, "topic-tag row omits the 'topic tag' wording").toMatch(/topic tag/i);
    expect(row.text, "topic-tag row omits the 'besides #cq' requirement").toMatch(
      /(?:besides|in addition to)\s+`#cq`/i,
    );
  });

  it("every Block model illustration block pairs #cq with at least one topic tag", () => {
    const blocks = illustrativeBlocks(CQ_FILE);
    expect(blocks.length, "cq.md Block model fence parsed into no blocks").toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block.tags, `Block model CQ "${block.title}" omits the #cq namespace`).toContain(NAMESPACE);
      expect(
        block.tags.filter((tag) => tag !== NAMESPACE).length,
        `Block model CQ "${block.title}" carries only #cq — no topic tag`,
      ).toBeGreaterThan(0);
    }
  });

  it("every minimal-example block pairs #cq with at least one topic tag", () => {
    const blocks = parseMarkdownBlocks(exampleFixture(CQ_FILE), CQ_FILE);
    expect(blocks.length, "cq.md example fence parsed into no blocks").toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block.tags, `example CQ "${block.title}" omits the #cq namespace`).toContain(NAMESPACE);
      expect(
        block.tags.filter((tag) => tag !== NAMESPACE).length,
        `example CQ "${block.title}" carries only #cq — no topic tag`,
      ).toBeGreaterThan(0);
    }
  });

  it("every Required/Recommended CQ-table entry pairs a real topic tag, never #cq itself", () => {
    const topicTags = [
      ...topicTagColumn("Required competency questions"),
      ...topicTagColumn("Recommended competency questions"),
    ];
    expect(topicTags.length, "cq.md CQ tables yielded no topic tags").toBeGreaterThan(0);
    for (const tag of topicTags) {
      expect(tag, `CQ-table topic tag "${tag}" is not a #tag token`).toMatch(/^#[a-z][a-z0-9-]*$/);
      expect(tag, `CQ-table topic tag "${tag}" is the #cq namespace, not a topic tag`).not.toBe(
        `#${NAMESPACE}`,
      );
    }
  });
});

// schema-reference-cq-required-context-safety-topics-v1 — required-tag (the
// requiredTags rule) is what forces cq.md to carry a #context CQ AND a #safety
// CQ: those two topics are the baseline an agent needs before acting, so the
// schema requires a block tagged each. The cq.md reference doc states and shows
// that requirement in four places — the "Required competency questions" prose
// ("MUST cover at least these two topics"), the "Validator enforcement"
// required-tag row, the Required-CQ table's "Topic tag" column, and the minimal
// example's two #cq blocks. The enforcement row is pinned to ONTOLOGY_SCHEMA by
// the "rows name every tag..." test above, and the minimal example runs through
// validateSource (so dropping a required block fails the fixture suite). But the
// "Required competency questions" PROSE and its TABLE are otherwise unguarded:
// the Required-CQ table could rename #context -> #decision (still a valid topic
// tag, so the topic-tag audit above stays green) and silently contradict the
// rule the doc itself documents one section below. This audit pins every
// required-topic surface to the schema's requiredTags, and self-guards so it
// fails loudly rather than passing vacuously if cq.md ever stops requiring
// #context and #safety.
describe("cq.md reference doc states and shows the required #context and #safety topics", () => {
  const CQ_FILE = "cq.md";
  const NAMESPACE = "cq";
  const REQUIRED = ONTOLOGY_SCHEMA[CQ_FILE]?.requiredTags ?? [];

  // The first ("Topic tag") cell of every `| #tag | ... |` row under a
  // "## <heading>" table, ended at the next ## heading so later prose can't leak.
  function topicTagColumn(heading) {
    const parts = DOC_FOR.get(CQ_FILE).split(new RegExp(`^## ${heading}$`, "m"));
    expect(parts.length, `cq.md reference doc has no "## ${heading}" section`).toBe(2);
    return parts[1]
      .split(/\n## /)[0]
      .split("\n")
      .filter((line) => line.startsWith("| `#"))
      .map((line) => line.split("|").map((cell) => cell.trim()).filter(Boolean)[0].replace(/`/g, ""));
  }

  it("cq.md still requires #context and #safety (guard against a vacuous suite)", () => {
    expect(
      [...REQUIRED].sort(),
      "cq.md no longer requires #context and #safety — retarget or retire this suite",
    ).toEqual(["context", "safety"]);
  });

  it("the 'Required competency questions' prose states the topics are a mandatory baseline", () => {
    const parts = DOC_FOR.get(CQ_FILE).split(/^## Required competency questions$/m);
    expect(parts.length, "cq.md reference doc has no '## Required competency questions' section").toBe(2);
    const section = parts[1].split(/\n## /)[0];
    expect(section, "Required CQ prose omits the MUST-cover-at-least requirement").toMatch(
      /MUST cover at least these two topics/i,
    );
  });

  it("the enforcement-table required-tag row names every required topic", () => {
    const row = tableRows(enforcementSection(CQ_FILE)).get("required-tag");
    expect(row, "cq.md enforcement table has no required-tag row").toBeTruthy();
    for (const tag of REQUIRED) {
      expect(row.text, `required-tag row omits #${tag}`).toContain(`#${tag}`);
    }
  });

  it("the Required-CQ table's Topic tag column lists exactly the schema's required topics", () => {
    const topicTags = topicTagColumn("Required competency questions");
    expect(
      topicTags.map((tag) => tag.replace(/^#/, "")).sort(),
      "Required-CQ table topic tags drifted from the schema's requiredTags",
    ).toEqual([...REQUIRED].sort());
  });

  it("the minimal example carries a #cq block for every required topic", () => {
    const blocks = parseMarkdownBlocks(exampleFixture(CQ_FILE), CQ_FILE);
    expect(blocks.length, "cq.md example fence parsed into no blocks").toBeGreaterThan(0);
    for (const tag of REQUIRED) {
      const block = blocks.find((b) => b.tags.includes(tag));
      expect(block, `minimal example omits a CQ tagged #${tag}`).toBeTruthy();
      expect(block.tags, `example CQ for #${tag} omits the #cq namespace`).toContain(NAMESPACE);
    }
  });
});

// schema-reference-cq-non-empty-body-v1 — non-empty-body (the perBlock.nonEmptyBody
// rule) requires every #cq block to carry a body, not just a heading: a CQ with
// only a question heading names what the ontology must answer but says nothing
// about what answering it means. The cq.md reference doc states and shows that
// requirement in four places — the "CQ block rules" prose, the "Validator
// enforcement" non-empty-body row, the Block model illustration, and the minimal
// example. The enforcement row is pinned to its rule semantics by the generic
// "rows state each structural rule's semantics" test above, and the minimal
// example runs through validateSource (so an emptied body fails the fixture suite
// already). But the "CQ block rules" PROSE and the Block model ILLUSTRATION body
// are otherwise unguarded: the prose bullet could drop the non-empty-body
// requirement, or the illustration could show a body-less block, and silently
// contradict the rule the doc documents. This audit pins every non-empty-body
// surface in the cq.md doc, and self-guards so it fails loudly rather than passing
// vacuously if cq.md ever stops enforcing non-empty-body. The central validation
// doc's non-empty-body surface for cq.md is pinned separately by
// schema-validation-doc.test.mjs (its structural-rule wording audits).
describe("cq.md reference doc states and shows the non-empty-body requirement", () => {
  const CQ_FILE = "cq.md";

  it("cq.md still enforces non-empty-body (guard against a vacuous suite)", () => {
    expect(
      ONTOLOGY_SCHEMA[CQ_FILE]?.perBlock?.nonEmptyBody,
      "cq.md no longer enforces non-empty-body — retarget or retire this suite",
    ).toBe(true);
  });

  it("the 'CQ block rules' prose states a #cq block needs a non-empty body", () => {
    const parts = DOC_FOR.get(CQ_FILE).split(/^## CQ block rules$/m);
    expect(parts.length, "cq.md reference doc has no '## CQ block rules' section").toBe(2);
    const section = parts[1].split(/\n## /)[0];
    expect(section, "CQ block rules prose omits the non-empty-body requirement").toMatch(
      /non-empty body/i,
    );
  });

  it("the enforcement-table non-empty-body row states the rule", () => {
    const row = tableRows(enforcementSection(CQ_FILE)).get("non-empty-body");
    expect(row, "cq.md enforcement table has no non-empty-body row").toBeTruthy();
    expect(row.text, "non-empty-body row omits the 'non-empty body' wording").toMatch(
      /non-empty body/i,
    );
  });

  it("every Block model illustration block carries a non-empty body", () => {
    const blocks = illustrativeBlocks(CQ_FILE);
    expect(blocks.length, "cq.md Block model fence parsed into no blocks").toBeGreaterThan(0);
    for (const block of blocks) {
      expect(
        block.body.trim().length,
        `Block model CQ "${block.title}" shows an empty body — contradicts non-empty-body`,
      ).toBeGreaterThan(0);
    }
  });

  it("every minimal-example block carries a non-empty body", () => {
    const blocks = parseMarkdownBlocks(exampleFixture(CQ_FILE), CQ_FILE);
    expect(blocks.length, "cq.md example fence parsed into no blocks").toBeGreaterThan(0);
    for (const block of blocks) {
      expect(
        block.body.trim().length,
        `example CQ "${block.title}" shows an empty body — contradicts non-empty-body`,
      ).toBeGreaterThan(0);
    }
  });
});

// schema-reference-agent-roles-required-coding-review-v1 — required-tag (the
// requiredTags rule) forces agent-roles.md to define a #coding role AND a #review
// role: together they are the minimum for a safe build-and-check loop, so the
// schema requires a block tagged each. The agent-roles.md reference doc states and
// shows that requirement in four places — the "Required roles" prose ("MUST define
// at least these two roles"), the "Validator enforcement" required-tag row, the
// Required-roles table's "Required tag" column, and the minimal example's two
// #agent blocks. The enforcement row is pinned to ONTOLOGY_SCHEMA by the generic
// "rows name every tag..." test above, and the minimal example runs through
// validateSource (so dropping a required role fails the fixture suite). But the
// "Required roles" PROSE and its TABLE are otherwise unguarded: the Required-roles
// table could rename #coding -> #strategy (still a valid role tag, so the
// one-role-tag fixture stays green) and silently contradict the rule the doc
// documents one section below. This mirrors the cq.md required-#context/#safety
// audit, pins every required-role surface to the schema's requiredTags, and
// self-guards so it fails loudly rather than passing vacuously if agent-roles.md
// ever stops requiring #coding and #review.
describe("agent-roles.md reference doc states and shows the required #coding and #review roles", () => {
  const ROLES_FILE = "agent-roles.md";
  const NAMESPACE = "agent";
  const REQUIRED = ONTOLOGY_SCHEMA[ROLES_FILE]?.requiredTags ?? [];

  // The #tags named in every `| ... | #tag | ... |` row under a "## <heading>"
  // table, ended at the next ## heading so later prose (e.g. the Recommended
  // roles table) can't leak in.
  function roleTagColumn(heading) {
    const parts = DOC_FOR.get(ROLES_FILE).split(new RegExp(`^## ${heading}$`, "m"));
    expect(parts.length, `agent-roles.md reference doc has no "## ${heading}" section`).toBe(2);
    return parts[1]
      .split(/\n## /)[0]
      .split("\n")
      .filter((line) => line.startsWith("| ") && line.includes("`#"))
      .flatMap((line) => [...line.matchAll(/`(#[a-z][a-z0-9-]*)`/g)].map((m) => m[1]));
  }

  it("agent-roles.md still requires #coding and #review (guard against a vacuous suite)", () => {
    expect(
      [...REQUIRED].sort(),
      "agent-roles.md no longer requires #coding and #review — retarget or retire this suite",
    ).toEqual(["coding", "review"]);
  });

  it("the 'Required roles' prose states the roles are a mandatory baseline", () => {
    const parts = DOC_FOR.get(ROLES_FILE).split(/^## Required roles$/m);
    expect(parts.length, "agent-roles.md reference doc has no '## Required roles' section").toBe(2);
    const section = parts[1].split(/\n## /)[0];
    expect(section, "Required roles prose omits the MUST-define-at-least requirement").toMatch(
      /MUST define at least these two roles/i,
    );
  });

  it("the enforcement-table required-tag row names every required role tag", () => {
    const row = tableRows(enforcementSection(ROLES_FILE)).get("required-tag");
    expect(row, "agent-roles.md enforcement table has no required-tag row").toBeTruthy();
    for (const tag of REQUIRED) {
      expect(row.text, `required-tag row omits #${tag}`).toContain(`#${tag}`);
    }
  });

  it("the Required-roles table's Required tag column lists exactly the schema's required tags", () => {
    const tags = roleTagColumn("Required roles");
    expect(
      tags.map((tag) => tag.replace(/^#/, "")).sort(),
      "Required-roles table tags drifted from the schema's requiredTags",
    ).toEqual([...REQUIRED].sort());
  });

  it("the minimal example carries an #agent block for every required role", () => {
    const blocks = parseMarkdownBlocks(exampleFixture(ROLES_FILE), ROLES_FILE);
    expect(blocks.length, "agent-roles.md example fence parsed into no blocks").toBeGreaterThan(0);
    for (const tag of REQUIRED) {
      const block = blocks.find((b) => b.tags.includes(tag));
      expect(block, `minimal example omits a role tagged #${tag}`).toBeTruthy();
      expect(block.tags, `example role for #${tag} omits the #agent namespace`).toContain(NAMESPACE);
    }
  });
});

// schema-reference-agent-roles-non-empty-body-v1 — non-empty-body (the
// perBlock.nonEmptyBody rule) requires every #agent block to carry a body, not
// just a heading: a role with only a "## Coding agent #agent #coding" line names
// the role but says nothing about WHEN to adopt it, which is the role-routing
// signal the source exists to provide. The agent-roles.md reference doc states
// and shows that requirement in four places — the "Role block rules" prose, the
// "Validator enforcement" non-empty-body row, the Block model illustration, and
// the minimal example. The enforcement row is pinned to its rule semantics by
// the generic "rows state each structural rule's semantics" test above, and the
// minimal example runs through validateSource (so an emptied body fails the
// fixture suite already). But the "Role block rules" PROSE and the Block model
// ILLUSTRATION body are otherwise unguarded: the prose bullet could drop the
// non-empty-body requirement, or the illustration could show a body-less block,
// and silently contradict the rule the doc documents. This mirrors the cq.md
// non-empty-body audit, pins every non-empty-body surface in the agent-roles.md
// doc, and self-guards so it fails loudly rather than passing vacuously if
// agent-roles.md ever stops enforcing non-empty-body. The central validation
// doc's non-empty-body surface for agent-roles.md is pinned separately by
// schema-validation-doc.test.mjs (its structural-rule wording audits).
describe("agent-roles.md reference doc states and shows the non-empty-body requirement", () => {
  const ROLES_FILE = "agent-roles.md";

  it("agent-roles.md still enforces non-empty-body (guard against a vacuous suite)", () => {
    expect(
      ONTOLOGY_SCHEMA[ROLES_FILE]?.perBlock?.nonEmptyBody,
      "agent-roles.md no longer enforces non-empty-body — retarget or retire this suite",
    ).toBe(true);
  });

  it("the 'Role block rules' prose states a role block needs a non-empty body", () => {
    const parts = DOC_FOR.get(ROLES_FILE).split(/^## Role block rules$/m);
    expect(parts.length, "agent-roles.md reference doc has no '## Role block rules' section").toBe(2);
    const section = parts[1].split(/\n## /)[0];
    expect(section, "Role block rules prose omits the non-empty-body requirement").toMatch(
      /non-empty body/i,
    );
  });

  it("the enforcement-table non-empty-body row states the rule", () => {
    const row = tableRows(enforcementSection(ROLES_FILE)).get("non-empty-body");
    expect(row, "agent-roles.md enforcement table has no non-empty-body row").toBeTruthy();
    expect(row.text, "non-empty-body row omits the 'non-empty body' wording").toMatch(
      /non-empty body/i,
    );
  });

  it("every Block model illustration block carries a non-empty body", () => {
    const blocks = illustrativeBlocks(ROLES_FILE);
    expect(blocks.length, "agent-roles.md Block model fence parsed into no blocks").toBeGreaterThan(0);
    for (const block of blocks) {
      expect(
        block.body.trim().length,
        `Block model role "${block.title}" shows an empty body — contradicts non-empty-body`,
      ).toBeGreaterThan(0);
    }
  });

  it("every minimal-example block carries a non-empty body", () => {
    const blocks = parseMarkdownBlocks(exampleFixture(ROLES_FILE), ROLES_FILE);
    expect(blocks.length, "agent-roles.md example fence parsed into no blocks").toBeGreaterThan(0);
    for (const block of blocks) {
      expect(
        block.body.trim().length,
        `example role "${block.title}" shows an empty body — contradicts non-empty-body`,
      ).toBeGreaterThan(0);
    }
  });
});

// schema-reference-glossary-structural-surfaces-v1 — glossary.md carries three
// structural rules beyond its #term namespace that shape how a term block is
// authored: non-empty-body (a term must be defined, not just named), and
// unique-titles (two blocks cannot define the same term, compared
// case-insensitively). The glossary.md reference doc states and shows these in
// the "Term block rules" prose, the "Validator enforcement" rows, the Block
// model illustration, and the minimal example. The enforcement rows are pinned
// to ONTOLOGY_SCHEMA and their semantics by the generic reference-doc tests
// above, and the minimal example runs through validateSource. But the "Term
// block rules" PROSE and the Block model ILLUSTRATION are otherwise unguarded:
// the prose could drop the non-empty-body or unique-title requirement, or the
// illustration could show a body-less or duplicate-titled block, and silently
// contradict the rules the doc documents. This mirrors the cq.md/agent-roles.md
// non-empty-body audits, pins glossary's structural surfaces, and self-guards so
// it fails loudly rather than passing vacuously if glossary.md ever stops
// enforcing these rules. The central validation doc's glossary surfaces are
// pinned separately by schema-validation-doc.test.mjs.
describe("glossary.md reference doc states and shows its term-namespace, non-empty-body, and unique-title rules", () => {
  const GLOSSARY_FILE = "glossary.md";
  const NAMESPACE = "term";

  function termBlockRules() {
    const parts = DOC_FOR.get(GLOSSARY_FILE).split(/^## Term block rules$/m);
    expect(parts.length, "glossary.md reference doc has no '## Term block rules' section").toBe(2);
    return parts[1].split(/\n## /)[0];
  }

  it("glossary.md still enforces the #term namespace, non-empty-body, and unique-titles (guard against a vacuous suite)", () => {
    const rule = ONTOLOGY_SCHEMA[GLOSSARY_FILE];
    expect(rule?.namespace, "glossary.md namespace changed — retarget or retire this suite").toBe(
      NAMESPACE,
    );
    expect(
      rule?.perBlock?.nonEmptyBody,
      "glossary.md no longer enforces non-empty-body — retarget or retire this suite",
    ).toBe(true);
    expect(
      rule?.uniqueTitles,
      "glossary.md no longer enforces unique-titles — retarget or retire this suite",
    ).toBe(true);
  });

  it("the 'Term block rules' prose states the #term namespace, a non-empty body, and unique case-insensitive titles", () => {
    const section = termBlockRules();
    expect(section, "Term block rules prose omits the #term namespace tag").toMatch(/`#term` tag/i);
    expect(section, "Term block rules prose omits the non-empty-body requirement").toMatch(
      /non-empty (?:definition )?body/i,
    );
    expect(section, "Term block rules prose omits the unique-title requirement").toMatch(
      /unique[\s\S]*case-insensitive/i,
    );
  });

  it("the enforcement table names the namespace and states the non-empty-body and unique-title rules", () => {
    const rows = tableRows(enforcementSection(GLOSSARY_FILE));
    expect(
      rows.get("namespace-required")?.text,
      "glossary.md enforcement table omits the #term namespace",
    ).toContain(`#${NAMESPACE}`);
    expect(
      rows.get("non-empty-body")?.text,
      "glossary.md enforcement table non-empty-body row omits the wording",
    ).toMatch(/non-empty body/i);
    expect(
      rows.get("unique-titles")?.text,
      "glossary.md enforcement table unique-titles row omits the wording",
    ).toMatch(/unique[\s\S]*case-insensitive/i);
  });

  it("every Block model illustration block carries the #term namespace and a non-empty body", () => {
    const blocks = illustrativeBlocks(GLOSSARY_FILE);
    expect(blocks.length, "glossary.md Block model fence parsed into no blocks").toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block.tags, `Block model term "${block.title}" omits the #term namespace`).toContain(
        NAMESPACE,
      );
      expect(
        block.body.trim().length,
        `Block model term "${block.title}" shows an empty body — contradicts non-empty-body`,
      ).toBeGreaterThan(0);
    }
  });

  it("Block model illustration titles are unique compared case-insensitively", () => {
    const titles = illustrativeBlocks(GLOSSARY_FILE).map((block) => block.title.trim().toLowerCase());
    expect(
      new Set(titles).size,
      "glossary.md Block model fence shows duplicate term titles — contradicts unique-titles",
    ).toBe(titles.length);
  });

  it("every minimal-example block carries the #term namespace and a non-empty body", () => {
    const blocks = parseMarkdownBlocks(exampleFixture(GLOSSARY_FILE), GLOSSARY_FILE);
    expect(blocks.length, "glossary.md example fence parsed into no blocks").toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block.tags, `example term "${block.title}" omits the #term namespace`).toContain(
        NAMESPACE,
      );
      expect(
        block.body.trim().length,
        `example term "${block.title}" shows an empty body — contradicts non-empty-body`,
      ).toBeGreaterThan(0);
    }
  });
});

// schema-reference-identity-required-recommended-tags-v1 — required-tag forces
// identity.md to carry an #identity block AND a #style block (who the agent
// helps, and how it works with them); recommended-tag SHOULD-recommends an
// #operator and a #collaboration block. The identity.md reference doc states and
// shows these tags in two surfaces — the "Validator enforcement" required-tag and
// recommended-tag rows, AND the human-facing "Required blocks" table's "Required
// tag" / "Recommended tags" columns. The enforcement rows are pinned to
// ONTOLOGY_SCHEMA by the generic "rows name every tag..." test above, but the
// "Required blocks" TABLE is otherwise unpinned: its Required-tag column could
// rename #identity -> #persona (still a tag, so nothing else fails) and silently
// contradict the schema one section below. This mirrors the agent-roles
// Required-roles-table audit, pins both columns of the identity Required-blocks
// table to the schema, and self-guards so it fails loudly rather than passing
// vacuously if identity.md ever stops requiring/recommending these tags.
describe("identity.md reference doc Required-blocks table pins the schema's required and recommended tags", () => {
  const IDENTITY_FILE = "identity.md";
  const rule = ONTOLOGY_SCHEMA[IDENTITY_FILE];

  // Cells of every `| ... |` data row under "## <heading>" that names a #tag,
  // ended at the next ## heading so the Optional-blocks table can't leak in.
  function tagRows(heading) {
    const parts = DOC_FOR.get(IDENTITY_FILE).split(new RegExp(`^## ${heading}$`, "m"));
    expect(parts.length, `identity.md reference doc has no "## ${heading}" section`).toBe(2);
    return parts[1]
      .split(/\n## /)[0]
      .split("\n")
      .filter((line) => line.startsWith("| ") && line.includes("`#"))
      .map((line) => line.split("|").map((cell) => cell.trim()).filter(Boolean));
  }

  const tagsInColumn = (rows, index) =>
    rows.flatMap((cells) => [...cells[index].matchAll(/`#([a-z][a-z0-9-]*)`/g)].map((m) => m[1]));

  it("identity.md still requires #identity/#style and recommends #operator/#collaboration (guard against a vacuous suite)", () => {
    expect(
      [...(rule.requiredTags ?? [])].sort(),
      "identity.md required tags changed — retarget or retire this suite",
    ).toEqual(["identity", "style"]);
    expect(
      [...(rule.recommendedTags ?? [])].sort(),
      "identity.md recommended tags changed — retarget or retire this suite",
    ).toEqual(["collaboration", "operator"]);
  });

  it("the Required-blocks table's Required-tag column lists exactly the schema's required tags", () => {
    const tags = tagsInColumn(tagRows("Required blocks"), 1);
    expect(
      [...new Set(tags)].sort(),
      "identity Required-blocks table Required-tag column drifted from the schema's requiredTags",
    ).toEqual([...rule.requiredTags].sort());
  });

  it("the Required-blocks table's Recommended-tags column lists exactly the schema's recommended tags", () => {
    const tags = tagsInColumn(tagRows("Required blocks"), 2);
    expect(
      [...new Set(tags)].sort(),
      "identity Required-blocks table Recommended-tags column drifted from the schema's recommendedTags",
    ).toEqual([...rule.recommendedTags].sort());
  });
});

// schema-reference-projects-required-tag-fields-enum-v1 — projects.md is the one
// schema source with no namespace and no structural per-block rule; what it pins
// instead is a required #active block carrying Name:/Status: field lines, with
// Status: constrained to the STATUS_VALUES enum. The projects.md reference doc
// states and shows these in two surfaces — the "Validator enforcement" rows
// (pinned to ONTOLOGY_SCHEMA by the generic reference-doc tests above), AND the
// human-facing "Required blocks" table ("Required tag" + "Required fields"
// columns) plus the "Field conventions" prose that enumerates the allowed Status
// values. The Required-blocks table and Field-conventions prose are otherwise
// unpinned: the table could rename #active or drop Status:, or the prose could
// omit an enum value, and silently contradict the schema. This audit pins those
// human-facing surfaces to ONTOLOGY_SCHEMA and self-guards so it fails loudly
// rather than passing vacuously if projects.md's tag/fields/enum ever change.
describe("projects.md reference doc Required-blocks table and Field conventions pin the schema's tag, fields, and enum", () => {
  const PROJECTS_FILE = "projects.md";
  const rule = ONTOLOGY_SCHEMA[PROJECTS_FILE];

  function section(heading) {
    const parts = DOC_FOR.get(PROJECTS_FILE).split(new RegExp(`^## ${heading}$`, "m"));
    expect(parts.length, `projects.md reference doc has no "## ${heading}" section`).toBe(2);
    return parts[1].split(/\n## /)[0];
  }

  // The single `#active`-bearing data row of the Required-blocks table, as cells.
  function requiredBlockCells() {
    const row = section("Required blocks")
      .split("\n")
      .find((line) => line.startsWith("| ") && line.includes("`#"));
    expect(row, "projects.md Required-blocks table has no #tag data row").toBeTruthy();
    return row.split("|").map((cell) => cell.trim()).filter(Boolean);
  }

  it("projects.md still requires #active with Name/Status fields and the Status enum (guard against a vacuous suite)", () => {
    expect(
      [...(rule.requiredTags ?? [])].sort(),
      "projects.md required tags changed — retarget or retire this suite",
    ).toEqual(["active"]);
    expect(
      [...(rule.fieldsByTag?.active ?? [])].sort(),
      "projects.md required fields changed — retarget or retire this suite",
    ).toEqual(["Name", "Status"]);
    expect(rule.enumField?.name, "projects.md enum field changed — retarget this suite").toBe("Status");
    expect((rule.enumField?.allowed ?? []).length, "projects.md enum has no values").toBeGreaterThan(0);
  });

  it("the Required-blocks table's Required-tag column lists exactly the schema's required tag", () => {
    const tags = [...requiredBlockCells()[1].matchAll(/`#([a-z][a-z0-9-]*)`/g)].map((m) => m[1]);
    expect(
      [...new Set(tags)].sort(),
      "projects Required-blocks table Required-tag column drifted from the schema's requiredTags",
    ).toEqual([...rule.requiredTags].sort());
  });

  it("the Required-blocks table's Required-fields column names every schema field", () => {
    const fields = [...requiredBlockCells()[2].matchAll(/`([A-Z][A-Za-z]*)`/g)].map((m) => m[1]);
    expect(
      [...new Set(fields)].sort(),
      "projects Required-blocks table Required-fields column drifted from the schema's fieldsByTag",
    ).toEqual([...rule.fieldsByTag.active].sort());
  });

  it("the Field conventions section names the Status field and every allowed enum value", () => {
    const conventions = section("Field conventions");
    expect(conventions, "Field conventions omits the Status: field line").toContain(
      `\`${rule.enumField.name}:\``,
    );
    for (const value of rule.enumField.allowed) {
      expect(conventions, `Field conventions omits Status enum value ${value}`).toContain(`\`${value}\``);
    }
    expect(conventions, "Field conventions omits the enum-field failure rule").toContain("enum-field");
  });
});

// schema-reference-identity-tag-conventions-every-block-tagged-v1 — identity.md is
// the one schema source whose every-block-has-tag rule is enforced by a flag
// (everyBlockHasTag) rather than a namespace. The "Validator enforcement" table
// row is pinned to ONTOLOGY_SCHEMA by the generic reference-doc tests above, and
// its "at least one tag" semantics by the "rows state each structural rule's
// semantics" marker test. But the human-facing "## Tag conventions" PROSE — the
// bullet that tells an author "Every block MUST carry at least one tag;
// agentctx:validate rejects an untagged block (every-block-has-tag error)" — is
// otherwise unguarded: it could drop the requirement or stop naming the
// every-block-has-tag rule and silently contradict the schema the doc documents.
// This pins that prose to the schema's everyBlockHasTag flag and the real rule id,
// self-guarding so it fails loudly rather than passing vacuously if identity.md
// ever stops enforcing every-block-has-tag.
describe("identity.md reference doc Tag conventions prose states the every-block-has-tag requirement", () => {
  const IDENTITY_FILE = "identity.md";
  const RULE = "every-block-has-tag";

  // The "## Tag conventions" section, ended at the next ## heading so prose
  // elsewhere in the doc cannot satisfy a marker.
  function tagConventions() {
    const parts = DOC_FOR.get(IDENTITY_FILE).split(/^## Tag conventions$/m);
    expect(parts.length, "identity.md reference doc has no '## Tag conventions' section").toBe(2);
    return parts[1].split(/\n## /)[0];
  }

  it("identity.md still enforces every-block-has-tag (guard against a vacuous suite)", () => {
    expect(
      ONTOLOGY_SCHEMA[IDENTITY_FILE]?.everyBlockHasTag,
      "identity.md no longer enforces every-block-has-tag — retarget or retire this suite",
    ).toBe(true);
  });

  it("the Tag conventions prose states every block must carry at least one tag", () => {
    expect(
      tagConventions(),
      "Tag conventions prose omits the every-block-has-tag requirement",
    ).toMatch(/every block\b[\s\S]*\bat least one tag/i);
  });

  it("the Tag conventions prose names the every-block-has-tag rule id", () => {
    expect(tagConventions(), "Tag conventions prose omits the every-block-has-tag rule id").toContain(
      `\`${RULE}\``,
    );
    expect(RULE_REMEDIES, `Tag conventions prose names unknown rule "${RULE}"`).toHaveProperty(RULE);
  });
});

// schema-reference-projects-block-model-status-placeholder-enum-v1 — projects.md's
// Block model fence shows the canonical project block shape, including a
// "Status: <active | exploratory | paused | archived>" placeholder that
// enumerates the Status enum inside its angle-bracket placeholder. That fence is
// the illustrative one, deliberately NOT run through validateSource (the
// angle-bracket placeholder would fail enum-field), so the fixture suite above
// leaves its Status enumeration unchecked. The Field-conventions PROSE enum is
// pinned by the Required-blocks/Field-conventions audit above, and the
// enforcement row by the generic reference-doc tests — but the Block model fence's
// placeholder enumeration is otherwise unguarded: it could drop "archived" or list
// a stale value and silently disagree with the schema it is meant to illustrate.
// This pins the placeholder to ONTOLOGY_SCHEMA's enumField by exact set equality,
// self-guarding so it fails loudly rather than passing vacuously if projects.md's
// Status enum ever changes.
describe("projects.md reference doc Block model fence enumerates the Status enum in its placeholder", () => {
  const PROJECTS_FILE = "projects.md";
  const rule = ONTOLOGY_SCHEMA[PROJECTS_FILE];

  // The "Status:" placeholder line of the illustrative Block model fence.
  function statusPlaceholder() {
    const fence = fenceBlocks(PROJECTS_FILE).find((f) => f.section === ILLUSTRATIVE_SECTION);
    expect(fence, "projects.md doc has no Block model fence").toBeTruthy();
    const line = fence.body.split("\n").find((l) => l.trimStart().startsWith("Status:"));
    expect(line, "projects.md Block model fence has no Status: placeholder line").toBeTruthy();
    return line;
  }

  it("projects.md still constrains Status to an enum (guard against a vacuous suite)", () => {
    expect(rule.enumField?.name, "projects.md enum field changed — retarget this suite").toBe("Status");
    expect((rule.enumField?.allowed ?? []).length, "projects.md enum has no values").toBeGreaterThan(0);
  });

  it("the Block model fence's Status placeholder lists exactly the schema's enum values", () => {
    // "Status: <a | b | c>" -> ["a", "b", "c"]; strip the field name and the
    // angle-bracket placeholder, then split the enumeration.
    const inner = statusPlaceholder().replace(/^.*Status:\s*/, "").replace(/[<>]/g, "");
    const shown = inner.split("|").map((value) => value.trim()).filter(Boolean);
    expect(
      [...new Set(shown)].sort(),
      "projects.md Block model Status placeholder drifted from the schema's Status enum",
    ).toEqual([...rule.enumField.allowed].sort());
  });
});

// schema-reference-projects-block-model-name-placeholder-label-v1 — projects.md's
// Block model fence shows the canonical project block shape, including a
// "Name: <short project name>" line. The companion Status placeholder one line
// down is pinned to the enum by the audit above, but the Name placeholder is
// otherwise unguarded: the Block model fence is the illustrative one, never run
// through validateSource (the angle-bracket placeholder body would fail other
// rules), so the fixture suite leaves its Name line unchecked. The "Field
// conventions" prose states Name is "a short human-readable label, not a path or
// URL"; the Block model placeholder is meant to illustrate exactly that shape,
// yet nothing stops it from being rewritten as a path/URL (e.g.
// "Name: /repos/foo" or "Name: https://...") and silently contradicting the
// convention the doc documents one section down. This pins the Block model Name
// placeholder to the label-not-path-or-URL shape AND pins the Field-conventions
// prose that states it, self-guarding so it fails loudly rather than passing
// vacuously if projects.md ever stops requiring a Name field.
describe("projects.md reference doc Block model fence shows Name as a label placeholder, not a path or URL", () => {
  const PROJECTS_FILE = "projects.md";
  const rule = ONTOLOGY_SCHEMA[PROJECTS_FILE];

  // The "Name:" placeholder line of the illustrative Block model fence.
  function namePlaceholder() {
    const fence = fenceBlocks(PROJECTS_FILE).find((f) => f.section === ILLUSTRATIVE_SECTION);
    expect(fence, "projects.md doc has no Block model fence").toBeTruthy();
    const line = fence.body.split("\n").find((l) => l.trimStart().startsWith("Name:"));
    expect(line, "projects.md Block model fence has no Name: placeholder line").toBeTruthy();
    return line;
  }

  // The "## Field conventions" section, ended at the next ## heading so prose
  // elsewhere in the doc cannot satisfy a marker.
  function fieldConventions() {
    const parts = DOC_FOR.get(PROJECTS_FILE).split(/^## Field conventions$/m);
    expect(parts.length, "projects.md reference doc has no '## Field conventions' section").toBe(2);
    return parts[1].split(/\n## /)[0];
  }

  it("projects.md still requires a Name field on #active (guard against a vacuous suite)", () => {
    expect(
      [...(rule.fieldsByTag?.active ?? [])],
      "projects.md no longer requires a Name field — retarget or retire this suite",
    ).toContain("Name");
  });

  it("the Block model fence's Name line is an angle-bracket label placeholder", () => {
    const inner = namePlaceholder().replace(/^.*Name:\s*/, "").trim();
    expect(
      inner,
      "projects.md Block model Name line is not an angle-bracket placeholder",
    ).toMatch(/^<[^<>]+>$/);
    // the placeholder names a label/name, not a path or URL.
    expect(
      inner,
      "projects.md Block model Name placeholder does not describe a name/label",
    ).toMatch(/\b(?:name|label)\b/i);
    const bare = inner.replace(/[<>]/g, "");
    expect(
      bare,
      "projects.md Block model Name placeholder looks like a path or URL, not a label",
    ).not.toMatch(/[/\\]|:\/\//);
  });

  it("the Field conventions prose states Name is a label, not a path or URL", () => {
    const conventions = fieldConventions();
    expect(conventions, "Field conventions omits the Name: field line").toContain("`Name:`");
    expect(
      conventions,
      "Field conventions omits the label-not-a-path-or-URL convention for Name",
    ).toMatch(/label[\s\S]*?not a path or URL/i);
  });
});

// schema-reference-agent-roles-role-block-rules-one-role-tag-v1 — one-role-tag
// (the perBlock.exactlyOneExtraTag rule) is what stops an #agent block from
// carrying two role tags at once: every role block must declare exactly one role
// (besides the #agent namespace), so the hat the agent wears is unambiguous. The
// agent-roles.md reference doc states that requirement in its "Role block rules"
// prose ("carries exactly one **role tag** identifying the role"). The
// enforcement-table one-role-tag row is pinned to its /exactly one/ semantics by
// the generic "rows state each structural rule's semantics" test above, and the
// central validation doc + authoring guide pin their own one-role-tag surfaces in
// their suites. But the "Role block rules" PROSE one-role-tag bullet is otherwise
// unguarded — the sibling non-empty-body bullet has a dedicated audit, this one
// does not — so the prose could drop "exactly one" (or the #agent namespace
// pairing) and silently contradict the rule the doc documents. This mirrors the
// identity.md Tag-conventions prose audit and the agent-roles non-empty-body
// audit, pins the prose to the schema's exactlyOneExtraTag flag, and self-guards
// so it fails loudly rather than passing vacuously if agent-roles.md ever stops
// enforcing one-role-tag.
describe("agent-roles.md reference doc Role block rules prose states the one-role-tag requirement", () => {
  const ROLES_FILE = "agent-roles.md";

  // The "## Role block rules" section, ended at the next ## heading so prose
  // elsewhere in the doc cannot satisfy a marker.
  function roleBlockRules() {
    const parts = DOC_FOR.get(ROLES_FILE).split(/^## Role block rules$/m);
    expect(parts.length, "agent-roles.md reference doc has no '## Role block rules' section").toBe(2);
    return parts[1].split(/\n## /)[0];
  }

  it("agent-roles.md still enforces one-role-tag (guard against a vacuous suite)", () => {
    expect(
      ONTOLOGY_SCHEMA[ROLES_FILE]?.perBlock?.exactlyOneExtraTag,
      "agent-roles.md no longer enforces one-role-tag — retarget or retire this suite",
    ).toBe(true);
  });

  it("the Role block rules prose pairs the #agent namespace with exactly one role tag", () => {
    const section = roleBlockRules();
    expect(section, "Role block rules prose omits the #agent namespace tag").toMatch(
      /`#agent` namespace tag/i,
    );
    expect(section, "Role block rules prose omits the one-role-tag requirement").toMatch(
      /exactly one\s+\*{0,2}role tag/i,
    );
  });
});

// schema-reference-projects-field-line-own-line-shape-v1 — projects.md is the one
// schema source whose blocks carry field lines (Name:/Status:), and the doc tells
// authors the SHAPE of those lines twice: the Block model prose ("A field line is
// `Key: value` on its own line") and the "Field conventions" bullet ("Field lines
// appear before the prose body and each on their own line"). The validator never
// sees that prose: it reads each field with `^Key:\s*(.+)$` under the multiline
// flag (schema.mjs fieldValue), so a field is only seen when it starts its OWN
// line — exactly what the prose claims. The Name and Status field NAMES, the enum
// values, and the enforcement rows are all pinned by the audits above, but the
// "each on their own line" SHAPE prose is otherwise unguarded: it could drop the
// "on its own line" requirement (or claim fields may share a line) and silently
// contradict the line-anchored parser the doc documents. This pins both prose
// surfaces AND proves the contract behaviorally through validateSource — collapsing
// two fields onto one line masks the second from the validator — self-guarding so
// it fails loudly rather than passing vacuously if projects.md ever stops requiring
// per-block fields.
describe("projects.md reference doc states and proves field lines sit each on their own line", () => {
  const PROJECTS_FILE = "projects.md";
  const rule = ONTOLOGY_SCHEMA[PROJECTS_FILE];

  // The "## Field conventions" section, ended at the next ## heading so prose
  // elsewhere in the doc cannot satisfy a marker.
  function fieldConventions() {
    const parts = DOC_FOR.get(PROJECTS_FILE).split(/^## Field conventions$/m);
    expect(parts.length, "projects.md reference doc has no '## Field conventions' section").toBe(2);
    return parts[1].split(/\n## /)[0];
  }

  // The whole "## Block model" section, ended at the next real top-level heading
  // ("## Required blocks"). The intro helper used elsewhere stops at the fence,
  // but the field-line-shape sentence sits AFTER the illustrative fence, so the
  // section is bounded by the named next heading instead — the fence's interior
  // "## Active project" heading is not that name, so it cannot terminate early.
  function blockModelSection() {
    const parts = DOC_FOR.get(PROJECTS_FILE).split(/^## Block model$/m);
    expect(parts.length, "projects.md reference doc has no '## Block model' section").toBe(2);
    const end = parts[1].split(/^## Required blocks$/m);
    expect(end.length, "projects.md Block model section has no following '## Required blocks'").toBeGreaterThan(1);
    return end[0];
  }

  it("projects.md still requires at least two per-block fields (guard against a vacuous suite)", () => {
    // "each on their own line" is only a meaningful contract when a block carries
    // more than one field; this suite is built around the active block's fields.
    expect(
      [...(rule.fieldsByTag?.active ?? [])].sort(),
      "projects.md per-block fields changed — retarget or retire this suite",
    ).toEqual(["Name", "Status"]);
    expect(rule.enumField?.name, "projects.md enum field changed — retarget this suite").toBe("Status");
  });

  it("the Block model prose states a field line sits on its own line", () => {
    expect(blockModelSection(), "Block model prose omits the per-line field-line shape").toMatch(
      /field line is `Key: value` on its own line/i,
    );
  });

  it("the Field conventions prose states field lines sit before the body, each on their own line", () => {
    const conventions = fieldConventions();
    expect(
      conventions,
      "Field conventions omits the 'each on their own line' field-line shape",
    ).toMatch(/field lines[\s\S]*each on their own line/i);
    expect(
      conventions,
      "Field conventions omits that field lines precede the prose body",
    ).toMatch(/before the prose body/i);
  });

  it("validates clean when the two fields sit each on their own line", () => {
    const [first, second] = rule.fieldsByTag.active;
    const value = (field) => (field === rule.enumField?.name ? rule.enumField.allowed[0] : "Sample");
    const source =
      `# Projects\n\n## Active project #project #active\n\n` +
      `${first}: ${value(first)}\n${second}: ${value(second)}\n\n` +
      `What this project is and why it matters.\n`;
    expect(
      validateSource(PROJECTS_FILE, source, rule),
      "projects.md rejects fields placed each on their own line",
    ).toEqual([]);
  });

  it("masks the second field when both are crammed onto one line — proving the per-line contract", () => {
    const [first, second] = rule.fieldsByTag.active;
    const value = (field) => (field === rule.enumField?.name ? rule.enumField.allowed[0] : "Sample");
    // Same two fields, same values — but the second no longer starts its own line.
    const source =
      `# Projects\n\n## Active project #project #active\n\n` +
      `${first}: ${value(first)} ${second}: ${value(second)}\n\n` +
      `What this project is and why it matters.\n`;
    const issues = validateSource(PROJECTS_FILE, source, rule);
    const missing = issues.find((issue) => issue.rule === "required-field");
    expect(
      missing,
      `projects.md still sees ${second}: when it shares a line — contradicts "each on their own line"`,
    ).toBeTruthy();
    expect(missing.message, `required-field error does not name the masked ${second}: field`).toContain(
      `${second}:`,
    );
  });
});

// schema-reference-projects-optional-blocks-fields-enum-v1 — projects.md's
// "## Optional blocks" table documents the Secondary and Archived project blocks.
// Unlike the Required-blocks table (pinned by
// schema-reference-projects-required-tag-fields-enum-v1 above), the optional
// blocks carry NO schema-enforced tag: #secondary/#archived/#project are template
// conventions with no ONTOLOGY_SCHEMA anchor (the doc itself states
// agentctx:validate does not enforce #project), so there is nothing in the schema
// to pin those tag tokens to. What IS schema-anchored about the optional blocks is
// the field/enum prose the table reuses from the active block: the Secondary row
// reuses the "Name / Status" field set (the schema's fieldsByTag.active), and the
// Archived row pins "Status: archived" — a Status value that, like every block
// carrying a Status: line, must sit in the schema's Status enum (the enum-field
// rule applies to optional blocks too, as the Field conventions prose states).
// Those human-facing surfaces are otherwise unpinned: the Archived row could drift
// to "Status: retired" (not in the enum), or the Secondary row could name a field
// the schema does not define, and silently contradict the schema one section up.
// This mirrors the Required-blocks-table audit, pins the Optional-blocks table's
// Status values to the schema's enum and its field names to fieldsByTag.active,
// pins the prose that makes optional-block Status values matter, and pins that no
// optional row claims the required #active tag — self-guarding so it fails loudly
// rather than passing vacuously if projects.md's fields/enum/required tag change.
describe("projects.md reference doc Optional-blocks table pins the schema's fields, Status enum, and required tag", () => {
  const PROJECTS_FILE = "projects.md";
  const rule = ONTOLOGY_SCHEMA[PROJECTS_FILE];

  function section(heading) {
    const parts = DOC_FOR.get(PROJECTS_FILE).split(new RegExp(`^## ${heading}$`, "m"));
    expect(parts.length, `projects.md reference doc has no "## ${heading}" section`).toBe(2);
    return parts[1].split(/\n## /)[0];
  }

  // The `#tag`-bearing data rows of the Optional-blocks table, each as cells
  // (the header and separator rows carry no `#tag token, so they drop out).
  function optionalBlockRows() {
    const rows = section("Optional blocks")
      .split("\n")
      .filter((line) => line.startsWith("| ") && line.includes("`#"))
      .map((line) => line.split("|").map((cell) => cell.trim()).filter(Boolean));
    expect(rows.length, "projects.md Optional-blocks table has no #tag data rows").toBeGreaterThan(0);
    return rows;
  }

  it("projects.md still requires #active with Name/Status fields and the Status enum (guard against a vacuous suite)", () => {
    expect(
      [...(rule.requiredTags ?? [])].sort(),
      "projects.md required tags changed — retarget or retire this suite",
    ).toEqual(["active"]);
    expect(
      [...(rule.fieldsByTag?.active ?? [])].sort(),
      "projects.md required fields changed — retarget or retire this suite",
    ).toEqual(["Name", "Status"]);
    expect(rule.enumField?.name, "projects.md enum field changed — retarget this suite").toBe("Status");
    expect((rule.enumField?.allowed ?? []).length, "projects.md enum has no values").toBeGreaterThan(0);
  });

  it("every field the Optional-blocks table names is exactly the schema's active-block field set", () => {
    // Bare `Name` / `Status` backticked field tokens (capitalized, no trailing
    // ": value"); the Archived row's `Status: archived` is a value reference
    // handled by the enum test below, not a bare field token, so it does not
    // match here.
    const fields = [...new Set(
      optionalBlockRows().flatMap((cells) =>
        [...cells.join(" ").matchAll(/`([A-Z][A-Za-z]*)`/g)].map((m) => m[1]),
      ),
    )];
    expect(fields.length, "Optional-blocks table names no Name/Status field tokens").toBeGreaterThan(0);
    expect(
      fields.sort(),
      "projects Optional-blocks table field names drifted from the schema's fieldsByTag.active",
    ).toEqual([...rule.fieldsByTag.active].sort());
  });

  it("every Status value the Optional-blocks table names sits in the schema's Status enum", () => {
    const values = [...new Set(
      [...section("Optional blocks").matchAll(/`Status:\s*([a-z]+)`/g)].map((m) => m[1]),
    )];
    expect(
      values.length,
      "Optional-blocks table names no `Status: <value>` reference — the Archived row should pin one",
    ).toBeGreaterThan(0);
    for (const value of values) {
      expect(
        rule.enumField.allowed,
        `Optional-blocks table Status value "${value}" is not in the schema's Status enum`,
      ).toContain(value);
    }
  });

  it("no Optional-blocks row claims the required #active tag (optional blocks are not the active block)", () => {
    for (const cells of optionalBlockRows()) {
      const tags = [...cells.join(" ").matchAll(/#([a-z][a-z0-9-]*)/g)].map((m) => m[1]);
      for (const required of rule.requiredTags) {
        expect(
          tags,
          `Optional-blocks row "${cells[0]}" claims the required #${required} tag`,
        ).not.toContain(required);
      }
    }
  });

  it("the Field conventions prose states the Status enum applies to optional blocks too", () => {
    const conventions = section("Field conventions");
    expect(conventions, "Field conventions omits the enum-field rule").toContain("enum-field");
    expect(
      conventions,
      "Field conventions omits that the Status enum applies to optional project blocks",
    ).toMatch(/optional project blocks included/i);
  });
});
