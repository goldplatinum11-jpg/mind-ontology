import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { planInvocation } from "../../scripts/agentctx/cli.mjs";
import { initFromRepo } from "../../scripts/agentctx/init-from-repo.mjs";
import {
  ADOPT_TARGET_IDS,
  ADOPT_TARGETS,
  adoptJson,
  analyzeAdoption,
  expandTargets,
  parseAdoptArgv,
  renderAdoptText,
  runAdopt,
} from "../../scripts/agentctx/adopt.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = resolve(REPO_ROOT, "scripts/agentctx/cli.mjs");

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
}

const tempRoots = [];
function tmp() {
  const dir = mkdtempSync(join(tmpdir(), "mo-adopt-"));
  tempRoots.push(dir);
  return dir;
}
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

// Recursive file listing (relative paths), for the "writes nothing" proof.
function listFiles(root, prefix = "") {
  const out = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(join(root, entry.name), rel));
    else out.push(rel);
  }
  return out.sort();
}

// A bare Node project — manifest only, no .agentctx/, no artifacts.
function nodeProject() {
  const cwd = tmp();
  writeFileSync(
    join(cwd, "package.json"),
    JSON.stringify({ name: "demo", version: "1.0.0", scripts: { test: "vitest run" } }, null, 2),
  );
  return cwd;
}

// A fully adopted project: scaffolded .agentctx/ + every emitted artifact fresh.
function adoptedProject() {
  const cwd = nodeProject();
  initFromRepo({ cwd });
  const r = runCli(["emit", "--target", "agents-md,claude-md,cursor,paste-block", "--cwd", cwd]);
  expect(r.status, `emit setup failed: ${r.stderr}`).toBe(0);
  return cwd;
}

// Private-infrastructure names, split so this audit's own source carries no
// literal occurrence (same convention as the no-leakage audits).
const PRIVATE_STRINGS = [
  ["sirt", "-app-v2"].join(""),
  ["C:\\Users\\", "qmbqb"].join(""),
  ["sirt", "-product-workspaces"].join(""),
  ["npm.", "flatt", ".tech"].join(""),
];

describe("adopt: argv contract", () => {
  it("defaults --targets to all four clients in canonical order", () => {
    expect(parseAdoptArgv([]).targets).toEqual([
      "claude-code",
      "codex",
      "cursor",
      "paste-block",
    ]);
  });

  it("rejects an unknown target and names the allowed values", () => {
    expect(() => parseAdoptArgv(["--targets", "vscode"])).toThrow(
      /--targets must be "all" or a comma list of "claude-code", "codex", "cursor", "paste-block", got: vscode/,
    );
  });

  it("rejects an empty --targets value", () => {
    expect(() => parseAdoptArgv(["--targets", ""])).toThrow(/got: \(empty\)/);
  });

  it("rejects a bad --format with the Workbench vocabulary", () => {
    expect(() => parseAdoptArgv(["--format", "xml"])).toThrow(
      /--format must be "text" or "json", got: xml/,
    );
  });

  it("rejects an unknown flag and points at --help", () => {
    expect(() => parseAdoptArgv(["--bogus"])).toThrow(
      /Unknown argument: --bogus\. Run "mind-ontology adopt --help"/,
    );
  });

  it("help short-circuits target expansion", () => {
    expect(parseAdoptArgv(["--help"]).help).toBe(true);
    expect(parseAdoptArgv(["-h"]).help).toBe(true);
  });
});

describe("adopt: expandTargets", () => {
  it("'all' expands to the canonical order", () => {
    expect(expandTargets("all")).toEqual(ADOPT_TARGET_IDS);
  });

  it("preserves the operator's typed order and dedupes", () => {
    expect(expandTargets("cursor,claude-code,cursor")).toEqual(["cursor", "claude-code"]);
  });

  it("rejects 'all' mixed with explicit ids (all is sole-token only)", () => {
    expect(() => expandTargets("all,codex")).toThrow(/got: all/);
  });
});

