import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
// CRLF-normalized like readme-claims-audit.test.mjs: the README's working-tree
// EOL is a git autocrlf artifact, not part of the audited inventory.
const README = readFileSync(resolve(REPO_ROOT, "README.md"), "utf8").replace(/\r\n/g, "\n");

// The fence classes the README may contain. Classification is deterministic
// and test-only — it never executes a fence:
//   command-example   ```sh — commands a reader can run; existence of the
//                     cited scripts/verbs/flags is held by the claims audit
//                     (W10), but the fence itself is documentation, never an
//                     unscoped integration test.
//   verified-output   ```text — pasted engine output whose bytes the claims
//                     audit (W10) re-derives by running the shipped engine.
//   illustrative      ```text/```json — diagram, config example, or agent
//                     instruction; explanatory content with nothing to run.
const CLASSES = new Set(["command-example", "verified-output", "illustrative"]);

// The companion test the README cites as the verifier of its walkthrough
// blocks; the verified-output class delegates byte-level freshness to it.
const CLAIMS_AUDIT = "tests/unit/readme-claims-audit.test.mjs";

// readme-fence-classification-v1 — the expected inventory, in document order.
// Every fence is pinned by the ## section above it, its info string, its
// class, and a stable marker substring of its body. Adding, removing, or
// reordering a fence, or changing an info string, fails the exact-inventory
// test below until this table is updated — the same drift contract the schema
// reference docs carry in schema-reference-docs.test.mjs.
const EXPECTED_FENCES = [
  { section: "The inversion: static files as targets, not sources", lang: "text", class: "illustrative", marker: ".agentctx/ source files   (one ontology: plain Markdown, git-native, PR-reviewed)" },
  { section: "Try it in 30 seconds", lang: "sh", class: "command-example", marker: "npm run mind-ontology -- init     # scaffold .agentctx/ from the template" },
  { section: "Try it in 30 seconds", lang: "text", class: "verified-output", marker: "WROTE  CLAUDE.md  (claude-md, profile default, 100 payload lines)" },
  { section: "Try it in 30 seconds", lang: "text", class: "verified-output", marker: "content_digest: sha256:9b947e91092255cb55a665d51f9c0cafdc3ec5a1ca75b0e42df8543ff99c859f" },
  { section: "Try it in 30 seconds", lang: "sh", class: "command-example", marker: "npm run mind-ontology -- emit --check" },
  { section: "Try it in 30 seconds", lang: "text", class: "verified-output", marker: "STALE        AGENTS.md (agents-md) - .agentctx/ changed (or emit_version bumped) since last emit; run: mind-ontology emit --target agents-md" },
  { section: "Try it in 30 seconds", lang: "text", class: "verified-output", marker: "OK           AGENTS.md (agents-md, profile default)" },
  { section: "Drift fails CI", lang: "sh", class: "command-example", marker: "npx mind-ontology emit --check    # exit 0 fresh · 1 drift (re-emit) · 2 hard error (fix the ontology)" },
  { section: "The live path: compile per task, not per file", lang: "sh", class: "command-example", marker: "npm run mind-ontology -- compile --task \"Plan the next PR\" --scope mcp" },
  { section: "The live path: compile per task, not per file", lang: "json", class: "illustrative", marker: "{ \"mcpServers\": { \"agentctx\": { \"command\": \"node\", \"args\": [\"scripts/agentctx/mcp-server.mjs\"] } } }" },
  { section: "The live path: compile per task, not per file", lang: "text", class: "illustrative", marker: "At task start, call get_context(task). Before destructive or structural" },
  { section: "The live path: compile per task, not per file", lang: "sh", class: "command-example", marker: "npx mind-ontology agent-setup --target claude-code --print   # or: codex" },
  { section: "The live path: compile per task, not per file", lang: "sh", class: "command-example", marker: "npm run agentctx:metrics  -- --task \"Plan the next PR\"   # how focused is the pack?" },
  { section: "The live path: compile per task, not per file", lang: "sh", class: "command-example", marker: "npm run agentctx:compile -- --task \"Drop the orders table\" --risk auto   # forces #safety context" },
  { section: "Adopt it in one command", lang: "sh", class: "command-example", marker: "npx mind-ontology adopt --write" },
  { section: "Adopt it in one command", lang: "sh", class: "command-example", marker: "npx mind-ontology adopt --targets cursor,paste-block --write" },
  { section: "Three-layer mental model", lang: "text", class: "illustrative", marker: "① route     —  pick which ontology (box) a task belongs to, from a library of many" },
  { section: "Library routing (layer ①)", lang: "json", class: "illustrative", marker: "\"triggers\": [\"checkout\", \"payment\", \"stripe\"]," },
  { section: "Library routing (layer ①)", lang: "sh", class: "command-example", marker: "npm run mind-ontology -- route   --library ./ontologies --task \"debug the checkout flow\"" },
  { section: "Library routing (layer ①)", lang: "sh", class: "command-example", marker: "npm run mind-ontology -- doctor --library ./ontologies" },
  { section: "Library routing (layer ①)", lang: "sh", class: "command-example", marker: "npm run mind-ontology -- scaffold --cwd ./ontologies/my-product" },
  { section: "Scoring signals (opt-in upgrades)", lang: "sh", class: "command-example", marker: "npm run agentctx:compile -- --task \"Fix OAuth bug\" --scope auth --rich-scoring" },
  { section: "Scoring signals (opt-in upgrades)", lang: "sh", class: "command-example", marker: "npm run agentctx:compile -- --task \"What changed recently\" --recency" },
  { section: "Scoring signals (opt-in upgrades)", lang: "markdown", class: "illustrative", marker: "All inter-service calls use async messaging by default…" },
  { section: "Scoring signals (opt-in upgrades)", lang: "sh", class: "command-example", marker: "npm run agentctx:compile -- --task \"Fix the auth bug\" --aliases" },
  { section: "Scoring signals (opt-in upgrades)", lang: "markdown", class: "illustrative", marker: "Implemented as a PKCE flow with short-lived tokens…" },
  { section: "Scoring signals (opt-in upgrades)", lang: "sh", class: "command-example", marker: "npm run agentctx:compile -- --task \"Fix auth\" --aliases --recency --explain" },
  { section: "Token budgets (layer ③)", lang: "sh", class: "command-example", marker: "npm run agentctx:compile -- --task \"Fix the OAuth flow\" --max-tokens 2000" },
  { section: "Token budgets (layer ③)", lang: "sh", class: "command-example", marker: "npm run agentctx:compile -- --task \"Fix the OAuth flow\" --max-tokens 2000 --format compact" },
];

