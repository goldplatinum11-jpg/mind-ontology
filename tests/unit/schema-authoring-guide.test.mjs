import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ONTOLOGY_SCHEMA, STATUS_VALUES } from "../../scripts/agentctx/schema.mjs";
import { SOURCE_FILES, parseMarkdownBlocks } from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const GUIDE = readFileSync(resolve(REPO_ROOT, "docs/schema-authoring.md"), "utf8");

// M44 — the consolidated authoring guide must stay consistent with the actual
// validator rules. If ONTOLOGY_SCHEMA changes (a required tag, the Status enum,
// a namespace), this fails so the guide is updated rather than drifting.
describe("schema authoring guide matches ONTOLOGY_SCHEMA (M44)", () => {
  it("documents every compiled source file", () => {
    for (const file of SOURCE_FILES) {
      expect(GUIDE, `guide omits ${file}`).toContain(file);
    }
  });

  it("names every required tag the validator enforces", () => {
    for (const [file, rule] of Object.entries(ONTOLOGY_SCHEMA)) {
      for (const tag of rule.requiredTags ?? []) {
        expect(GUIDE, `guide (${file}) omits required tag #${tag}`).toContain(`#${tag}`);
      }
      if (rule.namespace) {
        expect(GUIDE, `guide omits namespace #${rule.namespace}`).toContain(`#${rule.namespace}`);
      }
    }
  });

  it("lists the exact Status enum values projects.md allows", () => {
    for (const value of STATUS_VALUES) {
      expect(GUIDE, `guide omits Status value ${value}`).toContain(value);
    }
  });

  it("states the constraints.md required/always-included contract", () => {
    expect(GUIDE.toLowerCase()).toContain("required");
    expect(GUIDE.toLowerCase()).toContain("always included");
    // projects field requirements are named.
    expect(GUIDE).toContain("Name:");
    expect(GUIDE).toContain("Status:");
  });
});

// The guide's "Per-file rules" prose, sliced into one section per `### \`file\``
// heading. Each section ends at the next ### or ## heading so a marker stated
// for one file can't satisfy the check for another.
const SECTION_FOR = new Map(
  GUIDE.split(/^### /m)
    .slice(1)
    .map((part) => part.split(/\n##? /)[0])
    .map((section) => [section.match(/`([^`]+)`/)?.[1], section]),
);

// schema-authoring-structural-rules-v1 — M44 pins tags and enums; this pins the
// structural rule prose per file. Each marker maps an ONTOLOGY_SCHEMA switch to
// the phrasing the guide must use, so enabling/disabling a structural rule (or
// changing its semantics, e.g. case-insensitive titles) fails here.
describe("guide per-file sections state every structural rule (M44 extension)", () => {
  it("has a dedicated section for every schema-governed file", () => {
    for (const file of Object.keys(ONTOLOGY_SCHEMA)) {
      expect(SECTION_FOR.has(file), `guide has no ### section for ${file}`).toBe(true);
    }
  });

  it("each section states the structural rules its schema entry enables", () => {
    const MARKERS = [
      ["required (exists, non-empty)", (rule) => rule.required, /non-empty/i],
      ["every-block-has-tag", (rule) => rule.everyBlockHasTag, /at least one tag/i],
      ["unique-titles (case-insensitive)", (rule) => rule.uniqueTitles, /unique[\s\S]*case-insensitive/i],
      ["non-empty-body", (rule) => rule.perBlock?.nonEmptyBody, /non-empty body/i],
      ["question-title", (rule) => rule.perBlock?.questionTitle, /question[\s\S]*\?/i],
      ["one-role-tag", (rule) => rule.perBlock?.exactlyOneExtraTag, /exactly one/i],
      ["topic-tag", (rule) => rule.perBlock?.requireExtraTopicTag, /topic tag/i],
    ];
    for (const [file, rule] of Object.entries(ONTOLOGY_SCHEMA)) {
      const section = SECTION_FOR.get(file);
      for (const [name, enabled, pattern] of MARKERS) {
        if (enabled(rule)) {
          expect(section, `${file} section omits the ${name} rule`).toMatch(pattern);
        }
      }
    }
  });

  it("each section names its own namespace and required tags", () => {
    for (const [file, rule] of Object.entries(ONTOLOGY_SCHEMA)) {
      const section = SECTION_FOR.get(file);
      if (rule.namespace) {
        expect(section, `${file} section omits namespace #${rule.namespace}`).toContain(`#${rule.namespace}`);
      }
      for (const tag of rule.requiredTags ?? []) {
        expect(section, `${file} section omits required tag #${tag}`).toContain(`#${tag}`);
      }
    }
  });
});

// Normalized for line-based fence parsing; the pins above use the raw text.
const GUIDE_NORMALIZED = GUIDE.replace(/\r\n/g, "\n");

// The only fence class the guide may contain, keyed by the ## heading the
// fence sits under (the same classification scheme as the per-file reference
// docs in schema-reference-docs.test.mjs). The guide carries no executable
// fixture: its one fence is an angle-bracket placeholder skeleton, so there is
// no schema entry to validate it against — the validated minimal examples live
// in the per-file reference docs and run as fixtures there.
const ILLUSTRATIVE_GUIDE_SECTION = "Block format (shared by every file)";