describe("adopt: plan over a bare project", () => {
  it("plans the scaffold, all four emits, and both configs — nothing fresh", () => {
    const cwd = nodeProject();
    const plan = analyzeAdoption({ cwd, targets: expandTargets("all") });
    const json = adoptJson(plan, "plan");

    expect(json.mode).toBe("plan");
    expect(json.targets).toEqual(ADOPT_TARGET_IDS);

    // One init unit + four emit units + two config units.
    const kinds = json.actions.map((a) => a.kind);
    expect(kinds.filter((k) => k === "init-from-repo")).toHaveLength(1);
    expect(kinds.filter((k) => k === "emit")).toHaveLength(4);
    expect(kinds.filter((k) => k === "config")).toHaveLength(2);

    // Everything is a planned create (nothing exists yet).
    for (const a of json.actions) expect(a.status).toBe("planned");

    // Emit units carry their emit_target mapping.
    const emitMap = Object.fromEntries(
      json.actions.filter((a) => a.kind === "emit").map((a) => [a.target, a.emit_target]),
    );
    expect(emitMap).toEqual({
      "claude-code": "claude-md",
      codex: "agents-md",
      cursor: "cursor",
      "paste-block": "paste-block",
    });

    // Manual steps: paste-block paste + a bootstrap paste per config client.
    expect(json.manual_steps.some((s) => /ChatGPT \/ Claude\.ai project instructions/.test(s))).toBe(
      true,
    );
    expect(
      json.manual_steps.filter((s) => /bootstrap instruction/.test(s)),
    ).toHaveLength(2);

    // Verify commands name the emit targets in registry order.
    expect(json.verify_commands).toContain("mind-ontology validate");
    expect(json.verify_commands).toContain("mind-ontology status");
    expect(json.verify_commands).toContain(
      "mind-ontology emit --check --target agents-md,claude-md,cursor,paste-block",
    );

    // .agentctx/ absence is a warning, not an error.
    expect(json.warnings.some((w) => /\.agentctx\/ not found/.test(w))).toBe(true);
  });

  it("the JSON shape is exactly the locked key set", () => {
    const plan = analyzeAdoption({ cwd: nodeProject(), targets: expandTargets("all") });
    const json = adoptJson(plan, "plan");
    expect(Object.keys(json)).toEqual([
      "ok",
      "mode",
      "cwd",
      "targets",
      "actions",
      "manual_steps",
      "verify_commands",
      "warnings",
    ]);
    expect(json.ok).toBe(true);
    for (const a of json.actions) {
      expect(Object.keys(a).sort()).toEqual(
        a.kind === "emit"
          ? ["detail", "emit_target", "kind", "path", "status", "target"]
          : ["detail", "kind", "path", "status", "target"],
      );
    }
  });

  it("plan output is deterministic for the same project state", () => {
    const cwd = nodeProject();
    const a = analyzeAdoption({ cwd, targets: expandTargets("all") });
    const b = analyzeAdoption({ cwd, targets: expandTargets("all") });
    expect(renderAdoptText(a, "plan")).toBe(renderAdoptText(b, "plan"));
    expect(JSON.stringify(adoptJson(a, "plan"))).toBe(JSON.stringify(adoptJson(b, "plan")));
  });
});

