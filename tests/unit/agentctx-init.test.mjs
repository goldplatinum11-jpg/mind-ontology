import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initAgentctx, parseInitArgv } from "../../scripts/agentctx/init.mjs";

const tempRoots = [];

function makeTempRoot() {
  const dir = mkdtempSync(join(tmpdir(), "agentctx-init-"));
  tempRoots.push(dir);
  return dir;
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const dir = tempRoots.pop();
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("agentctx init", () => {
  it("parses cwd, template, and force flags", () => {
    const options = parseInitArgv(["--cwd", "demo", "--template", "mind-ontology", "--force"]);

    expect(options.cwd).toBe(resolve("demo"));
    expect(options.template).toBe("mind-ontology");
    expect(options.force).toBe(true);
  });

  it("copies the Mind Ontology template into .agentctx/", () => {
    const cwd = makeTempRoot();
    const result = initAgentctx({ cwd });

    expect(result.files).toEqual(
      expect.arrayContaining([
        ".agentctx/constraints.md",
        ".agentctx/direction.md",
        ".agentctx/decisions.md",
        ".agentctx/architecture.md",
        ".agentctx/glossary.md",
      ]),
    );
    expect(existsSync(join(cwd, ".agentctx", "constraints.md"))).toBe(true);
    expect(readFileSync(join(cwd, ".agentctx", "constraints.md"), "utf8")).toContain(
      "No secrets in ontology files",
    );
  });

  it("refuses to overwrite an existing .agentctx/ without force", () => {
    const cwd = makeTempRoot();
    initAgentctx({ cwd });

    expect(() => initAgentctx({ cwd })).toThrow(".agentctx/ already exists");
  });

  it("overwrites template files when force is true", () => {
    const cwd = makeTempRoot();
    initAgentctx({ cwd });

    const result = initAgentctx({ cwd, force: true });

    expect(result.files.length).toBeGreaterThanOrEqual(4);
    expect(existsSync(join(cwd, ".agentctx", "cq.md"))).toBe(true);
  });
});
