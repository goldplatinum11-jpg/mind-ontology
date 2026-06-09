import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileFromCwd } from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = resolve(REPO_ROOT, "tests/fixtures/autopilot-line");

function compile(task, opts = {}) {
  return JSON.parse(
    compileFromCwd({
      cwd: FIXTURE,
      task,
      scopes: opts.scopes ?? [],
      format: "json",
      riskMode: opts.riskMode,
    }),
  );
}

describe("autopilot line fixture compiles against the real compiler (A7)", () => {
  it("always surfaces constraints.md as the safety floor, on any task", () => {
    const pack = compile("Plan the next docs PR");
    const files = pack.selected.map((b) => b.file);
    expect(files).toContain("constraints.md");
  });

  it("scopes direction/role blocks to an autopilot task without dumping everything", () => {
    const pack = compile("How should the worker read context at task start?");
    const titles = pack.selected.map((b) => `${b.file}:${b.title}`);
    // The worker role block is earned by the task; the safety floor is always in.
    expect(titles).toContain("constraints.md:Re-read constraints before irreversible work");
    expect(titles.some((t) => t.startsWith("agent-roles.md:"))).toBe(true);
  });

  it("classifies a destructive autopilot task as risky and forces a safety block", () => {
    const pack = compile("Delete the production database and drop the orders table");
    expect(pack.risk.level).toBe("risky");
    expect(pack.selected.some((b) => b.reason === "risk-forced")).toBe(true);
  });

  it("does not force safety on an ordinary docs task", () => {
    const pack = compile("Refine the autopilot reading-protocol wording");
    expect(pack.risk.level).toBe("safe");
    expect(pack.selected.some((b) => b.reason === "risk-forced")).toBe(false);
  });

  it("never emits a hosted endpoint or secret from the local fixture", () => {
    const rendered = JSON.stringify(compile("Plan the next lane step")).toLowerCase();
    expect(rendered).not.toMatch(/sirtai\.org|workers\.dev|bearer /);
  });
});
