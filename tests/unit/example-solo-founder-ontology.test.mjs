import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SOURCE_FILES, compileFromCwd } from "../../scripts/agentctx/compile.mjs";
import { validateOntology } from "../../scripts/agentctx/schema.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const EXAMPLE = resolve(REPO_ROOT, "docs/examples/solo-founder-ai-os");
const AGENTCTX = resolve(EXAMPLE, ".agentctx");
const EXAMPLES_README = resolve(REPO_ROOT, "docs/examples/README.md");

const compile = (task, opts = {}) =>
  JSON.parse(
    compileFromCwd({ cwd: EXAMPLE, task, scopes: opts.scopes ?? [], format: "json", riskMode: opts.riskMode }),
  );

// The complete .agentctx/ schema set this richer example must carry.
const REQUIRED_FILES = [
  "identity.md",
  "direction.md",
  "projects.md",
  "constraints.md",
  "glossary.md",
  "decisions.md",
  "architecture.md",
  "agent-roles.md",
  "cq.md",
];

// A second worked example: a solo founder running an open-core business (Lumen
// Core OSS + Lumen Cloud hosted). It demonstrates multi-project context, the
// open-core boundary, vocabulary that prevents competitor/feature confusion,
// fail-closed safety around deploy/publish/secrets, and Codex/Claude/ChatGPT
// agent roles — and is regressed here so it cannot rot against the compiler.
describe("solo-founder-ai-os example compiles, scopes, and stays safe", () => {
  it("ships every .agentctx source file and validates with zero errors", () => {
    for (const file of REQUIRED_FILES) {
      expect(existsSync(resolve(AGENTCTX, file)), `missing ${file}`).toBe(true);
    }
    const report = validateOntology(EXAMPLE);
    expect(report.errors).toBe(0);
    expect(report.ok).toBe(true);
  });

  it("scopes a focused task to a genuine subset, always including constraints", () => {
    const pack = compile("improve onboarding and billing for paying customers", { scopes: ["hosted"] });
    const total = pack.selected.length + pack.omittedCount;
    expect(pack.selected.length).toBeLessThan(total); // genuinely focused, not everything
    expect(pack.selected.some((b) => b.file === "constraints.md" && b.reason === "always")).toBe(true);
    // The hosted-relevant sources surface for a hosted task.
    const files = new Set(pack.selected.map((b) => b.file));
    expect(files.has("direction.md") || files.has("projects.md") || files.has("decisions.md")).toBe(true);
  });

  it("the open-core boundary discriminates: hosted vs oss surface different slices", () => {
    const hosted = compile("grow the paid managed product", { scopes: ["hosted"] });
    const oss = compile("keep the free engine useful standalone", { scopes: ["oss"] });
    const titles = (p) => p.selected.map((b) => `${b.file}/${b.title}`).join("|");
    expect(titles(hosted)).not.toBe(titles(oss));
    // Each side surfaces its own project block, not the other's.
    expect(hosted.selected.some((b) => b.file === "projects.md" && /Cloud/.test(b.title))).toBe(true);
    expect(oss.selected.some((b) => b.file === "projects.md" && /Core/.test(b.title))).toBe(true);
  });

  it("a representative task surfaces the agent-roles delegation file", () => {
    const pack = compile("which agent role plans the work and which one reviews it");
    expect(pack.selected.some((b) => b.file === "agent-roles.md")).toBe(true);
  });

  it("fails closed: a deploy/publish task is risky and forces safety context", () => {
    const pack = compile("deploy lumen cloud to production and publish the release");
    expect(pack.risk.level).toBe("risky");
    expect(pack.risk.signals.length).toBeGreaterThan(0);
    // Safety material is present, either always-included or risk-forced.
    expect(
      pack.selected.some((b) => b.file === "constraints.md" || b.reason === "risk-forced"),
    ).toBe(true);
    // And at least one block was genuinely forced in by the risk gate.
    expect(pack.selected.some((b) => b.reason === "risk-forced")).toBe(true);
  });

  it("scoping is non-trivial: an unrelated task does not pull in every topic file", () => {
    const pack = compile("xyzzy plugh frobnicate quux");
    // The safety floor is always there...
    expect(pack.selected.some((b) => b.file === "constraints.md")).toBe(true);
    // ...but unrelated topic files must not all surface.
    expect(pack.selected.some((b) => b.file === "glossary.md")).toBe(false);
    expect(pack.selected.some((b) => b.file === "decisions.md")).toBe(false);
  });

  it("competency questions name only real, compiled source files", () => {
    const cq = readFileSync(resolve(AGENTCTX, "cq.md"), "utf8");
    const named = new Set([...cq.matchAll(/`([a-z][a-z-]*\.md)`/g)].map((m) => m[1]));
    expect(named.size).toBeGreaterThan(0);
    for (const file of named) {
      expect(SOURCE_FILES, `cq.md names ${file} which is not a compiled source`).toContain(file);
      expect(existsSync(resolve(AGENTCTX, file)), `cq.md names missing file ${file}`).toBe(true);
    }
  });

  it("carries no secrets, real endpoints, or private filesystem paths", () => {
    // Split credential keywords so this test's own source trips no scanner.
    const credential = /\b(?:api[_-]?key|pass\s*word|sec\s*ret|to\s*ken|private[_-]?key|authorization)\b\s*[:=]\s*["']?\S/i;
    const realUrl = /https?:\/\/[a-z0-9.-]+\.(?:com|dev|net|org|io)\b/i;
    const windowsPath = /[a-z]:\\\\?users\\/i;
    const homePath = /(?:\/home\/|\/users\/)[a-z]/i;
    for (const file of readdirSync(AGENTCTX)) {
      const text = readFileSync(resolve(AGENTCTX, file), "utf8");
      expect(credential.test(text), `${file} looks like it embeds a credential`).toBe(false);
      expect(realUrl.test(text), `${file} embeds a real endpoint URL`).toBe(false);
      expect(windowsPath.test(text), `${file} embeds a private Windows path`).toBe(false);
      expect(homePath.test(text), `${file} embeds a private home path`).toBe(false);
    }
  });

  it("is linked from the examples README so operators can find it", () => {
    const readme = readFileSync(EXAMPLES_README, "utf8");
    expect(readme).toContain("solo-founder-ai-os");
  });
});
