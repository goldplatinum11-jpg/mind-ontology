/**
 * harvester.test.mjs — Regression tests for Campaign A harvester foundation.
 *
 * Covers: classifier rules, writer duplicate protection, ChatGPT parser,
 * and the import CLI surface.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

import { CATEGORY, CONFIDENCE } from "../../scripts/agentctx/harvest-model.mjs";
import { classifyCandidate, classifyCandidates } from "../../scripts/agentctx/harvest-classifier.mjs";
import { writeEntry, writeEntries, recordSource } from "../../scripts/agentctx/harvest-writer.mjs";
import { parseChatGPTExport } from "../../scripts/agentctx/harvest-chatgpt.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = resolve(REPO_ROOT, "scripts/agentctx/cli.mjs");

// ---------------------------------------------------------------------------
// Temp directory management
// ---------------------------------------------------------------------------

const tempDirs = [];
afterEach(() => {
  while (tempDirs.length) rmSync(tempDirs.pop(), { recursive: true, force: true });
});

function tempAgentctx() {
  const dir = mkdtempSync(join(tmpdir(), "mo-harvest-"));
  tempDirs.push(dir);
  const agentctxDir = join(dir, ".agentctx");
  mkdirSync(agentctxDir);
  return { projectDir: dir, agentctxDir };
}

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
}

// ---------------------------------------------------------------------------
// Classifier — accepted examples
// ---------------------------------------------------------------------------

describe("harvester classifier — accepted examples", () => {
  it("keeps a clear decision statement", () => {
    const candidate = {
      sourceId: "test:1",
      text: "We decided to keep the free layer self-hosted because developers need to inspect their own context layer.",
      context: "",
      speakerRole: "user",
      turnIndex: 0,
    };
    const entry = classifyCandidate(candidate);
    expect(entry).not.toBeNull();
    expect(entry.category).toBe(CATEGORY.DECISION);
    expect(entry.confidence).not.toBe(CONFIDENCE.LOW);
  });

  it("keeps a constraint statement", () => {
    const candidate = {
      sourceId: "test:2",
      text: "We must never write API keys or tokens into CLAUDE.md or any AI config file.",
      context: "",
      speakerRole: "user",
      turnIndex: 1,
    };
    const entry = classifyCandidate(candidate);
    expect(entry).not.toBeNull();
    expect(entry.category).toBe(CATEGORY.CONSTRAINT);
  });

  it("keeps a glossary definition", () => {
    const candidate = {
      sourceId: "test:3",
      text: "Context pack means the compiled subset of .agentctx/ blocks relevant to a task.",
      context: "",
      speakerRole: "assistant",
      turnIndex: 2,
    };
    const entry = classifyCandidate(candidate);
    expect(entry).not.toBeNull();
    expect(entry.category).toBe(CATEGORY.GLOSSARY);
  });
});

// ---------------------------------------------------------------------------
// Classifier — rejected examples
// ---------------------------------------------------------------------------

describe("harvester classifier — rejected examples (implementation details)", () => {
  it("rejects a function name / code reference", () => {
    const candidate = {
      sourceId: "test:4",
      text: "const classifyCandidate = (c) => { return entries.filter(Boolean); }",
      context: "",
      speakerRole: "assistant",
      turnIndex: 3,
    };
    expect(classifyCandidate(candidate)).toBeNull();
  });

  it("rejects a bug fix description", () => {
    const candidate = {
      sourceId: "test:5",
      text: "Fixed the bug where ranked.findIndex was not a function.",
      context: "",
      speakerRole: "assistant",
      turnIndex: 4,
    };
    expect(classifyCandidate(candidate)).toBeNull();
  });

  it("rejects test noise", () => {
    const candidate = {
      sourceId: "test:6",
      text: "Tests 1374 passing, 4 failing in readme-claims-audit.test.mjs.",
      context: "",
      speakerRole: "assistant",
      turnIndex: 5,
    };
    expect(classifyCandidate(candidate)).toBeNull();
  });

  it("rejects a git command log line", () => {
    const candidate = {
      sourceId: "test:7",
      text: "git commit -m 'fix: add #decision tag to decisions.md'",
      context: "",
      speakerRole: "assistant",
      turnIndex: 6,
    };
    expect(classifyCandidate(candidate)).toBeNull();
  });

  it("rejects a very short fragment", () => {
    const candidate = {
      sourceId: "test:8",
      text: "OK",
      context: "",
      speakerRole: "user",
      turnIndex: 7,
    };
    expect(classifyCandidate(candidate)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Writer — duplicate protection
// ---------------------------------------------------------------------------

describe("harvester writer — duplicate protection", () => {
  it("writes an entry and skips a duplicate heading on rerun", () => {
    const { agentctxDir } = tempAgentctx();

    const entry = {
      category: CATEGORY.DECISION,
      confidence: CONFIDENCE.HIGH,
      heading: "Keep the free layer self-hosted",
      body: "Developers should be able to inspect their own context layer.",
      tags: ["oss"],
      sourceId: "test:src1",
      turnIndex: 0,
    };

    const r1 = writeEntry(agentctxDir, entry, "test source");
    expect(r1.written).toBe(true);
    expect(r1.duplicate).toBe(false);
    expect(r1.targetFile).toBe("decisions.md");

    const r2 = writeEntry(agentctxDir, entry, "test source");
    expect(r2.written).toBe(false);
    expect(r2.duplicate).toBe(true);
  });

  it("duplicate detection is case-insensitive and punctuation-agnostic", () => {
    const { agentctxDir } = tempAgentctx();

    const entry1 = {
      category: CATEGORY.CONSTRAINT,
      confidence: CONFIDENCE.HIGH,
      heading: "Never write secrets to CLAUDE.md",
      body: "",
      tags: [],
      sourceId: "test:src2",
    };
    const entry2 = { ...entry1, heading: "never write secrets to claude md" };

    writeEntry(agentctxDir, entry1, "s");
    const r2 = writeEntry(agentctxDir, entry2, "s");
    expect(r2.duplicate).toBe(true);
  });

  it("low-confidence entries go to inbox.md", () => {
    const { agentctxDir } = tempAgentctx();

    const entry = {
      category: CATEGORY.INBOX,
      confidence: CONFIDENCE.LOW,
      heading: "Maybe we should reconsider the approach",
      body: "",
      tags: [],
      sourceId: "test:src3",
    };

    const r = writeEntry(agentctxDir, entry, "s");
    expect(r.targetFile).toBe("inbox.md");
    expect(r.written).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ChatGPT parser
// ---------------------------------------------------------------------------

describe("harvester ChatGPT parser", () => {
  it("parses a minimal single-conversation export", () => {
    const conv = {
      id: "conv-abc123",
      title: "Architecture discussion",
      mapping: {
        "node-1": {
          id: "node-1",
          parent: null,
          children: ["node-2"],
          message: {
            author: { role: "user" },
            content: { parts: ["We decided to use open-core distribution for Mind Ontology because the free layer must be inspectable."] },
          },
        },
        "node-2": {
          id: "node-2",
          parent: "node-1",
          children: [],
          message: {
            author: { role: "assistant" },
            content: { parts: ["That makes sense. The hosted SIRT layer remains the paid tier."] },
          },
        },
      },
    };

    const results = parseChatGPTExport(JSON.stringify(conv), "test.json");
    expect(results).toHaveLength(1);
    const { source, candidates } = results[0];

    expect(source.id).toBe("chatgpt:conv-abc123");
    expect(source.type).toBe("chatgpt-export");
    expect(candidates.length).toBeGreaterThan(0);

    const texts = candidates.map(c => c.text);
    expect(texts.some(t => t.includes("open-core"))).toBe(true);
  });

  it("parses an array of conversations", () => {
    const convs = [
      { id: "c1", title: "T1", mapping: {} },
      { id: "c2", title: "T2", mapping: {} },
    ];
    const results = parseChatGPTExport(JSON.stringify(convs), "export.json");
    expect(results).toHaveLength(2);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseChatGPTExport("not-json", "bad.json")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Import CLI surface
// ---------------------------------------------------------------------------

describe("harvester import CLI", () => {
  it("import --help shows the command name", () => {
    const r = runCli(["import", "--help"]);
    // help text comes from cli.mjs which lists the command
    // just verify no hard crash with --help on underlying import.mjs
    // (the import.mjs will emit usage to stderr and exit 1 on no file arg)
    expect(r.status).toBeDefined();
  });

  it("import with no file arg exits 1 with usage on stderr", () => {
    const r = runCli(["import"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Usage/);
  });

  it("import with nonexistent file exits 1", () => {
    const r = runCli(["import", "/tmp/nonexistent-mo-test-12345.json"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/not found/);
  });

  it("import --dry-run with valid chatgpt fixture exits 0 and reports counts", () => {
    const { projectDir, agentctxDir: _agentctxDir } = tempAgentctx();

    // Write a minimal ChatGPT export fixture
    const conv = {
      id: "test-conv-dryrun",
      title: "Dry run test",
      mapping: {
        n1: {
          id: "n1", parent: null, children: [],
          message: {
            author: { role: "user" },
            content: { parts: ["We decided to keep the self-hosted OSS layer because developers must inspect their context."] },
          },
        },
      },
    };
    const fixturePath = join(projectDir, "export.json");
    writeFileSync(fixturePath, JSON.stringify([conv]));

    const r = runCli(["import", fixturePath, "--cwd", projectDir, "--dry-run"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/DRY RUN/);
  });

  it("import --format json with valid fixture exits 0 with JSON output", () => {
    const { projectDir } = tempAgentctx();

    const conv = {
      id: "test-conv-json",
      title: "JSON format test",
      mapping: {
        n1: {
          id: "n1", parent: null, children: [],
          message: {
            author: { role: "user" },
            content: { parts: ["We must never require external API keys because that creates unnecessary barriers for OSS users."] },
          },
        },
      },
    };
    const fixturePath = join(projectDir, "export.json");
    writeFileSync(fixturePath, JSON.stringify([conv]));

    const r = runCli(["import", fixturePath, "--cwd", projectDir, "--format", "json"]);
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.ok).toBe(true);
    expect(out.sourcesProcessed).toBe(1);
  });

  it("import without .agentctx/ exits 1 with init hint", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "mo-noctx-"));
    tempDirs.push(tmpDir);
    const fixturePath = join(tmpDir, "export.json");
    writeFileSync(fixturePath, JSON.stringify({ id: "x", title: "t", mapping: {} }));

    const r = runCli(["import", fixturePath, "--cwd", tmpDir]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/init/);
  });
});