// Every fenced code block in the README with its info string, body, and the
// ## section heading above it. Section tracking is fence-aware: a "## " line
// inside an open fence (none today, but e.g. quoted Markdown) is fence
// content, not a document section. Same parser shape as the guide and
// reference-doc fence audits.
function readmeFences() {
  const fences = [];
  let section = null;
  let open = null;
  for (const line of README.split("\n")) {
    if (open === null && line.startsWith("## ")) section = line.slice(3);
    if (line.startsWith("```")) {
      if (open === null) {
        open = { section, lang: line.slice(3).trim(), lines: [] };
      } else {
        fences.push({ section: open.section, lang: open.lang, body: `${open.lines.join("\n")}\n` });
        open = null;
      }
    } else if (open !== null) {
      open.lines.push(line);
    }
  }
  expect(open, "README.md has an unterminated fence").toBeNull();
  return fences;
}

describe("README fence inventory is pinned (readme-fence-classification-v1)", () => {
  it("the expected inventory is internally sound: known classes, unique markers", () => {
    for (const entry of EXPECTED_FENCES) {
      expect(CLASSES, `inventory uses unknown class "${entry.class}"`).toContain(entry.class);
    }
    const keys = EXPECTED_FENCES.map((entry) => `${entry.section}|${entry.lang}|${entry.marker}`);
    expect(new Set(keys).size, "inventory entries must be distinguishable").toBe(keys.length);
  });

  it("the README has exactly the expected fences, in order — none unclassified", () => {
    const fences = readmeFences();
    expect(
      fences.map((fence) => ({ section: fence.section, lang: fence.lang })),
      "README fence inventory drifted (added/removed/reordered fence, or info string changed); update EXPECTED_FENCES with a class for every fence",
    ).toEqual(EXPECTED_FENCES.map((entry) => ({ section: entry.section, lang: entry.lang })));
    fences.forEach((fence, i) => {
      expect(
        fence.body,
        `fence ${i + 1} under "## ${fence.section}" no longer contains its pinned marker; re-classify it`,
      ).toContain(EXPECTED_FENCES[i].marker);
    });
  });

  it("info strings are deterministic per class: sh commands, text/json otherwise", () => {
    for (const entry of EXPECTED_FENCES) {
      if (entry.class === "command-example") {
        expect(entry.lang, `command-example "${entry.marker}" must be a \`\`\`sh fence`).toBe("sh");
      } else {
        expect(["text", "json", "markdown"], `${entry.class} "${entry.marker}" has executable-looking info string`).toContain(entry.lang);
      }
    }
    for (const entry of EXPECTED_FENCES.filter((e) => e.class === "verified-output")) {
      expect(entry.lang, `verified-output "${entry.marker}" must be a \`\`\`text fence`).toBe("text");
    }
  });
});

