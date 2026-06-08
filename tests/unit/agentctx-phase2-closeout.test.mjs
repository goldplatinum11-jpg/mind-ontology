import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const docPath = (name) => resolve(REPO_ROOT, "docs", name);

const SCHEMA_DOCS = [
  "mind-ontology-identity-schema-v0.md",
  "mind-ontology-projects-schema-v0.md",
  "mind-ontology-glossary-schema-v0.md",
  "mind-ontology-agent-roles-schema-v0.md",
  "mind-ontology-cq-schema-v0.md",
  "mind-ontology-schema-validation-v0.md",
  "mind-ontology-task-risk-modes-v0.md",
  "mind-ontology-phase-2-closeout-v0.md",
];

const REQUIRED_SCRIPTS = [
  "agentctx:compile",
  "agentctx:init",
  "agentctx:validate",
  "agentctx:metrics",
  "agentctx:smoke",
];

describe("Phase 2 closeout (P2-PR10)", () => {
  it("ships every Phase 2 schema and reference doc", () => {
    for (const doc of SCHEMA_DOCS) {
      expect(existsSync(docPath(doc)), `missing doc: ${doc}`).toBe(true);
    }
  });

  it("exposes every Phase 2 npm command", () => {
    const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));
    for (const script of REQUIRED_SCRIPTS) {
      expect(pkg.scripts[script], `missing npm script: ${script}`).toBeTruthy();
    }
  });

  it("the closeout doc indexes the per-source schemas", () => {
    const closeout = readFileSync(docPath("mind-ontology-phase-2-closeout-v0.md"), "utf8");
    for (const source of ["identity.md", "projects.md", "glossary.md", "agent-roles.md", "cq.md"]) {
      expect(closeout.includes(source), `closeout does not mention ${source}`).toBe(true);
    }
  });
});
