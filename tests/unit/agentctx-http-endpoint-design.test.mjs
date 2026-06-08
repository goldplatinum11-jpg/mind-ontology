import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SPEC = resolve(REPO_ROOT, "docs/agentctx-setup/mind-ontology-connector.openapi.json");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-http-endpoint-design-v0.md");

function loadSpec() {
  return JSON.parse(readFileSync(SPEC, "utf8"));
}

describe("HTTP endpoint design (P3-PR05)", () => {
  it("ships a valid OpenAPI 3.1 connector spec", () => {
    expect(existsSync(SPEC)).toBe(true);
    const spec = loadSpec();
    expect(spec.openapi).toMatch(/^3\.1/);
    expect(spec.info?.title).toBeTruthy();
  });

  it("exposes exactly the two read-only operations", () => {
    const spec = loadSpec();
    const paths = Object.keys(spec.paths);
    expect(paths.sort()).toEqual(["/get_context", "/list_constraints"]);
    expect(spec.paths["/get_context"].post.operationId).toBe("get_context");
    expect(spec.paths["/list_constraints"].post.operationId).toBe("list_constraints");
    // Read-only: no other HTTP verbs on either path.
    for (const path of paths) {
      expect(Object.keys(spec.paths[path])).toEqual(["post"]);
    }
  });

  it("requires task for get_context and defines the ContextPack/Risk schemas", () => {
    const spec = loadSpec();
    const reqSchema = spec.components.schemas.GetContextRequest;
    expect(reqSchema.required).toContain("task");
    expect(spec.components.schemas.ContextPack.properties.risk).toBeTruthy();
    expect(spec.components.schemas.Risk.properties.level.enum).toEqual(["safe", "risky"]);
  });

  it("ships no real endpoint or credential value", () => {
    const raw = readFileSync(SPEC, "utf8");
    const spec = loadSpec();
    // Server URL must be an obvious placeholder, never a real host.
    expect(spec.servers[0].url).toMatch(/YOUR-CONNECTOR-HOST\.example/);
    // The optional bearer scheme is declared but carries no value.
    expect(spec.components.securitySchemes.bearerAuth.scheme).toBe("bearer");
    expect(raw).not.toMatch(/\b(bearer\s+[A-Za-z0-9._-]{12,}|https:\/\/[a-z0-9.-]+\.(workers\.dev|com)\/)/i);
  });

  it("ships the design doc referencing both surfaces", () => {
    expect(existsSync(DOC)).toBe(true);
    const text = readFileSync(DOC, "utf8");
    expect(text).toContain("GPT Action");
    expect(text).toContain("Remote MCP");
    expect(text).toContain("mind-ontology-connector.openapi.json");
  });
});