describe("README shell fences are command examples, not integration proof", () => {
  it("every line of every sh fence is a command (npm/npx) — never pasted output", () => {
    const fences = readmeFences().filter((fence) => fence.lang === "sh");
    expect(fences.length).toBeGreaterThan(0);
    for (const fence of fences) {
      for (const line of fence.body.split("\n")) {
        if (line.trim() === "") continue;
        expect(
          /^(npm|npx) /.test(line),
          `sh fence under "## ${fence.section}" has a non-command line: ${line}`,
        ).toBe(true);
      }
    }
  });

  it("this audit never executes a fence: no process spawning in this file", () => {
    const self = readFileSync(fileURLToPath(import.meta.url), "utf8");
    expect(self, "fence classification must stay declarative").not.toMatch(
      /from\s+["']node:child_process["']/,
    );
  });
});

describe("README output and illustrative fences delegate or stay inert", () => {
  it("verified-output fences are covered: README cites the claims audit and it exists", () => {
    expect(README, `README no longer cites ${CLAIMS_AUDIT}`).toContain("readme-claims-audit.test.mjs");
    const audit = readFileSync(resolve(REPO_ROOT, CLAIMS_AUDIT), "utf8");
    // The delegate really re-derives output bytes (it runs the engine); if it
    // stops doing so, verified-output is a hollow class and must be re-judged.
    expect(audit, "claims audit no longer executes the shipped engine").toContain("node:child_process");
    expect(audit, "claims audit no longer audits README.md").toContain("README.md");
  });

  it("each verified-output fence sits in the walkthrough the claims audit replays", () => {
    for (const entry of EXPECTED_FENCES.filter((e) => e.class === "verified-output")) {
      expect(
        ["Try it in 30 seconds"],
        `verified-output "${entry.marker}" moved out of the audited walkthrough; extend the claims audit or re-classify`,
      ).toContain(entry.section);
    }
  });

  it("the illustrative json config example stays well-formed", () => {
    const fence = readmeFences().find((f) => f.lang === "json");
    const body = fence.body
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    expect(() => JSON.parse(body), "README .mcp.json example is not valid JSON").not.toThrow();
    expect(JSON.parse(body).mcpServers, ".mcp.json example lost its mcpServers key").toBeTruthy();
  });

  it("no fence in the verified walkthrough is merely illustrative", () => {
    // The README claims "Every command and output block above is the real
    // behavior of the shipped engine"; a fence classified illustrative inside
    // that walkthrough would make the claim false.
    const claim = README.match(/real behavior[\s\S]*?verified against this README/);
    expect(claim, "README dropped its verified-against statement").toBeTruthy();
    for (const entry of EXPECTED_FENCES.filter((e) => e.section === "Try it in 30 seconds")) {
      expect(
        ["command-example", "verified-output"],
        `"${entry.marker}" sits in the verified walkthrough but is classified ${entry.class}`,
      ).toContain(entry.class);
    }
  });
});
