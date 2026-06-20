import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-connector-setup-v0.md");
const read = () => readFileSync(DOC, "utf8");
const REAL_URL = /https:\/\/[a-z0-9.-]+\.(workers\.dev|com|net|org|io)\//i;

describe("hosted connector setup & troubleshooting doc (PR5)", () => {
  it("ships the setup doc and is linked from the docs index", () => {
    expect(existsSync(DOC)).toBe(true);
    const index = readFileSync(resolve(REPO_ROOT, "docs/mind-ontology.md"), "utf8");
    expect(index).toContain("mind-ontology-connector-setup-v0.md");
  });

  it("explains both surfaces: GPT Action (JSON-only) and remote MCP", () => {
    const t = read();
    expect(t).toContain("GPT Action");
    expect(t).toMatch(/remote MCP/i);
    expect(t).toContain("/mcp");
    expect(t).toContain("/get_context");
    // GPT Action stays JSON-only in the doc.
    expect(t).toMatch(/JSON[- ]only/i);
  });

  it("covers the documented failure modes: 401, 404, 405, protocol mismatch, malformed JSON", () => {
    const t = read();
    for (const status of ["401", "404", "405"]) {
      expect(t, `troubleshooting omits ${status}`).toContain(status);
    }
    expect(t).toMatch(/protocol mismatch/i);
    expect(t).toMatch(/-32700|parse error/i);
    expect(t).toMatch(/malformed json/i);
  });

  it("points at the connector package guide for exact build commands", () => {
    expect(read()).toContain("connector/worker/README.md");
    expect(existsSync(resolve(REPO_ROOT, "connector/worker/README.md"))).toBe(true);
  });

  it("uses only the placeholder host and never implies the repo hosts a live endpoint", () => {
    const t = read();
    expect(t).toContain("https://YOUR-CONNECTOR-HOST.example");
    expect(t).not.toMatch(REAL_URL);
    expect(t).toMatch(/hosts nothing/i);
    expect(t).toMatch(/operator-gated|out of scope/i);
    // No committed credential value.
    expect(t).not.toMatch(/bearer\s+[A-Za-z0-9._-]{12,}/i);
  });

  it("guides a non-engineer operator (which-surface table, paste-into-UI, no-tools, no code-reading)", () => {
    const t = read();
    // "Which surface do I use?" maps each client to its surface.
    expect(t).toMatch(/which surface do i use/i);
    expect(t).toMatch(/stdio MCP/i);
    expect(t).toContain("agent-setup --target");
    // "What to paste into your client's UI" covers all three manifests by client.
    expect(t).toMatch(/what to paste into your client/i);
    expect(t).toMatch(/Settings\s*→\s*Connectors|Add custom connector/i);
    expect(t).toContain("developer mode");
    // Troubleshooting covers tools not appearing.
    expect(t).toMatch(/no tools showing up/i);
    // The operator is never told to read source code to proceed.
    expect(t).not.toMatch(/read the (source|code)|inspect the (source|code)|see the code/i);
  });
});
