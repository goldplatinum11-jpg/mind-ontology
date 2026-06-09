import { mkdtempSync, readFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { SOURCE_FILES, compileFromCwd, parseMarkdownBlocks } from "../../scripts/agentctx/compile.mjs";
import { initAgentctx } from "../../scripts/agentctx/init.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CQ_PATH = resolve(REPO_ROOT, "templates/mind-ontology/.agentctx/cq.md");

const tempRoots = [];
function project() {
  const dir = mkdtempSync(join(tmpdir(), "agentctx-cqreg-"));
  tempRoots.push(dir);
  initAgentctx({ cwd: dir });
  return dir;
}
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

function cqBlocks() {
  return parseMarkdownBlocks(readFileSync(CQ_PATH, "utf8"), "cq.md").filter((b) => b.tags.includes("cq"));
}
// Source files a CQ body names, e.g. `direction.md`.
function namedSources(body) {
  return [...new Set([...body.matchAll(/`?([a-z][a-z-]*\.md)`?/g)].map((m) => m[1]))]
    .filter((f) => f !== "cq.md");
}

// M41 — competency questions must be honest: each is a promise that some real,
// compiled source file answers it. This regresses the "CQs are the verification
// core" claim deeper than the schema conformance test.
describe("CQ regression: every CQ points at a real, compiled source (M41)", () => {
  it("each CQ that names a source file names one that exists and is compiled", () => {
    const dir = project();
    let cqWithSourceRefs = 0;
    for (const block of cqBlocks()) {
      const named = namedSources(block.body);
      if (named.length === 0) continue;
      cqWithSourceRefs += 1;
      for (const file of named) {
        expect(SOURCE_FILES, `CQ "${block.title}" names ${file} which is not a compiled source`).toContain(file);
        expect(existsSync(join(dir, ".agentctx", file)), `template lacks ${file}`).toBe(true);
      }
    }
    // The honesty property is only meaningful if most CQs actually point somewhere.
    expect(cqWithSourceRefs).toBeGreaterThanOrEqual(4);
  });

  it("the safety CQs are answerable: constraints.md is always in the compiled pack", () => {
    const pack = JSON.parse(compileFromCwd({ cwd: project(), task: "what must I avoid and never write", format: "json" }));
    const fromConstraints = pack.selected.filter((b) => b.file === "constraints.md");
    expect(fromConstraints.length).toBeGreaterThanOrEqual(1);
    expect(fromConstraints.every((b) => b.reason === "always")).toBe(true);
  });

  it("a risky CQ-shaped task forces safety context (forbidden-writes CQ has teeth)", () => {
    const pack = JSON.parse(
      compileFromCwd({ cwd: project(), task: "deploy to production and drop the database", format: "json" }),
    );
    expect(pack.risk.level).toBe("risky");
    expect(pack.selected.some((b) => b.reason === "risk-forced" || b.file === "constraints.md")).toBe(true);
  });

  it("every required CQ topic (#context, #safety) is present and answerable", () => {
    const tags = new Set(cqBlocks().flatMap((b) => b.tags));
    for (const required of ["context", "safety"]) {
      expect(tags.has(required), `missing required CQ #${required}`).toBe(true);
    }
    // Each required topic's CQ has a non-empty body (it states what answers it).
    for (const topic of ["context", "safety"]) {
      const block = cqBlocks().find((b) => b.tags.includes(topic));
      expect(block.body.trim().length).toBeGreaterThan(0);
    }
  });
});
