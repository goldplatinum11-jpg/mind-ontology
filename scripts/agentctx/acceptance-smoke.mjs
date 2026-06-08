#!/usr/bin/env node

// Free-layer acceptance smoke (Mind Ontology Phase 1, Wave 2 closeout).
//
// Exercises the documented free-layer journey end-to-end through the real CLI
// entry points — no internal function shortcuts — so this also proves the
// `agentctx:init` and `agentctx:compile` npm wiring works:
//
//   1. init scaffolds .agentctx/ from the mind-ontology template
//   2. re-running init without --force fails closed (idempotency guard)
//   3. compile --format json emits a usable, always-includes-constraints pack
//   4. compile (markdown) renders the human-readable context pack
//   5. compile in a bare dir surfaces the friendly "run agentctx:init" hint
//
// Designed to run from a temp directory so it never mutates the repo.

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const INIT_CLI = resolve(SCRIPT_DIR, "init.mjs");
const COMPILE_CLI = resolve(SCRIPT_DIR, "compile.mjs");

export const EXPECTED_TEMPLATE_FILES = [
  ".agentctx/agent-roles.md",
  ".agentctx/architecture.md",
  ".agentctx/constraints.md",
  ".agentctx/cq.md",
  ".agentctx/decisions.md",
  ".agentctx/direction.md",
  ".agentctx/glossary.md",
  ".agentctx/identity.md",
  ".agentctx/projects.md",
];

const SMOKE_TASK = "Implement the agentctx CLI compile command with task and scope flags";
const SMOKE_SCOPE = "cli";

function runCli(cli, args, cwd) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
  });
  if (result.error) {
    return { status: null, stdout: "", stderr: String(result.error.message) };
  }
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function check(checks, name, ok, detail = "") {
  checks.push({ name, ok: Boolean(ok), detail });
  return Boolean(ok);
}

/**
 * Run the full free-layer acceptance smoke.
 *
 * @param {{ keep?: boolean }} [options]
 * @returns {{ ok: boolean, checks: Array<{name:string, ok:boolean, detail:string}>, workdir: string }}
 */
export function runAcceptanceSmoke(options = {}) {
  const root = mkdtempSync(join(tmpdir(), "agentctx-acceptance-"));
  const project = join(root, "project");
  const bare = join(root, "bare");
  const checks = [];

  try {
    // --- Step 1: init scaffolds the template ------------------------------
    const init = runCli(INIT_CLI, ["--cwd", project], root);
    check(
      checks,
      "init: exits 0",
      init.status === 0,
      init.status === 0 ? "" : `status=${init.status} stderr=${init.stderr.trim()}`,
    );
    const missing = EXPECTED_TEMPLATE_FILES.filter(
      (rel) => !existsSync(join(project, rel)),
    );
    check(
      checks,
      "init: scaffolds all template sources",
      missing.length === 0,
      missing.length === 0 ? "" : `missing: ${missing.join(", ")}`,
    );

    // --- Step 2: re-init without --force fails closed ---------------------
    const reinit = runCli(INIT_CLI, ["--cwd", project], root);
    check(
      checks,
      "init: refuses overwrite without --force",
      reinit.status !== 0 && /already exists/i.test(reinit.stderr),
      reinit.status !== 0
        ? ""
        : `expected non-zero, got status=${reinit.status}`,
    );

    // --- Step 3: compile JSON is usable and always includes constraints ---
    const compileJson = runCli(
      COMPILE_CLI,
      ["compile", "--cwd", project, "--task", SMOKE_TASK, "--scope", SMOKE_SCOPE, "--format", "json"],
      root,
    );
    const jsonOk = check(
      checks,
      "compile(json): exits 0",
      compileJson.status === 0,
      compileJson.status === 0
        ? ""
        : `status=${compileJson.status} stderr=${compileJson.stderr.trim()}`,
    );

    let pack = null;
    if (jsonOk) {
      try {
        pack = JSON.parse(compileJson.stdout);
      } catch (error) {
        check(checks, "compile(json): output parses", false, String(error.message));
      }
    }
    if (pack) {
      check(checks, "compile(json): output parses", true);
      check(
        checks,
        "compile(json): task echoed back",
        pack.task === SMOKE_TASK,
        pack.task === SMOKE_TASK ? "" : `got task=${JSON.stringify(pack.task)}`,
      );
      check(
        checks,
        "compile(json): generatedAt is an ISO timestamp",
        typeof pack.generatedAt === "string" &&
          !Number.isNaN(Date.parse(pack.generatedAt)),
        `generatedAt=${JSON.stringify(pack.generatedAt)}`,
      );
      check(
        checks,
        "compile(json): selects at least one block",
        Array.isArray(pack.selected) && pack.selected.length > 0,
        `selected=${Array.isArray(pack.selected) ? pack.selected.length : "n/a"}`,
      );
      const constraintsBlock = (pack.selected ?? []).find(
        (block) => block.file === "constraints.md",
      );
      check(
        checks,
        "compile(json): constraints.md always included",
        Boolean(constraintsBlock) && constraintsBlock.score === "always",
        constraintsBlock ? `score=${constraintsBlock.score}` : "no constraints.md block",
      );
      const matchedBlock = (pack.selected ?? []).find(
        (block) => block.reason === "matched",
      );
      check(
        checks,
        "compile(json): task scope surfaces a matched block",
        Boolean(matchedBlock),
        matchedBlock ? `${matchedBlock.file} / ${matchedBlock.title}` : "no matched block",
      );
    }

    // --- Step 4: compile markdown renders the context pack ----------------
    const compileMd = runCli(
      COMPILE_CLI,
      ["compile", "--cwd", project, "--task", SMOKE_TASK, "--scope", SMOKE_SCOPE],
      root,
    );
    check(
      checks,
      "compile(markdown): renders a context pack",
      compileMd.status === 0 &&
        compileMd.stdout.includes("# agentctx context pack") &&
        compileMd.stdout.includes("## Included Context"),
      compileMd.status === 0 ? "" : `status=${compileMd.status} stderr=${compileMd.stderr.trim()}`,
    );

    // --- Step 5: bare dir gives a friendly init hint ----------------------
    const compileBare = runCli(
      COMPILE_CLI,
      ["compile", "--cwd", bare, "--task", SMOKE_TASK],
      root,
    );
    check(
      checks,
      "compile(bare dir): fails closed with agentctx:init hint",
      compileBare.status !== 0 && /agentctx:init/.test(compileBare.stderr),
      compileBare.status !== 0
        ? ""
        : `expected non-zero, got status=${compileBare.status}`,
    );

    const ok = checks.every((c) => c.ok);
    return { ok, checks, workdir: root };
  } finally {
    if (options.keep !== true) {
      rmSync(root, { recursive: true, force: true });
    }
  }
}

function renderReport(report) {
  const lines = ["Mind Ontology free-layer acceptance smoke", ""];
  for (const c of report.checks) {
    lines.push(`  ${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
  }
  const passed = report.checks.filter((c) => c.ok).length;
  lines.push("");
  lines.push(`${report.ok ? "SMOKE PASS" : "SMOKE FAIL"} (${passed}/${report.checks.length} checks)`);
  lines.push("");
  return lines.join("\n");
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  const keep = process.argv.slice(2).includes("--keep");
  const report = runAcceptanceSmoke({ keep });
  process.stdout.write(renderReport(report));
  process.exit(report.ok ? 0 : 1);
}
