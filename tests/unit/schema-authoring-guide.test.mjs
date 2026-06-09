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
