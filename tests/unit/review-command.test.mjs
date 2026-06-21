import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it, vi } from "vitest";
import { parseReviewArgv } from "../../scripts/agentctx/review.mjs";
import { validateResultPack } from "../../scripts/agentctx/result-pack.mjs";

// W9 — `mind-ontology review` (W2 §9): shape verdict over the shared
// result-pack module, guard tests printed as commands (never run, operator
// ruling Q8), and the controller checklist echoed honestly.

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = resolve(REPO_ROOT, "scripts/agentctx/cli.mjs");
const EXAMPLE = resolve(REPO_ROOT, "tests/fixtures/autopilot-result-pack.example.json");

vi.setConfig({ testTimeout: 60_000 });

const tempRoots = [];
afterAll(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
}

function packFile(mutate) {
  const pack = JSON.parse(readFileSync(EXAMPLE, "utf8"));
  mutate(pack);
  const dir = mkdtempSync(join(tmpdir(), "mo-review-"));
  tempRoots.push(dir);
  const path = join(dir, "result-pack.json");
  writeFileSync(path, JSON.stringify(pack, null, 2));
  return path;
}

describe("W9 — review on the example pack fixture", () => {
  it("a valid pack: every invariant PASS, guard tests printed, exit 0", () => {
    const r = runCli(["review", "--pack", EXAMPLE]);
    expect(r.status).toBe(0);
    expect(r.stderr).toBe("");
    for (const n of [1, 2, 3, 4, 5]) {
      expect(r.stdout).toMatch(new RegExp(`PASS  ${n}\\.`));
    }
    expect(r.stdout).toContain("npx vitest run tests/unit/example.test.mjs");
    expect(r.stdout).toContain("OK - pack valid");
  });

  it("the checklist is echoed with honest verdicts (machine only where shape covers it)", () => {
    const r = runCli(["review", "--pack", EXAMPLE]);
    expect(r.stdout).toContain("machine  2. Guards present");
    expect(r.stdout).toContain("machine  5. Stop state honest");
    expect(r.stdout).toContain("manual   1. Write scope respected");
    expect(r.stdout).toContain("manual   7. Lockfile clean");
  });

  it("the JSON shape carries the W2 §9 normative keys", () => {
    const r = runCli(["review", "--pack", EXAMPLE, "--format", "json"]);
    const out = JSON.parse(r.stdout);
    expect(Object.keys(out)).toEqual([
      "ok",
      "schema",
      "lane",
      "violations",
      "guard_tests",
      "checklist",
    ]);
    expect(out.ok).toBe(true);
    expect(out.schema).toBe("sirt.result-pack/v1");
    expect(out.violations).toEqual([]);
    expect(out.guard_tests).toEqual(["tests/unit/example.test.mjs"]);
    for (const item of out.checklist) {
      expect(Object.keys(item)).toEqual(["item", "title", "verdict"]);
      expect(["machine", "manual"]).toContain(item.verdict);
    }
  });
});

