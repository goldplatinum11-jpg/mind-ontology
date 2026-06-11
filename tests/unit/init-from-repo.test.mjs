import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  extractAgentDocHints,
  generateOntologyDraft,
  initFromRepo,
  readRecentCommitSubjects,
  sanitizeText,
  scanRepo,
} from "../../scripts/agentctx/init-from-repo.mjs";
import { parseInitArgv } from "../../scripts/agentctx/init.mjs";
import { SOURCE_FILES } from "../../scripts/agentctx/compile.mjs";
import { validateOntology } from "../../scripts/agentctx/schema.mjs";

const tempRoots = [];

function makeTempRoot() {
  const dir = mkdtempSync(join(tmpdir(), "agentctx-from-repo-"));
  tempRoots.push(dir);
  return dir;
}

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop(), { recursive: true, force: true });
  }
});

function writeNodeRepo(cwd, overrides = {}) {
  writeFileSync(
    join(cwd, "package.json"),
    JSON.stringify({
      name: "acme-webapp",
      description: "A scheduling app for small dental clinics.",
      license: "MIT",
      scripts: { test: "vitest run", build: "vite build", lint: "eslint ." },
      dependencies: { react: "^18.0.0", express: "^4.0.0" },
      devDependencies: { vitest: "^1.0.0" },
      ...overrides,
    }),
  );
  writeFileSync(
    join(cwd, "README.md"),
    [
      "# Acme Webapp",
      "",
      "[![ci](https://example.test/badge.svg)](https://example.test)",
      "",
      "Acme Webapp lets small dental clinics manage bookings without phone calls.",
      "It runs as a single web app with no external services.",
      "",
      "## Install",
      "",
      "npm install",
    ].join("\n"),
  );
  mkdirSync(join(cwd, "src"));
  mkdirSync(join(cwd, "tests"));
  return cwd;
}

describe("init --from-repo flag parsing", () => {
  it("parses --from-repo alongside the existing init flags", () => {
    const options = parseInitArgv(["--cwd", "demo", "--from-repo", "--force"]);
    expect(options.fromRepo).toBe(true);
    expect(options.force).toBe(true);
  });

  it("defaults fromRepo to false so plain init is unchanged", () => {
    expect(parseInitArgv([]).fromRepo).toBe(false);
  });
});

describe("scanRepo reads only public artifacts", () => {
  it("extracts name, description, scripts, and frameworks from package.json", () => {
    const cwd = writeNodeRepo(makeTempRoot());
    const facts = scanRepo(cwd);

    expect(facts.name).toBe("acme-webapp");
    expect(facts.description).toBe("A scheduling app for small dental clinics.");
    expect(facts.language).toBe("JavaScript (Node.js)");
    expect(facts.scripts.test).toBe("vitest run");
    expect(facts.frameworks).toContain("React");
    expect(facts.layout.map((entry) => entry.dir)).toEqual(
      expect.arrayContaining(["src", "tests"]),
    );
  });

  it("skips the README title and badges and keeps the first real paragraph", () => {
    const cwd = writeNodeRepo(makeTempRoot());
    const facts = scanRepo(cwd);

    expect(facts.readme.title).toBe("Acme Webapp");
    expect(facts.readme.summary).toContain("manage bookings without phone calls");
    expect(facts.readme.summary).not.toContain("badge.svg");
  });

  it("detects a Python project from pyproject.toml", () => {
    const cwd = makeTempRoot();
    writeFileSync(
      join(cwd, "pyproject.toml"),
      ['[project]', 'name = "acme-ml"', 'description = "Training pipeline."'].join("\n"),
    );
    const facts = scanRepo(cwd);

    expect(facts.manifest).toBe("pyproject.toml");
    expect(facts.name).toBe("acme-ml");
    expect(facts.language).toBe("Python");
  });

  it("falls back to the directory name when no manifest or README exists", () => {
    const cwd = makeTempRoot();
    const facts = scanRepo(cwd);

    expect(facts.name).toBe(cwd.split(/[\\/]/).pop());
    expect(facts.manifest).toBeNull();
  });
});

describe("sanitizeText scrubs extracted strings", () => {
  it("drops credential-shaped lines entirely", () => {
    const dirty = "A nice project.\napi_key: sk-12345\nIt does things.";
    const clean = sanitizeText(dirty);
    expect(clean).toContain("A nice project.");
    expect(clean).toContain("It does things.");
    expect(clean).not.toContain("sk-12345");
  });

  it("caps runaway paragraphs at a word boundary", () => {
    const long = Array.from({ length: 200 }, () => "word").join(" ");
    expect(sanitizeText(long).length).toBeLessThanOrEqual(401);
    expect(sanitizeText(long).endsWith("…")).toBe(true);
  });
});

