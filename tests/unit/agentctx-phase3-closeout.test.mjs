import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const path = (rel) => resolve(REPO_ROOT, rel);

const PHASE3_DOCS = [
  "docs/mind-ontology-claude-code-setup-proof-v0.md",
  "docs/mind-ontology-codex-setup-proof-v0.md",
  "docs/mind-ontology-cursor-setup-proof-v0.md",
  "docs/mind-ontology-thin-connector-strategy-v0.md",
  "docs/mind-ontology-http-endpoint-design-v0.md",
  "docs/mind-ontology-selfhost-deployment-plan-v0.md",
  "docs/mind-ontology-connector-manifests-v0.md",
  "docs/mind-ontology-phase-3-closeout-v0.md",
];

const PHASE3_TEMPLATES = [
  "docs/agentctx-setup/claude-code.mcp.json",
  "docs/agentctx-setup/codex-config.toml",
  "docs/agentctx-setup/cursor.mcp.json",
  "docs/agentctx-setup/mind-ontology-connector.openapi.json",
  "docs/agentctx-setup/claude-ai-connector.example.json",
  "docs/agentctx-setup/chatgpt-connector.example.json",
];

describe("Phase 3 closeout (P3-PR08)", () => {
  it("ships every Phase 3 doc", () => {
    for (const doc of PHASE3_DOCS) {
      expect(existsSync(path(doc)), `missing ${doc}`).toBe(true);
    }
  });

  it("ships every Phase 3 client/connector template", () => {
    for (const tpl of PHASE3_TEMPLATES) {
      expect(existsSync(path(tpl)), `missing ${tpl}`).toBe(true);
    }
  });

  it("the closeout records all six client surfaces", () => {
    const text = readFileSync(path("docs/mind-ontology-phase-3-closeout-v0.md"), "utf8");
    for (const client of ["Claude Code", "Codex", "Cursor", "ChatGPT", "Claude.ai"]) {
      expect(text.includes(client), `closeout omits ${client}`).toBe(true);
    }
    expect(text).toContain("get_context");
    expect(text).toContain("list_constraints");
  });
});
