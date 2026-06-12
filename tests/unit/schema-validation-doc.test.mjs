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
