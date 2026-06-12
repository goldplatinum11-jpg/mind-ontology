import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ONTOLOGY_SCHEMA,
  RULE_REMEDIES,
  SCHEMA_AUTHORING_DOC,
  renderReport,
  validateOntology,
  validateSource,
} from "../../scripts/agentctx/schema.mjs";

const tempRoots = [];
function makeTempRoot() {
  const dir = mkdtempSync(join(tmpdir(), "agentctx-msg-"));
  tempRoots.push(dir);
  return dir;
}
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

const CONSTRAINTS = "# Constraints\n\n## Keep it safe #safety\n\nDo not make destructive changes.\n";
function makeProject(extra = {}) {
  const cwd = makeTempRoot();
  mkdirSync(join(cwd, ".agentctx"));
  writeFileSync(join(cwd, ".agentctx", "constraints.md"), CONSTRAINTS);
  for (const [file, content] of Object.entries(extra)) {
    writeFileSync(join(cwd, ".agentctx", file), content);
  }
  return cwd;
}

// M8 — validation OUTPUT must be clear and actionable for a user reading the CLI.
describe("schema validation message quality (M8)", () => {
  it("a clean project renders an unambiguous VALID summary", () => {
    const text = renderReport(validateOntology(makeProject()));
    expect(text).toContain("VALID");
    expect(text).toMatch(/0 error\(s\)/);
    expect(text).toContain("conforms");
  });

  it("a missing .agentctx renders INVALID plus an actionable next step", () => {
    const text = renderReport(validateOntology(makeTempRoot()));
    expect(text).toContain("INVALID");
    // The remediation must name the exact command, not just say 'invalid'.
    expect(text).toContain("agentctx:init");
    expect(text).toMatch(/\[missing-dir\]/);
  });

  it("every rendered issue carries its rule tag and names the offending file", () => {
    const cwd = makeProject({
      "projects.md": "# Projects\n\n## Active #project #active\n\nName: Demo\nStatus: nonsense\n\nbody\n",
    });
    const report = validateOntology(cwd);
    const text = renderReport(report);
    expect(report.ok).toBe(false);
    for (const issue of report.issues) {
      expect(text).toContain(`[${issue.rule}]`);
      expect(text).toContain(issue.file);
    }
    // The enum error must spell out the allowed values so the user can fix it.
    expect(text).toContain("allowed:");
  });

  // Remedy contract (validate-remedy-hints-v1): every issue line is followed by
  // a concrete "fix:" line, and a failing report points at the authoring doc.
  it("every issue carries a remedy and renders it as a fix: line", () => {
    const cwd = makeProject({
      "identity.md": "# Identity\n\n## Operator profile #identity #operator\n\nWho.\n",
      "projects.md": "# Projects\n\n## Active #project #active\n\nName: Demo\nStatus: nonsense\n\nbody\n",
      "glossary.md": "# Glossary\n\n## Term #term #topic\n\none\n\n## Term #term #topic\n\ntwo\n",
    });
    const report = validateOntology(cwd);
    const text = renderReport(report);
    expect(report.ok).toBe(false);
    for (const issue of report.issues) {
      expect(issue.remedy, `rule ${issue.rule} must map to a remedy`).toBeTruthy();
      expect(text).toContain(`fix: ${issue.remedy}`);
    }
  });

  it("remedies are parameterized with the offending tag, field, and allowed values", () => {
    const report = validateOntology(
      makeProject({
        "identity.md": "# Identity\n\n## Operator profile #identity #operator\n\nWho.\n",
        "projects.md": "# Projects\n\n## Active #project #active\n\nbody\n",
      }),
    );
    const byRule = Object.fromEntries(report.issues.map((i) => [i.rule, i]));
    expect(byRule["required-tag"].remedy).toContain("#style");
    expect(byRule["required-tag"].remedy).toContain("identity.md");
    expect(byRule["required-field"].remedy).toMatch(/"(Name|Status): <value>"/);

    const enumIssue = validateOntology(
      makeProject({
        "projects.md": "# Projects\n\n## Active #project #active\n\nName: D\nStatus: nope\n\nbody\n",
      }),
    ).issues.find((i) => i.rule === "enum-field");
    expect(enumIssue.remedy).toContain("active, exploratory, paused, archived");
  });

  it("a missing .agentctx remedy still names the init command", () => {
    const report = validateOntology(makeTempRoot());
    expect(report.issues[0].rule).toBe("missing-dir");
    expect(report.issues[0].remedy).toContain("agentctx:init");
  });

  it("an INVALID report links the schema authoring doc; a VALID report does not", () => {
    expect(renderReport(validateOntology(makeTempRoot()))).toContain(SCHEMA_AUTHORING_DOC);
    expect(renderReport(validateOntology(makeProject()))).not.toContain(SCHEMA_AUTHORING_DOC);
  });

  it("RULE_REMEDIES covers every rule validateSource can emit", () => {
    // Drive every per-source rule branch with one deliberately broken file each,
    // so a future rule added without a remedy fails here, not in front of a user.
    const fixtures = [
      ["identity.md", "# I\n\n## Untagged\n\nbody\n\napi_key: x\n"],
      ["projects.md", "# P\n\n## Active #project #active\n\nStatus: nope\n"],
      ["glossary.md", "# G\n\n## Term #term\n\n## Term #term #topic\n\nx\n## Term #term #topic\n\nx\n"],
      ["agent-roles.md", "# A\n\n## Role #agent\n\nx\n"],
      ["cq.md", "# Q\n\n## Not a question #cq\n"],
    ];
    const seen = new Set();
    for (const [file, raw] of fixtures) {
      for (const issue of validateSource(file, raw, ONTOLOGY_SCHEMA[file])) {
        seen.add(issue.rule);
        expect(issue.remedy, `rule ${issue.rule} has no remedy`).toBeTruthy();
        expect(RULE_REMEDIES[issue.rule], `RULE_REMEDIES missing ${issue.rule}`).toBeTypeOf("function");
      }
    }
    // Sanity: the sweep actually exercised the per-block rule family.
    for (const rule of ["no-credentials", "every-block-has-tag", "required-tag", "enum-field", "topic-tag", "one-role-tag", "non-empty-body", "question-title", "unique-titles"]) {
      expect(seen, `fixture sweep should trigger ${rule}`).toContain(rule);
    }
  });
});