describe("W9 — shape violations are a stdout report, exit 1", () => {
  it("a forbidden-scope admission fails invariant 2 with the documented message", () => {
    const path = packFile((p) => {
      p.forbidden_scope_touched = true;
    });
    const r = runCli(["review", "--pack", path, "--format", "json"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toBe("");
    const out = JSON.parse(r.stdout);
    expect(out.ok).toBe(false);
    expect(out.violations).toContainEqual({
      invariant: 2,
      message: "forbidden_scope_touched is true",
    });
  });

  it("a missing required key fails invariant 1", () => {
    const path = packFile((p) => {
      delete p.handoff;
    });
    const r = runCli(["review", "--pack", path, "--format", "json"]);
    expect(r.status).toBe(1);
    expect(JSON.parse(r.stdout).violations).toContainEqual({
      invariant: 1,
      message: "missing required key: handoff",
    });
  });

  it("an empty adls_completed fails invariant 4", () => {
    const path = packFile((p) => {
      p.adls_completed = [];
    });
    const r = runCli(["review", "--pack", path]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("FAIL  4.");
    expect(r.stdout).toContain("INVALID -");
  });

  it("an inconsistent stop state fails invariant 5", () => {
    const path = packFile((p) => {
      p.status = "complete";
    });
    const r = runCli(["review", "--pack", path, "--format", "json"]);
    expect(r.status).toBe(1);
    const messages = JSON.parse(r.stdout).violations.map((v) => v.message);
    expect(messages.some((m) => m.includes('status must be "in-progress"'))).toBe(true);
  });

  it("hosted leakage in the pack fails invariant 3", () => {
    // The shipped LEAKAGE_PATTERN matches hosted endpoints by shape (e.g. a
    // workers.dev host), never by vendor-private name, so the fixture uses a
    // generic hosted URL.
    const path = packFile((p) => {
      p.handoff = "Pushed to https://connector.example.workers.dev/mcp for ingest.";
    });
    const r = runCli(["review", "--pack", path, "--format", "json"]);
    expect(r.status).toBe(1);
    expect(JSON.parse(r.stdout).violations.some((v) => v.invariant === 3)).toBe(true);
  });
});

describe("W9 — hard errors (stderr, exit 1, no report)", () => {
  it("missing --pack", () => {
    const r = runCli(["review"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toBe("");
    expect(r.stderr).toMatch(/Missing required --pack argument/);
  });

  it("unreadable path names the path and the next safe action", () => {
    const r = runCli(["review", "--pack", "does/not/exist.json"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toBe("");
    expect(r.stderr).toMatch(/Cannot read Result Pack: does\/not\/exist\.json/);
    // The message must not just name the path; it must point to a next step.
    expect(r.stderr).toMatch(/Check the path .* re-run with --pack <path>/);
  });

  it("invalid JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "mo-review-bad-"));
    tempRoots.push(dir);
    const path = join(dir, "broken.json");
    writeFileSync(path, "{ not json");
    const r = runCli(["review", "--pack", path]);
    expect(r.status).toBe(1);
    expect(r.stdout).toBe("");
    expect(r.stderr).toMatch(/Result Pack is not valid JSON:/);
  });

  it("bad --format and unknown flags use the shared wording", () => {
    expect(() => parseReviewArgv(["--pack", "x", "--format", "xml"])).toThrow(
      /--format must be "text" or "json", got: xml/,
    );
    expect(() => parseReviewArgv(["--bogus"])).toThrow(/Unknown argument: --bogus/);
  });
});

describe("W9 — one set of rules, two consumers", () => {
  it("the CLI verdict equals the shared module's verdict on the same pack", () => {
    const pack = JSON.parse(readFileSync(EXAMPLE, "utf8"));
    const direct = validateResultPack(pack);
    const cli = JSON.parse(runCli(["review", "--pack", EXAMPLE, "--format", "json"]).stdout);
    expect(cli.ok).toBe(direct.ok);
    expect(cli.violations).toEqual(direct.violations);
  });

  // The valid-pack equivalence above only proves both consumers accept a clean
  // pack (each returns ok:true, violations:[]) — it would still pass if
  // review.mjs forked its own copy of the rules instead of importing the shared
  // result-pack module. Pin the shared-rule-set claim against that
  // duplication-drift failure mode: compare the CLI verdict to
  // validateResultPack's direct verdict across the valid pack AND one mutation
  // per invariant, so any divergence between the two consumers' rule sets
  // surfaces as a verdict mismatch (ok or the full violations array), not just a
  // disagreement that happens to land on the one valid example.
  const sharedRuleSetCases = [
    ["a valid pack", () => {}],
    ["a forbidden-scope admission (invariant 2)", (p) => { p.forbidden_scope_touched = true; }],
    ["a missing required key (invariant 1)", (p) => { delete p.handoff; }],
    ["an empty adls_completed (invariant 4)", (p) => { p.adls_completed = []; }],
    ["an inconsistent stop state (invariant 5)", (p) => { p.status = "complete"; }],
    [
      "hosted leakage (invariant 3)",
      (p) => { p.handoff = "Pushed to https://connector.example.workers.dev/mcp for ingest."; },
    ],
  ];

  it.each(sharedRuleSetCases)(
    "the CLI verdict equals the shared module's verdict on %s",
    (_label, mutate) => {
      const path = packFile(mutate);
      const direct = validateResultPack(JSON.parse(readFileSync(path, "utf8")));
      const cli = JSON.parse(runCli(["review", "--pack", path, "--format", "json"]).stdout);
      expect(cli.ok).toBe(direct.ok);
      expect(cli.violations).toEqual(direct.violations);
    },
  );
});
