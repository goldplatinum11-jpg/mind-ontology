import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = resolve(REPO_ROOT, "docs/mind-ontology-oss-to-hosted-upgrade-flow-v0.md");

describe("OSS-to-hosted upgrade flow (P4-PR05)", () => {
  it("ships the upgrade-flow doc", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("describes a reversible, additive, default-local flow", () => {
    const text = readFileSync(DOC, "utf8").toLowerCase();
    expect(text).toContain("default");
    expect(text).toContain("rollback");
    expect(text).toContain("fail-closed");
    expect(text).toMatch(/reversible|instant/);
  });

  it("ties stages to the contracts and the feature flag", () => {
    const text = readFileSync(DOC, "utf8");
    expect(text).toContain("P4-PR06");
    expect(text).toContain("defaults off");
    expect(text).toContain("agentctx:validate");
  });
});
