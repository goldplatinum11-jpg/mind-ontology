import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initAgentctx } from "../../scripts/agentctx/init.mjs";
import { validateOntology } from "../../scripts/agentctx/schema.mjs";

const tempRoots = [];
function makeTempRoot() {
  const dir = mkdtempSync(join(tmpdir(), "agentctx-validate-"));
  tempRoots.push(dir);
  return dir;
}
afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop(), { recursive: true, force: true });
  }
});

const CONSTRAINTS = "# Constraints\n\n## Keep it safe #safety\n\nDo not make destructive changes.\n";

// Build a project with constraints.md (always) plus the given extra files.
function makeProject(extra = {}) {
  const cwd = makeTempRoot();
  mkdirSync(join(cwd, ".agentctx"));
  writeFileSync(join(cwd, ".agentctx", "constraints.md"), CONSTRAINTS);
  for (const [file, content] of Object.entries(extra)) {
    writeFileSync(join(cwd, ".agentctx", file), content);
  }
  return cwd;
}

function rules(report) {
  return report.issues.map((i) => i.rule);
}

describe("validateOntology (P2-PR07)", () => {
  it("passes on the shipped Mind Ontology template with zero errors", () => {
    const cwd = makeTempRoot();
    initAgentctx({ cwd });

    const report = validateOntology(cwd);
    expect(report.issues.filter((i) => i.level === "error")).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it("flags a missing .agentctx directory", () => {
    const report = validateOntology(makeTempRoot());
    expect(report.ok).toBe(false);
    expect(rules(report)).toContain("missing-dir");
  });

  it("validates clean for a minimal project shipping only constraints.md", () => {
    const report = validateOntology(makeProject());
    expect(report.ok).toBe(true);
    expect(report.errors).toBe(0);
  });

  it("requires constraints.md", () => {
    const cwd = makeTempRoot();
    mkdirSync(join(cwd, ".agentctx"));
    writeFileSync(join(cwd, ".agentctx", "identity.md"), "# Identity\n\n## Op #identity\n\nx\n## Style #style\n\ny\n");
    const report = validateOntology(cwd);
    expect(report.ok).toBe(false);
    expect(rules(report)).toContain("required-file");
  });

  it("flags identity.md missing a required #style block", () => {
    const cwd = makeProject({
      "identity.md": "# Identity\n\n## Operator profile #identity #operator\n\nWho.\n",
    });
    const report = validateOntology(cwd);
    expect(rules(report)).toContain("required-tag");
  });

  it("flags a projects active block missing Status and a bad Status value", () => {
    const missing = makeProject({
      "projects.md": "# Projects\n\n## Active #project #active\n\nName: Demo\n\nbody\n",
    });
    expect(rules(validateOntology(missing))).toContain("required-field");

    const bad = makeProject({
      "projects.md": "# Projects\n\n## Active #project #active\n\nName: Demo\nStatus: nonsense\n\nbody\n",
    });
    expect(rules(validateOntology(bad))).toContain("enum-field");
  });

  it("flags an agent-roles block with more than one role tag", () => {
    const cwd = makeProject({
      "agent-roles.md":
        "# Agent Roles\n\n## Coding #agent #coding\n\nimpl\n\n## Review #agent #review #extra\n\nreview\n",
    });
    expect(rules(validateOntology(cwd))).toContain("one-role-tag");
  });

  it("flags a cq block that is not phrased as a question", () => {
    const cwd = makeProject({
      "cq.md":
        "# Competency Questions\n\n## What to know? #cq #context\n\na\n\n## Avoid this #cq #safety\n\nb\n",
    });
    expect(rules(validateOntology(cwd))).toContain("question-title");
  });

  it("flags duplicate glossary term titles", () => {
    const cwd = makeProject({
      "glossary.md":
        "# Glossary\n\n## Term #term #topic\n\none\n\n## Term #term #topic\n\ntwo\n",
    });
    expect(rules(validateOntology(cwd))).toContain("unique-titles");
  });

  it("flags credential-shaped values in any source", () => {
    const cwd = makeProject({
      "identity.md":
        "# Identity\n\n## Op #identity #operator\n\nkey=ABCD1234\n\n## Style #style #collaboration\n\ny\n".replace(
          "key=",
          "api_key=",
        ),
    });
    expect(rules(validateOntology(cwd))).toContain("no-credentials");
  });
});