describe("adopt: plan over an already-adopted project", () => {
  it("fresh artifacts SKIP; an existing config becomes manual_required", () => {
    const cwd = adoptedProject();
    // Simulate an existing claude-code config the operator wrote by hand.
    writeFileSync(join(cwd, ".mcp.json"), '{ "mcpServers": { "mine": {} } }\n');

    const json = adoptJson(analyzeAdoption({ cwd, targets: expandTargets("all") }), "plan");

    // No scaffold needed.
    expect(json.actions.some((a) => a.kind === "init-from-repo")).toBe(false);
    // Every emit artifact is fresh -> skipped.
    for (const a of json.actions.filter((x) => x.kind === "emit")) {
      expect(a.status).toBe("skipped");
    }
    // The existing .mcp.json is manual_required; .codex/config.toml is still a create.
    const mcp = json.actions.find((a) => a.kind === "config" && a.path === ".mcp.json");
    expect(mcp.status).toBe("manual_required");
    expect(json.manual_steps.some((s) => /\.mcp\.json.*already exists/.test(s))).toBe(true);
  });

  it("an UNMANAGED hand-written artifact is manual_required, never clobbered", () => {
    const cwd = tmp();
    mkdirSync(join(cwd, ".agentctx"));
    writeFileSync(join(cwd, ".agentctx", "constraints.md"), "# Constraints\n\n## Care #safety\n\nBe careful.\n");
    writeFileSync(join(cwd, "AGENTS.md"), "MY HAND-WRITTEN FILE\n");

    const json = adoptJson(analyzeAdoption({ cwd, targets: ["codex"] }), "plan");
    const emit = json.actions.find((a) => a.kind === "emit");
    expect(emit.status).toBe("manual_required");
    expect(json.manual_steps.some((s) => /AGENTS\.md.*is UNMANAGED/.test(s))).toBe(true);
  });
});

describe("adopt: read-only contract (end to end)", () => {
  it("a bare `adopt` writes nothing and exits 0", () => {
    const cwd = nodeProject();
    const before = listFiles(cwd);
    const r = runCli(["adopt", "--cwd", cwd]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Read-only plan — nothing written.");
    expect(listFiles(cwd)).toEqual(before);
  });

  it("--format json prints the locked machine shape and writes nothing", () => {
    const cwd = nodeProject();
    const before = listFiles(cwd);
    const r = runCli(["adopt", "--cwd", cwd, "--format", "json"]);
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.ok).toBe(true);
    expect(out.mode).toBe("plan");
    expect(out.targets).toEqual(ADOPT_TARGET_IDS);
    expect(listFiles(cwd)).toEqual(before);
  });

  it("runAdopt is side-effect free at the API level", () => {
    const cwd = nodeProject();
    const before = listFiles(cwd);
    const result = runAdopt({ cwd, targets: expandTargets("all"), format: "text" });
    expect(result.exitCode).toBe(0);
    expect(listFiles(cwd)).toEqual(before);
  });
});

describe("adopt: leakage and wrapper dispatch", () => {
  it("plan output carries no private infrastructure strings", () => {
    const cwd = adoptedProject();
    const plan = analyzeAdoption({ cwd, targets: expandTargets("all") });
    const rendered = [renderAdoptText(plan, "plan"), JSON.stringify(adoptJson(plan, "plan"))].join(
      "\n",
    );
    for (const secret of PRIVATE_STRINGS) {
      expect(rendered.includes(secret), `output leaks "${secret}"`).toBe(false);
    }
  });

  it("the CLI wrapper routes adopt to adopt.mjs with args verbatim", () => {
    const plan = planInvocation(["adopt", "--targets", "cursor", "--format", "json"]);
    expect(plan.kind).toBe("spawn");
    expect(plan.script).toBe("adopt.mjs");
    expect(plan.args).toEqual(["--targets", "cursor", "--format", "json"]);
  });

  it("wrapper help lists adopt", () => {
    const r = runCli(["--help"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("adopt");
  });

  it("every registered adopt client declares the pieces the contract requires", () => {
    for (const [id, spec] of Object.entries(ADOPT_TARGETS)) {
      expect(spec.label, `${id} missing label`).toBeTruthy();
      expect(spec.emitTarget, `${id} missing emitTarget`).toBeTruthy();
      // setupTarget is null for emit-only clients (cursor, paste-block).
      expect("setupTarget" in spec, `${id} missing setupTarget key`).toBe(true);
    }
  });
});
