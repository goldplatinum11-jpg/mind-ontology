import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const setup = (name) => resolve(REPO_ROOT, "docs/agentctx-setup", name);

const MANIFESTS = ["claude-ai-connector.example.json", "chatgpt-connector.example.json"];
const PLACEHOLDER = "YOUR-CONNECTOR-HOST.example";

describe("connector manifest examples (P3-PR07)", () => {
  it("ships valid JSON manifests", () => {
    for (const name of MANIFESTS) {
      expect(existsSync(setup(name)), `missing ${name}`).toBe(true);
      expect(() => JSON.parse(readFileSync(setup(name), "utf8"))).not.toThrow();
    }
  });

  it("uses placeholder hosts and no real endpoint", () => {
    for (const name of MANIFESTS) {
      const raw = readFileSync(setup(name), "utf8");
      expect(raw).toContain(PLACEHOLDER);
      // No real Cloudflare/Workers or other concrete hosts.
      expect(raw).not.toMatch(/https:\/\/[a-z0-9-]+\.workers\.dev/i);
    }
  });

  it("pins each manifest to the two read-only tools", () => {
    const claude = JSON.parse(readFileSync(setup("claude-ai-connector.example.json"), "utf8"));
    expect(claude.tools).toEqual(["get_context", "list_constraints"]);

    const chatgpt = JSON.parse(readFileSync(setup("chatgpt-connector.example.json"), "utf8"));
    expect(chatgpt.type).toBe("mcp");
    expect(chatgpt.allowed_tools).toEqual(["get_context", "list_constraints"]);
  });

  it("carries no credential value", () => {
    for (const name of MANIFESTS) {
      const raw = readFileSync(setup(name), "utf8");
      // No bearer/token assignment with an actual value.
      expect(raw).not.toMatch(/\b(bearer\s+[A-Za-z0-9._-]{12,})/i);
      expect(raw).not.toMatch(/("?(authorization|api[_-]?key)"?\s*[:=]\s*")[^"]{8,}/i);
    }
  });

  it("ships the manifest guide doc", () => {
    expect(existsSync(resolve(REPO_ROOT, "docs/mind-ontology-connector-manifests-v0.md"))).toBe(true);
  });
});
