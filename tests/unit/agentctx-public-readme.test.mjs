import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const README = resolve(REPO_ROOT, "docs/mind-ontology-public-readme-v0.md");

describe("public README narrative (P5-PR01)", () => {
  it("ships the public README", () => {
    expect(existsSync(README)).toBe(true);
  });

  it("tells the core story and the contract", () => {
    const text = readFileSync(README, "utf8");
    expect(text).toContain("portable meaning layer");
    expect(text).toContain("get_context");
    expect(text).toContain("list_constraints");
    expect(text.toLowerCase()).toContain("local-first");
  });

  it("references commands that actually exist in package.json", () => {
    const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));
    const text = readFileSync(README, "utf8");
    for (const script of ["agentctx:init", "agentctx:compile", "agentctx:validate", "agentctx:metrics", "agentctx:smoke"]) {
      if (text.includes(script)) {
        expect(pkg.scripts[script], `README cites missing script ${script}`).toBeTruthy();
      }
    }
  });
});
