import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = readFileSync(resolve(REPO_ROOT, "docs/mind-ontology-http-endpoint-design-v0.md"), "utf8");
const API = JSON.parse(readFileSync(resolve(REPO_ROOT, "docs/agentctx-setup/mind-ontology-connector.openapi.json"), "utf8"));

// M54 — the HTTP design doc's request/response/error/auth claims must match the
// shipped OpenAPI. Binds the prose spec to the actual fixture so they can't drift.
describe("http-endpoint design doc agrees with the OpenAPI (M54)", () => {
  it("both describe exactly the two read-only operations", () => {
    expect(DOC).toContain("get_context");
    expect(DOC).toContain("list_constraints");
    const ops = Object.values(API.paths).flatMap((p) => Object.entries(p));
    expect(ops.map(([m]) => m).every((m) => m === "post")).toBe(true);
    expect(ops.map(([, op]) => op.operationId).sort()).toEqual(["get_context", "list_constraints"]);
  });

  it("get_context request shape {task, scope?} matches the schema (JSON-only in PR1)", () => {
    expect(DOC).toContain("{ task, scope? }");
    const req = API.components.schemas.GetContextRequest;
    expect(req.required).toEqual(["task"]);
    expect(req.properties).toHaveProperty("scope");
    // PR1's HTTP Action surface is JSON-only: no `format` negotiation here.
    expect(req.properties).not.toHaveProperty("format");
  });

  it("ContextPack output the doc promises (incl. risk) exists in the schema", () => {
    const pack = API.components.schemas.ContextPack.properties;
    for (const field of ["task", "scopes", "selected", "omittedCount", "sourceFiles", "risk"]) {
      expect(pack, `ContextPack missing ${field}`).toHaveProperty(field);
    }
  });

  it("list_constraints output {file, blockCount, blocks} matches the schema", () => {
    expect(DOC).toContain('{ file: "constraints.md", blockCount, blocks[] }');
    const res = API.components.schemas.ConstraintsResult.properties;
    for (const field of ["file", "blockCount", "blocks"]) {
      expect(res).toHaveProperty(field);
    }
  });

  it("the documented missing-task 400 and placeholder host are in the OpenAPI", () => {
    expect(DOC).toContain("`400` for a missing `task`");
    expect(API.paths["/get_context"].post.responses).toHaveProperty("400");
    expect(DOC).toContain("YOUR-CONNECTOR-HOST.example");
    expect(API.servers[0].url).toContain("YOUR-CONNECTOR-HOST.example");
  });

  it("auth is an optional, value-less bearer scheme in both", () => {
    expect(DOC.toLowerCase()).toContain("optional");
    expect(DOC).toContain("bearerAuth");
    const scheme = API.components.securitySchemes.bearerAuth;
    expect(scheme.type).toBe("http");
    expect(scheme.scheme).toBe("bearer");
    // No concrete bearer value shipped anywhere in the spec.
    expect(JSON.stringify(API)).not.toMatch(/bearer\s+[A-Za-z0-9._-]{12,}/i);
  });
});