describe("generateOntologyDraft produces a schema-valid draft", () => {
  it("writes all nine ontology source files", () => {
    const cwd = writeNodeRepo(makeTempRoot());
    const result = initFromRepo({ cwd });

    expect(result.files).toEqual(SOURCE_FILES.map((file) => `.agentctx/${file}`));
    for (const file of SOURCE_FILES) {
      expect(existsSync(join(cwd, ".agentctx", file))).toBe(true);
    }
  });

  it("validates clean against the ontology schema with zero errors", () => {
    const cwd = writeNodeRepo(makeTempRoot());
    initFromRepo({ cwd });

    const report = validateOntology(cwd);
    expect(report.issues.filter((i) => i.level === "error")).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it("still validates clean from an empty repository (graceful fallback)", () => {
    const cwd = makeTempRoot();
    initFromRepo({ cwd });

    const report = validateOntology(cwd);
    expect(report.ok).toBe(true);
    expect(readFileSync(join(cwd, ".agentctx", "projects.md"), "utf8")).toContain("TODO:");
  });

  it("lands the manifest name and description in projects.md", () => {
    const cwd = writeNodeRepo(makeTempRoot());
    initFromRepo({ cwd });

    const projects = readFileSync(join(cwd, ".agentctx", "projects.md"), "utf8");
    expect(projects).toContain("Name: acme-webapp");
    expect(projects).toContain("Status: active");
    expect(projects).toContain("A scheduling app for small dental clinics.");
    expect(projects).toContain("Source: package.json");
  });

  it("lands the README summary in direction.md", () => {
    const cwd = writeNodeRepo(makeTempRoot());
    initFromRepo({ cwd });

    const direction = readFileSync(join(cwd, ".agentctx", "direction.md"), "utf8");
    expect(direction).toContain("manage bookings without phone calls");
    expect(direction).toContain("TODO:");
  });

  it("records the detected stack and test command where agents act on them", () => {
    const cwd = writeNodeRepo(makeTempRoot());
    initFromRepo({ cwd });

    expect(readFileSync(join(cwd, ".agentctx", "decisions.md"), "utf8")).toContain(
      "JavaScript (Node.js)",
    );
    expect(readFileSync(join(cwd, ".agentctx", "agent-roles.md"), "utf8")).toContain(
      "vitest run",
    );
    expect(readFileSync(join(cwd, ".agentctx", "architecture.md"), "utf8")).toContain(
      "`npm run test`",
    );
    expect(readFileSync(join(cwd, ".agentctx", "constraints.md"), "utf8")).toContain(
      "vitest run",
    );
  });

  it("marks human-only knowledge as TODO instead of inventing it", () => {
    const cwd = writeNodeRepo(makeTempRoot());
    initFromRepo({ cwd });

    const identity = readFileSync(join(cwd, ".agentctx", "identity.md"), "utf8");
    expect(identity).toContain("TODO:");
  });

  it("never copies credential-shaped values from repo artifacts", () => {
    const cwd = makeTempRoot();
    writeFileSync(
      join(cwd, "package.json"),
      JSON.stringify({
        name: "leaky-app",
        description: "Demo app.",
        scripts: { test: "vitest run" },
      }),
    );
    writeFileSync(
      join(cwd, "README.md"),
      ["# Leaky App", "", "A demo project.", "api_key: sk-test-99999", "More text."].join("\n"),
    );
    initFromRepo({ cwd });

    const pattern = /\b(?:api[_-]?key|pass\s*word|sec\s*ret|to\s*ken|private[_-]?key)\b\s*[:=]\s*\S/i;
    for (const file of SOURCE_FILES) {
      const raw = readFileSync(join(cwd, ".agentctx", file), "utf8");
      expect(raw).not.toContain("sk-test-99999");
      expect(pattern.test(raw)).toBe(false);
    }
    expect(validateOntology(cwd).ok).toBe(true);
  });

  it("is deterministic: same repository, byte-identical draft", () => {
    const a = writeNodeRepo(makeTempRoot());
    const b = writeNodeRepo(makeTempRoot());
    const draftA = generateOntologyDraft({ ...scanRepo(a), root: "x", name: "acme-webapp" });
    const draftB = generateOntologyDraft({ ...scanRepo(b), root: "x", name: "acme-webapp" });

    expect(draftA).toEqual(draftB);
  });
});

describe("init --from-repo safety contract (mirrors M21)", () => {
  it("refuses to overwrite an existing .agentctx/ without force", () => {
    const cwd = writeNodeRepo(makeTempRoot());
    initFromRepo({ cwd });

    expect(() => initFromRepo({ cwd })).toThrow(/already exists\. Re-run with --force/);
  });

  it("a refused re-run leaves user edits intact", () => {
    const cwd = writeNodeRepo(makeTempRoot());
    initFromRepo({ cwd });
    const marker = "## My own block #identity #operator\n\nHand-written.\n";
    writeFileSync(join(cwd, ".agentctx", "identity.md"), marker);

    expect(() => initFromRepo({ cwd })).toThrow(/already exists/);
    expect(readFileSync(join(cwd, ".agentctx", "identity.md"), "utf8")).toBe(marker);
  });

  it("overwrites with a fresh draft when force is true", () => {
    const cwd = writeNodeRepo(makeTempRoot());
    initFromRepo({ cwd });
    writeFileSync(join(cwd, ".agentctx", "identity.md"), "# scribbled\n");

    const result = initFromRepo({ cwd, force: true });
    expect(result.mode).toBe("from-repo");
    expect(readFileSync(join(cwd, ".agentctx", "identity.md"), "utf8")).toContain(
      "Operator profile",
    );
  });
});

describe("CLAUDE.md / AGENTS.md guidance import (R1)", () => {
  const CLAUDE_MD = [
    "# Project instructions",
    "",
    "## Rules",
    "",
    "- Never commit directly to the main branch.",
    "- Run the full test suite before every merge.",
    "",
    "## Agent roles",
    "",
    "- The reviewer agent approves every change before it lands.",
    "",
    "Some unrelated prose paragraph about the weather.",
  ].join("\n");

  it("imports safety/workflow lines from CLAUDE.md into constraints.md", () => {
    const cwd = writeNodeRepo(makeTempRoot());
    writeFileSync(join(cwd, "CLAUDE.md"), CLAUDE_MD);
    const facts = scanRepo(cwd);

    expect(facts.agentDocs.files).toContain("CLAUDE.md");
    expect(facts.sources).toContain("CLAUDE.md");
    expect(facts.agentDocs.constraints).toContain("Never commit directly to the main branch.");

    initFromRepo({ cwd, force: true });
    const constraints = readFileSync(join(cwd, ".agentctx", "constraints.md"), "utf8");
    expect(constraints).toContain("Imported agent instructions (draft)");
    expect(constraints).toContain("Never commit directly to the main branch.");
    expect(constraints).not.toContain("prose paragraph about the weather");
    expect(validateOntology(cwd).ok).toBe(true);
  });

  it("imports role/workflow hints from AGENTS.md into agent-roles.md", () => {
    const cwd = writeNodeRepo(makeTempRoot());
    writeFileSync(
      join(cwd, "AGENTS.md"),
      ["## Workflow", "", "- The worker implements; the controller reviews and commits."].join("\n"),
    );
    initFromRepo({ cwd });

    const roles = readFileSync(join(cwd, ".agentctx", "agent-roles.md"), "utf8");
    expect(roles).toContain("Imported role and workflow hints (draft)");
    expect(roles).toContain("the controller reviews and commits");
    expect(roles).toContain("Source: AGENTS.md");
    expect(validateOntology(cwd).ok).toBe(true);
  });

  it("keeps the TODO fallback when neither instruction file exists", () => {
    const cwd = writeNodeRepo(makeTempRoot());
    initFromRepo({ cwd });

    expect(readFileSync(join(cwd, ".agentctx", "constraints.md"), "utf8")).not.toContain(
      "Imported agent instructions",
    );
    expect(readFileSync(join(cwd, ".agentctx", "agent-roles.md"), "utf8")).not.toContain(
      "Imported role and workflow hints",
    );
    expect(validateOntology(cwd).ok).toBe(true);
  });

  it("never imports credential-shaped or machine-local lines", () => {
    const cwd = writeNodeRepo(makeTempRoot());
    writeFileSync(
      join(cwd, "CLAUDE.md"),
      [
        "## Rules",
        "",
        "- Never push to production on Fridays.",
        "- api_key: sk-live-77777",
        "- You must deploy via ssh root@10.0.0.5 only.",
        "- Never edit C:\\Users\\someone\\secrets.txt directly.",
      ].join("\n"),
    );
    initFromRepo({ cwd });

    for (const file of SOURCE_FILES) {
      const raw = readFileSync(join(cwd, ".agentctx", file), "utf8");
      expect(raw).not.toContain("sk-live-77777");
      expect(raw).not.toContain("10.0.0.5");
      expect(raw).not.toContain("secrets.txt");
    }
    const constraints = readFileSync(join(cwd, ".agentctx", "constraints.md"), "utf8");
    expect(constraints).toContain("Never push to production on Fridays.");
    expect(validateOntology(cwd).ok).toBe(true);
  });

  it("skips emitted mind-ontology artifacts instead of recycling them", () => {
    const emitted = [
      "<!-- mind-ontology:emit",
      "target: claude-md",
      "-->",
      "## Rules",
      "- Never bypass the compiled constraints.",
    ].join("\n");
    expect(extractAgentDocHints(emitted)).toEqual({ constraints: [], roles: [] });

    const cwd = writeNodeRepo(makeTempRoot());
    writeFileSync(join(cwd, "CLAUDE.md"), emitted);
    const facts = scanRepo(cwd);
    expect(facts.agentDocs.files).toEqual([]);
  });

  it("caps each hint bucket and classifies bullets under guidance headings", () => {
    const bullets = Array.from({ length: 10 }, (_, i) => `- Always keep invariant number ${i} intact.`);
    const { constraints, roles } = extractAgentDocHints(["## Rules", "", ...bullets].join("\n"));
    expect(constraints.length).toBeLessThanOrEqual(6);
    expect(roles).toEqual([]);
  });
});

// Git process spawns on Windows are slow (~0.5s each), so fixtures that make
// several commits need more than vitest's 5s default timeout.
const GIT_TEST_TIMEOUT = 30_000;

// Isolate fixture repos from the developer's global/system git config: a
// commit.gpgsign or core.fsmonitor setting there would stall or fail these
// tests, and skipping the config reads also speeds up each spawn. Git treats
// the literal string "/dev/null" as "no config" on every platform, including
// Windows, where os.devNull (`\\.\nul`) is rejected as a config path.
const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_TERMINAL_PROMPT: "0",
};
const GIT_OPTS = { stdio: "ignore", windowsHide: true, env: GIT_ENV };

const gitAvailable = (() => {
  try {
    execFileSync("git", ["--version"], GIT_OPTS);
    return true;
  } catch {
    return false;
  }
})();

function writeGitRepo(cwd, subjects) {
  execFileSync("git", ["init", "-q", cwd], GIT_OPTS);
  for (const subject of subjects) {
    execFileSync(
      "git",
      [
        "-C", cwd,
        "-c", "user.email=test@example.test",
        "-c", "user.name=Test User",
        "commit", "--allow-empty", "-q", "-m", subject,
      ],
      GIT_OPTS,
    );
  }
  return cwd;
}

describe("git commit subject import (R2)", () => {
  it.runIf(gitAvailable)("seeds decisions.md and projects.md from recent commit subjects", () => {
    const cwd = writeNodeRepo(makeTempRoot());
    writeGitRepo(cwd, [
      "Adopt vitest for unit tests",
      "Add booking cancellation flow",
      "Fix timezone bug in reminders",
    ]);
    const facts = scanRepo(cwd);
    expect(facts.commits).toEqual([
      "Fix timezone bug in reminders",
      "Add booking cancellation flow",
      "Adopt vitest for unit tests",
    ]);
    expect(facts.sources).toContain("git log");

    initFromRepo({ cwd, force: true });
    const decisions = readFileSync(join(cwd, ".agentctx", "decisions.md"), "utf8");
    expect(decisions).toContain("Recent change history (draft)");
    expect(decisions).toContain("Adopt vitest for unit tests");
    expect(decisions).toContain("Source: git log");
    const projects = readFileSync(join(cwd, ".agentctx", "projects.md"), "utf8");
    expect(projects).toContain("Recent activity (latest commit subjects, newest first):");
    expect(projects).toContain("Fix timezone bug in reminders");
    expect(validateOntology(cwd).ok).toBe(true);
  }, GIT_TEST_TIMEOUT);

  it.runIf(gitAvailable)("caps at 8 subjects, newest first, and scrubs credential-shaped ones", () => {
    const cwd = makeTempRoot();
    const subjects = Array.from({ length: 9 }, (_, i) => `Change number ${i + 1}`);
    subjects.push("api_key: sk-oops-12345");
    writeGitRepo(cwd, subjects);

    const commits = readRecentCommitSubjects(cwd);
    expect(commits.length).toBeLessThanOrEqual(8);
    expect(commits[0]).toBe("Change number 9"); // newest surviving subject first
    expect(commits.join("\n")).not.toContain("sk-oops-12345");
  }, GIT_TEST_TIMEOUT);

  it("stays graceful when cwd is not a git repository", () => {
    const cwd = writeNodeRepo(makeTempRoot());
    const facts = scanRepo(cwd);
    expect(facts.commits).toEqual([]);
    expect(facts.sources).not.toContain("git log");

    initFromRepo({ cwd, force: true });
    expect(readFileSync(join(cwd, ".agentctx", "decisions.md"), "utf8")).not.toContain(
      "Recent change history",
    );
    expect(validateOntology(cwd).ok).toBe(true);
  });

  it.runIf(gitAvailable)("stays graceful in a git repo with zero commits", () => {
    const cwd = makeTempRoot();
    execFileSync("git", ["init", "-q", cwd], GIT_OPTS);
    expect(readRecentCommitSubjects(cwd)).toEqual([]);
  }, GIT_TEST_TIMEOUT);
});