// Every fenced code block in the guide with its info string, body, and the ##
// section heading above it. Section tracking is fence-aware: the skeleton's
// own "## <Block heading>" line is fence content, not a document section. ###
// subheadings do not reset the section, so a fence added under a "Per-file
// rules" entry is classified by that ## section and fails as unclassified.
function guideFences() {
  const fences = [];
  let section = null;
  let open = null;
  for (const line of GUIDE_NORMALIZED.split("\n")) {
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
  expect(open, "schema-authoring.md has an unterminated fence").toBeNull();
  return fences;
}

// schema-authoring-fence-classification-v1 — every fence in the guide has a
// deterministic class. Today that is exactly one illustrative fence; a new
// fence under any other heading is unclassified and fails here until it is
// classified (and, if meant to be conformant, moved to a reference doc where
// the fixture tests can execute it).
describe("schema authoring guide fences are classified", () => {
  it("every fence sits under the block-format heading — none unclassified", () => {
    for (const fence of guideFences()) {
      expect(
        [ILLUSTRATIVE_GUIDE_SECTION],
        `guide has an unclassified \`\`\`${fence.lang} fence under "## ${fence.section}"`,
      ).toContain(fence.section);
    }
  });

  it("the guide has exactly one fence: the ```md block-format skeleton", () => {
    const fences = guideFences();
    expect(fences.length, "guide fence inventory changed; classify the new fence").toBe(1);
    expect(fences[0].lang, "block-format skeleton fence is not ```md").toBe("md");
  });

  it("the block-format intro labels its fence illustrative and not validated", () => {
    const parts = GUIDE_NORMALIZED.split(/^## Block format \(shared by every file\)$/m);
    expect(parts.length, 'guide has no "## Block format (shared by every file)" section').toBe(2);
    const intro = parts[1].split("```")[0];
    expect(intro, "guide does not label its skeleton fence illustrative").toMatch(/illustrative only/i);
    expect(intro, "guide does not state its skeleton fence is not validated").toMatch(/not\s+validated/i);
  });

  it("the skeleton is placeholder-shaped, so validating it stays out of scope", () => {
    const [fence] = guideFences();
    expect(fence.body, "skeleton fence lost its angle-bracket placeholders").toMatch(/<[^>]+>/);
  });

  it("the guide never presents a fence as a conformant example", () => {
    expect(GUIDE, "guide claims a conformant fence; that belongs in a reference doc").not.toMatch(
      /\bconformant\b/i,
    );
  });
});

// The block-format section (skeleton fence + the bullet rules below it), ended
// at the next real ## section so a rule stated under "Per-file rules" cannot
// satisfy a block-format claim. The cut is the literal "## Per-file rules"
// heading, not a bare `^## `, because the skeleton fence carries its own
// "## <Block heading>" line that a bare split would mistake for a section end.
function blockFormatSection() {
  const parts = GUIDE_NORMALIZED.split(/^## Block format \(shared by every file\)$/m);
  expect(parts.length, 'guide has no "## Block format (shared by every file)" section').toBe(2);
  const ended = parts[1].split(/^## Per-file rules$/m);
  expect(ended.length, 'guide has no "## Per-file rules" section after block format').toBe(2);
  return ended[0];
}

// schema-authoring-illustrative-tags-v1 — the block-format skeleton is the
// guide's one fence and the only place the shared block model is shown. Like
// the per-file reference docs' Block model fences (schema-reference-illustrative-tags-v1
// in schema-reference-docs.test.mjs), it is a placeholder skeleton we never run
// through validateSource — its `<File Title>` / `<Block heading>` tokens would
// not validate. But its job is to demonstrate the three rules the prose states
// right below it: a single `#` H1 title (ignored by the compiler), a `##` block
// whose inline `#tag` tokens are extracted as tags and stripped from the title,
// and a non-empty body. We parse it with the real compiler parser (the same tag
// extraction the validator sees), so editing the skeleton to drop its inline
// tags, body, or block heading — or the prose to drop those rules — fails here,
// without forcing the `<...>` placeholders to fully validate.
describe("schema-authoring-illustrative-tags-v1 — skeleton illustrates the block model", () => {
  const skeletonBlocks = () => parseMarkdownBlocks(guideFences()[0].body, "skeleton");

  it("parses into exactly one ## block — the `#` H1 title is ignored", () => {
    expect(
      skeletonBlocks().length,
      "skeleton no longer shows exactly one ## block above an ignored H1 title",
    ).toBe(1);
  });

  it("extracts the inline #tag tokens the prose says are extracted", () => {
    const [block] = skeletonBlocks();
    expect(
      block.tags.length,
      "skeleton block heading illustrates no inline #tag tokens",
    ).toBeGreaterThan(0);
  });

  it("strips the extracted tags from the rendered title but keeps them on the heading", () => {
    const [block] = skeletonBlocks();
    expect(block.title, "skeleton rendered title still carries a #tag token").not.toMatch(
      /#[A-Za-z0-9_-]/,
    );
    expect(block.heading, "skeleton raw heading lost its inline #tag tokens").toMatch(
      /#[A-Za-z0-9_-]/,
    );
  });

  it("has a non-empty body, as the prose requires", () => {
    const [block] = skeletonBlocks();
    expect(block.body.trim().length, "skeleton block illustrates an empty body").toBeGreaterThan(0);
  });

  it("keeps the block heading an angle-bracket placeholder, never a real tagged title", () => {
    const [block] = skeletonBlocks();
    expect(block.title, "skeleton block heading is no longer a `<...>` placeholder").toMatch(
      /<[^>]+>/,
    );
  });

  it("the block-format prose states the three rules the skeleton illustrates", () => {
    const prose = blockFormatSection();
    expect(prose, "block-format prose drops the one-H1-title rule").toContain("H1 title");
    expect(prose, "block-format prose drops inline #tag extraction").toContain(
      "inline `#tag` tokens are extracted as tags",
    );
    expect(prose, "block-format prose drops the tag-stripping rule").toContain(
      "stripped from the rendered title",
    );
    expect(prose, "block-format prose drops the non-empty-body rule").toContain("non-empty body");
  });
});
