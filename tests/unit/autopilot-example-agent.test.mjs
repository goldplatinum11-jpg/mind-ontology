import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TPL = resolve(REPO_ROOT, "templates/mind-ontology/autopilot/example-codex-agent.md");

const text = () => readFileSync(TPL, "utf8");

describe("autopilot example agent prompt (A36)", () => {
  it("ships the example agent prompt template", () => {
    expect(existsSync(TPL)).toBe(true);
  });

  it("embodies the reading protocol with the two tools", () => {
    const t = text();
    expect(t).toContain("get_context(task)");
    expect(t).toContain("list_constraints()");
    const lower = t.toLowerCase();
    expect(lower).toMatch(/right axis|not as a memory store/);
    expect(lower).toMatch(/destructive, structural, or irreversible/);
  });

  it("embeds the stop policy with safe continuation", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/safe continuation/);
    expect(lower).toMatch(/not stop conditions|continue to the next/);
    expect(lower).toMatch(/valid terminal condition/);
  });

  it("uses only the two tools and no secret / hosted host", () => {
    const lower = text().toLowerCase();
    expect(lower).not.toMatch(/sirt_|search_hybrid|writeback_execute|node_put/);
    expect(lower).not.toMatch(/sirtai\.org|workers\.dev|bearer [a-z0-9]|authorization:/);
    expect(lower).toMatch(/no tool other than|no network call|no secret|names no credential/);
  });

  it("points at the protocol and stop-policy docs", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-reading-protocol-v1.md");
    expect(t).toContain("mind-ontology-autopilot-stop-policy-v1.md");
  });
});
