import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PKG = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));

// M31 — package.json must stay suitable for pre-release standalone dev:
// publish-ready (the `private` gate is removed; publishing is an explicit
// operator decision), every script backed by a real local file, no
// remote/publish coupling.
describe("package metadata is pre-release-safe (M31)", () => {
  it("is publish-ready with a name, description, and engines", () => {
    expect(PKG.private).toBeUndefined();
    expect(typeof PKG.name).toBe("string");
    expect(PKG.name).toBe("mind-ontology");
    expect(typeof PKG.description).toBe("string");
    expect(PKG.engines?.node).toMatch(/>=\s*20/);
  });

  it("declares the chosen Apache-2.0 SPDX id", () => {
    expect(PKG.license).toBe("Apache-2.0");
  });

  it("every script references a file that exists", () => {
    const fileRe = /\b(scripts\/agentctx\/[\w./-]+\.mjs|tests\/unit\/[\w./-]+\.mjs)\b/g;
    for (const [name, cmd] of Object.entries(PKG.scripts ?? {})) {
      for (const m of cmd.matchAll(fileRe)) {
        expect(existsSync(resolve(REPO_ROOT, m[1])), `script "${name}" cites missing ${m[1]}`).toBe(true);
      }
    }
  });

  it("adds no publishConfig and no remote (git/http) dependency", () => {
    expect(PKG.publishConfig).toBeUndefined();
    const deps = { ...(PKG.dependencies ?? {}), ...(PKG.devDependencies ?? {}) };
    for (const [dep, spec] of Object.entries(deps)) {
      expect(/^(git\+|https?:|github:|file:)/i.test(spec), `${dep} uses a remote/local spec: ${spec}`).toBe(false);
    }
  });
});

// M32 — the testing doc reflects the actual gates.
describe("testing doc matches real package scripts (M32)", () => {
  it("ships docs/testing.md and cites the four real gates", () => {
    expect(existsSync(resolve(REPO_ROOT, "docs/testing.md"))).toBe(true);
    const doc = readFileSync(resolve(REPO_ROOT, "docs/testing.md"), "utf8");
    for (const gate of ["agentctx:proof", "agentctx:validate", "agentctx:smoke"]) {
      expect(doc).toContain(gate);
      expect(PKG.scripts[gate], `testing.md cites missing ${gate}`).toBeTruthy();
    }
    expect(doc).toContain("npm test");
  });
});
