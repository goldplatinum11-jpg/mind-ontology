import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { planInvocation } from "../../scripts/agentctx/cli.mjs";
import {
  BOOTSTRAP_INSTRUCTION,
  SETUP_TARGETS,
  SETUP_TARGET_IDS,
  buildSetupPlan,
  parseSetupArgv,
  renderSetupJson,
  renderSetupText,
  resolveServerPath,
  runSetup,
} from "../../scripts/agentctx/setup.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = resolve(REPO_ROOT, "scripts/agentctx/cli.mjs");

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
}

const tempRoots = [];
function tmp() {
  const dir = mkdtempSync(join(tmpdir(), "mo-setup-"));
  tempRoots.push(dir);
  return dir;
}
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

// Project-state builders mirroring the error-UX catalog style.
function bareProject() {
  return tmp();
}
function repoLocalProject() {
  // The repo-itself / vendored layout: the server script lives at
  // scripts/agentctx/mcp-server.mjs under the project root.
  const cwd = tmp();
  mkdirSync(join(cwd, "scripts", "agentctx"), { recursive: true });
  writeFileSync(join(cwd, "scripts", "agentctx", "mcp-server.mjs"), "// stub\n");
  mkdirSync(join(cwd, ".agentctx"));
  writeFileSync(join(cwd, ".agentctx", "constraints.md"), "# Constraints\n");
  return cwd;
}
function npmInstalledProject() {
  const cwd = tmp();
  mkdirSync(join(cwd, "node_modules", "mind-ontology", "scripts", "agentctx"), {
    recursive: true,
  });
  writeFileSync(
    join(cwd, "node_modules", "mind-ontology", "scripts", "agentctx", "mcp-server.mjs"),
    "// stub\n",
  );
  mkdirSync(join(cwd, ".agentctx"));
  writeFileSync(join(cwd, ".agentctx", "constraints.md"), "# Constraints\n");
  return cwd;
}

// Private-infrastructure names, split so this audit's own source carries no
// literal occurrence (same convention as the no-leakage audits).
const PRIVATE_STRINGS = [
  ["sirt", "-app-v2"].join(""),
  ["C:\\Users\\", "qmbqb"].join(""),
  ["sirt", "-product-workspaces"].join(""),
  ["sirt", "-codex-clones"].join(""),
  ["npm.", "flatt", ".tech"].join(""),
];

describe("setup: argv contract", () => {
  it("requires --target and names the allowed values", () => {
    expect(() => parseSetupArgv([])).toThrow(
      /Missing required --target argument \(allowed: "claude-code", "codex"\)/,
    );
  });

  it("rejects an unknown target and names the allowed values", () => {
    expect(() => parseSetupArgv(["--target", "cursor"])).toThrow(
      /--target must be one of "claude-code", "codex", got: cursor/,
    );
  });

  it("rejects a bad --format with the Workbench vocabulary", () => {
    expect(() => parseSetupArgv(["--target", "codex", "--format", "xml"])).toThrow(
      /--format must be "text" or "json", got: xml/,
    );
  });

  it("rejects an unknown flag", () => {
    expect(() => parseSetupArgv(["--target", "codex", "--bogus"])).toThrow(
      /Unknown argument: --bogus/,
    );
  });

  it("help short-circuits target validation", () => {
    expect(parseSetupArgv(["--help"]).help).toBe(true);
    expect(parseSetupArgv(["-h"]).help).toBe(true);
  });
});

