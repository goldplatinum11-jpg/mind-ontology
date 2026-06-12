import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ONTOLOGY_SCHEMA, STATUS_VALUES } from "../../scripts/agentctx/schema.mjs";
import { SOURCE_FILES } from "../../scripts/agentctx/compile.mjs";

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
