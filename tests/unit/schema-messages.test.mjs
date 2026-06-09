import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { renderReport, validateOntology } from "../../scripts/agentctx/schema.mjs";

const tempRoots = [];
function makeTempRoot() {
  const dir = mkdtempSync(join(tmpdir(), "agentctx-msg-"));
  tempRoots.push(dir);
  return dir;
}
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

const CONSTRAINTS = "# Constraints\n\n## Keep it safe #safety\n\nDo not make destructive changes.\n";
function makeProject(extra = {}) {
  const cwd = makeTempRoot();
  mkdirSync(join(cwd, ".agentctx"));
  writeFileSync(join(cwd, ".agentctx", "constraints.md"), CONSTRAINTS);
  for (const [file, content] of Object.entries(extra)) {
    writeFileSync(join(cwd, ".agentctx", file), content);
  }
  return cwd;
}

// M8 — validation OUTPUT must be clear and actionable for a user reading the CLI.
describe("schema validation message quality (M8)", () => {
  it("a clean project renders an unambiguous VALID summary", () => {
    const text = renderReport(validateOntology(makeProject()));
    expect(text).toContain("VALID");
    expect(text).toMatch(/0 error\(s\)/);
    expect(text).toContain("conforms");
  });

  it("a missing .agentctx renders INVALID plus an actionable next step", () => {
    const text = renderReport(validateOntology(makeTempRoot()));
    expect(text).toContain("INVALID");
    // The remediation must name the exact command, not just say 'invalid'.
    expect(text).toContain("agentctx:init");
    expect(text).toMatch(/\[missing-dir\]/);
  });

  it("every rendered issue carries its rule tag and names the offending file", () => {
    const cwd = makeProject({
      "projects.md": "# Projects\n\n## Active #project #active\n\nName: Demo\nStatus: nonsense\n\nbody\n",
    });
    const report = validateOntology(cwd);
    const text = renderReport(report);
    expect(report.ok).toBe(false);
    for (const issue of report.issues) {
      expect(text).toContain(`[${issue.rule}]`);
      expect(text).toContain(issue.file);
    }
    // The enum error must spell out the allowed values so the user can fix it.
    expect(text).toContain("allowed:");
  });
});
