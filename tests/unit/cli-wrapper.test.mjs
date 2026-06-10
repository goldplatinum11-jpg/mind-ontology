import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  CLI_NAME,
  COMMANDS,
  buildHelp,
  planInvocation,
  readVersion,
  unknownCommandMessage,
} from "../../scripts/agentctx/cli.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = resolve(REPO_ROOT, "scripts/agentctx/cli.mjs");
const PKG = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));

function runCli(args, opts = {}) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", ...opts });
}

const tempRoots = [];
function tmpProject() {
  const dir = mkdtempSync(join(tmpdir(), "mo-cli-"));
  tempRoots.push(dir);
  return dir;
}
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

// The wrapper is a pure dispatcher: it must not duplicate domain logic, only
// route each subcommand to the existing sibling script.
describe("cli wrapper dispatch plan", () => {
  it("maps every command to an existing sibling script", () => {
    for (const [name, spec] of Object.entries(COMMANDS)) {
      expect(existsSync(resolve(REPO_ROOT, "scripts/agentctx", spec.script)), `${name} -> missing ${spec.script}`).toBe(true);
    }
  });

  it("forwards the compile positional token so compile.mjs keeps its command contract", () => {
    const plan = planInvocation(["compile", "--task", "x"]);
    expect(plan.kind).toBe("spawn");
    expect(plan.script).toBe("compile.mjs");
    expect(plan.args).toEqual(["compile", "--task", "x"]);
  });

  it("forwards args verbatim for commands with no positional token", () => {
    const plan = planInvocation(["validate", "--cwd", "/tmp/x"]);
    expect(plan.kind).toBe("spawn");
    expect(plan.script).toBe("schema.mjs");
    expect(plan.args).toEqual(["--cwd", "/tmp/x"]);
  });

  it("treats no args, help, and -h as a help request", () => {
    for (const argv of [[], ["help"], ["--help"], ["-h"]]) {
      expect(planInvocation(argv).kind, `argv=${JSON.stringify(argv)}`).toBe("help");
    }
  });

  it("treats --version and -v as a version request", () => {
    expect(planInvocation(["--version"]).kind).toBe("version");
    expect(planInvocation(["-v"]).kind).toBe("version");
  });

  it("classifies an unknown command and an unknown leading flag as errors", () => {
    expect(planInvocation(["bogus"]).kind).toBe("error");
    expect(planInvocation(["--nope"]).kind).toBe("error");
  });
});

describe("cli wrapper help and version output", () => {
  it("help lists every command and states backward compatibility", () => {
    const help = buildHelp();
    for (const name of Object.keys(COMMANDS)) expect(help).toContain(name);
    expect(help).toContain(CLI_NAME);
    expect(help.toLowerCase()).toContain("backward compat");
    expect(help).toContain("agentctx:compile");
  });

  it("readVersion returns the package version", () => {
    expect(readVersion()).toBe(PKG.version);
  });

  it("`--help` exits 0 and prints to stdout", () => {
    const r = runCli(["--help"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(`${CLI_NAME} —`);
    expect(r.stderr).toBe("");
  });

  it("`--version` exits 0 and prints the version", () => {
    const r = runCli(["--version"]);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe(PKG.version);
  });
});

describe("cli wrapper error UX", () => {
  it("an unknown command exits 1, routes to stderr, and names the alternatives", () => {
    const r = runCli(["frobnicate"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toBe("");
    expect(r.stderr).toMatch(/Unknown command: frobnicate/);
    expect(r.stderr).toContain("compile");
  });

  it("unknownCommandMessage lists the known commands", () => {
    const msg = unknownCommandMessage("zzz");
    for (const name of Object.keys(COMMANDS)) expect(msg).toContain(name);
  });
});

describe("cli wrapper end-to-end dispatch preserves engine behavior", () => {
  it("`compile --task` produces the same context pack header as the engine", () => {
    const cwd = tmpProject();
    expect(runCli(["init", "--cwd", cwd]).status).toBe(0);
    const r = runCli(["compile", "--cwd", cwd, "--task", "Implement OAuth flow"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("# agentctx context pack");
    expect(r.stdout).toContain("Task: Implement OAuth flow");
  });

  it("`compile` with no --task surfaces the engine's own error and exit code", () => {
    const cwd = tmpProject();
    runCli(["init", "--cwd", cwd]);
    const r = runCli(["compile", "--cwd", cwd]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Missing required --task argument/);
  });

  it("`validate` runs the schema engine and exits 0 on a fresh template", () => {
    const cwd = tmpProject();
    runCli(["init", "--cwd", cwd]);
    const r = runCli(["validate", "--cwd", cwd]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("schema validation");
  });
});

// The wrapper must NOT regress the existing agentctx:* surface.
describe("backward compatibility: agentctx scripts and metadata preserved", () => {
  const REQUIRED_SCRIPTS = [
    "agentctx:compile",
    "agentctx:init",
    "agentctx:mcp",
    "agentctx:proof",
    "agentctx:smoke",
    "agentctx:validate",
    "agentctx:metrics",
  ];

  it("keeps every original agentctx:* script", () => {
    for (const name of REQUIRED_SCRIPTS) {
      expect(PKG.scripts[name], `missing ${name}`).toBeTruthy();
    }
  });

  it("adds the bin without flipping private or adding a publish surface", () => {
    expect(PKG.private).toBe(true);
    expect(PKG.bin?.["mind-ontology"]).toBe("scripts/agentctx/cli.mjs");
    // The files allowlist (release prep) must keep shipping the bin target.
    expect(PKG.files).toContain("scripts/agentctx/**");
    expect(PKG.publishConfig).toBeUndefined();
  });

  it("every wrapped engine command corresponds to a preserved agentctx:* script", () => {
    for (const [name, spec] of Object.entries(COMMANDS)) {
      // Operator commands (emit, …) are born inside the wrapper and have no
      // npm alias by design (W2 §11: the agentctx:* namespace is frozen
      // back-compat, not a growth surface).
      if (spec.npmScript === null) {
        expect(spec.group, `${name} without an alias must be an operator command`).toBe("operator");
        continue;
      }
      expect(PKG.scripts[spec.npmScript], `missing ${spec.npmScript}`).toBeTruthy();
    }
  });
});