describe("setup: deterministic plan content", () => {
  it("produces byte-identical output for the same project state", () => {
    const cwd = repoLocalProject();
    for (const target of SETUP_TARGET_IDS) {
      const a = buildSetupPlan({ cwd, target });
      const b = buildSetupPlan({ cwd, target });
      expect(renderSetupText(a, { mode: "print" })).toBe(renderSetupText(b, { mode: "print" }));
      expect(renderSetupJson(a, { mode: "print" })).toBe(renderSetupJson(b, { mode: "print" }));
    }
  });

  it("claude-code config is valid JSON wiring the agentctx stdio server", () => {
    const plan = buildSetupPlan({ cwd: repoLocalProject(), target: "claude-code" });
    expect(plan.configPath).toBe(".mcp.json");
    const config = JSON.parse(plan.configContent);
    expect(config.mcpServers.agentctx.command).toBe("node");
    expect(config.mcpServers.agentctx.args).toEqual(["scripts/agentctx/mcp-server.mjs"]);
  });

  it("codex config carries the [mcp_servers.agentctx] TOML block", () => {
    const plan = buildSetupPlan({ cwd: repoLocalProject(), target: "codex" });
    expect(plan.configPath).toBe(".codex/config.toml");
    expect(plan.configContent).toContain("[mcp_servers.agentctx]");
    expect(plan.configContent).toContain('command = "node"');
    expect(plan.configContent).toContain('args = ["scripts/agentctx/mcp-server.mjs"]');
  });

  it("prefers the repo-local server path, then the npm dependency path", () => {
    expect(resolveServerPath(repoLocalProject())).toEqual({
      path: "scripts/agentctx/mcp-server.mjs",
      found: true,
    });
    expect(resolveServerPath(npmInstalledProject())).toEqual({
      path: "node_modules/mind-ontology/scripts/agentctx/mcp-server.mjs",
      found: true,
    });
    expect(resolveServerPath(bareProject())).toEqual({
      path: "node_modules/mind-ontology/scripts/agentctx/mcp-server.mjs",
      found: false,
    });
  });

  it("frames adoption honestly: bootstrap instruction, helper-not-guarantee, emit ownership", () => {
    for (const target of SETUP_TARGET_IDS) {
      const plan = buildSetupPlan({ cwd: repoLocalProject(), target });
      expect(plan.instruction).toBe(BOOTSTRAP_INSTRUCTION);
      expect(plan.instruction).toContain("startup / first action");
      expect(plan.instruction).toContain("get_context");
      expect(plan.instruction).toContain("list_constraints");
      // Safe failure mode is part of the instruction itself.
      expect(plan.instruction).toMatch(/unavailable or `\.agentctx\/` is missing/);
      expect(plan.instruction).toContain("mind-ontology init");
      // No auto-call overpromise; emit-owned files are not a paste target.
      expect(plan.artifactsNote).toContain("not a guarantee");
      expect(plan.instructionHome).toContain("mind-ontology emit");
    }
  });

  it("generated output carries no private strings and no machine-absolute paths", () => {
    for (const target of SETUP_TARGET_IDS) {
      const plan = buildSetupPlan({ cwd: repoLocalProject(), target });
      const rendered = [
        plan.configContent,
        renderSetupText(plan, { mode: "print" }),
        renderSetupJson(plan, { mode: "print" }),
      ].join("\n");
      for (const secret of PRIVATE_STRINGS) {
        expect(rendered.includes(secret), `${target} output leaks "${secret}"`).toBe(false);
      }
      // The config itself must stay project-relative (the temp cwd never leaks).
      expect(plan.configContent).not.toMatch(/[A-Za-z]:[\\/]|\/Users\/|\/home\//);
    }
  });
});

describe("setup: print and write modes (end to end)", () => {
  it("--print writes nothing and exits 0", () => {
    const cwd = repoLocalProject();
    const r = runCli(["setup", "--target", "claude-code", "--cwd", cwd, "--print"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("PLAN");
    expect(r.stdout).toContain('"mcpServers"');
    expect(r.stdout).toContain("Mind Ontology bootstrap");
    expect(existsSync(join(cwd, ".mcp.json"))).toBe(false);
  });

  it("write mode creates the claude-code config when absent", () => {
    const cwd = repoLocalProject();
    const r = runCli(["setup", "--target", "claude-code", "--cwd", cwd]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("WROTE  .mcp.json");
    const written = JSON.parse(readFileSync(join(cwd, ".mcp.json"), "utf8"));
    expect(written.mcpServers.agentctx.command).toBe("node");
  });

  it("write mode creates .codex/config.toml (directory included) when absent", () => {
    const cwd = repoLocalProject();
    const r = runCli(["setup", "--target", "codex", "--cwd", cwd]);
    expect(r.status).toBe(0);
    expect(readFileSync(join(cwd, ".codex", "config.toml"), "utf8")).toContain(
      "[mcp_servers.agentctx]",
    );
  });

  it("refuses to overwrite an existing config, fails closed, and points at --print", () => {
    const cwd = repoLocalProject();
    const original = '{ "mcpServers": { "mine": {} } }\n';
    writeFileSync(join(cwd, ".mcp.json"), original);
    const r = runCli(["setup", "--target", "claude-code", "--cwd", cwd]);
    expect(r.status).toBe(1);
    expect(r.stdout).toBe("");
    expect(r.stderr).toMatch(/Refusing to overwrite \.mcp\.json: file already exists/);
    expect(r.stderr).toMatch(/--print/);
    expect(readFileSync(join(cwd, ".mcp.json"), "utf8")).toBe(original);
  });

  it("missing .agentctx/ is a warning, not a failure, and names the init fix", () => {
    const cwd = bareProject();
    const r = runCli(["setup", "--target", "codex", "--cwd", cwd, "--print"]);
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/\.agentctx\/ not found/);
    expect(r.stderr).toMatch(/fails closed/);
    expect(r.stderr).toMatch(/mind-ontology init/);
  });

  it("--format json emits the locked machine shape", () => {
    const cwd = repoLocalProject();
    const r = runCli([
      "setup", "--target", "claude-code", "--cwd", cwd, "--print", "--format", "json",
    ]);
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.ok).toBe(true);
    expect(out.target).toBe("claude-code");
    expect(out.mode).toBe("print");
    expect(out.config.path).toBe(".mcp.json");
    expect(out.config.action).toBe("printed");
    expect(out.bootstrap.instruction).toBe(BOOTSTRAP_INSTRUCTION);
    expect(out.agentctx_present).toBe(true);
    expect(Array.isArray(out.warnings)).toBe(true);
  });

  it("setup error UX matches the catalog properties: non-zero, named, no stack trace", () => {
    const r = runCli(["setup", "--target", "cursor", "--cwd", bareProject()]);
    expect(r.status).toBe(1);
    expect(r.stdout).toBe("");
    expect(r.stderr).toMatch(/--target must be one of "claude-code", "codex", got: cursor/);
    expect(/\n\s+at\s+\S|node:internal/.test(r.stderr)).toBe(false);
  });
});

describe("setup: wrapper dispatch and unit-level write API", () => {
  it("the CLI wrapper routes setup to setup.mjs with args verbatim", () => {
    const plan = planInvocation(["setup", "--target", "claude-code", "--print"]);
    expect(plan.kind).toBe("spawn");
    expect(plan.script).toBe("setup.mjs");
    expect(plan.args).toEqual(["--target", "claude-code", "--print"]);
  });

  it("wrapper help lists setup", () => {
    const r = runCli(["--help"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("setup");
  });

  it("runSetup print mode is side-effect free at the API level", () => {
    const cwd = npmInstalledProject();
    const result = runSetup({ cwd, target: "codex", print: true, format: "text" });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(
      'args = ["node_modules/mind-ontology/scripts/agentctx/mcp-server.mjs"]',
    );
    expect(existsSync(join(cwd, ".codex"))).toBe(false);
  });

  it("every registered setup target declares the pieces the contract requires", () => {
    for (const [id, spec] of Object.entries(SETUP_TARGETS)) {
      expect(spec.configPath, `${id} missing configPath`).toBeTruthy();
      expect(typeof spec.buildConfig, `${id} missing buildConfig`).toBe("function");
      expect(spec.instructionHome, `${id} missing instructionHome`).toBeTruthy();
      expect(spec.artifactsNote, `${id} missing artifactsNote`).toBeTruthy();
    }
  });
});
