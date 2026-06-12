import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// docs/testing.md ships in the npm pack (see packaging-dry-run-contract), so
// it is public operator surface like the README, quickstart, setup/MCP, and
// CLI/init docs — the other docs with fence-classification audits.
// CRLF-normalized like those audits: working-tree EOLs are a git autocrlf
// artifact, not part of the inventory.
const DOC = "docs/testing.md";
const docText = readFileSync(resolve(REPO_ROOT, DOC), "utf8").replace(/\r\n/g, "\n");

// The fence classes a fence in this doc would have to take. Classification is
// deterministic and test-only — this audit never executes a fence:
//   command-example  ```sh — command lines an operator pastes; examples, not
//                    unscoped integration tests run from this file.
//   output-example   ```text — pasted report/transcript shape; illustrative,
//                    with the real bytes held by executable proof.
//   config-example   ```json — illustrative config/instruction snippet unless
//                    already covered by executable proof.
// Today the doc carries ZERO fences: every command it cites is an inline code
// span in the gates table, and every claim is prose delegated to real tests
// (gate scripts: package-metadata.test.mjs M32; cited test files:
// doc-link-audit.test.mjs M61). The classes above exist so that the moment a
// fence appears, it must enter EXPECTED_FENCES under a known class with a
// pinned section, info string, and marker — the same drift contract the
// sibling audits carry.
const CLASSES = new Set(["command-example", "output-example", "config-example"]);
const ALLOWED = {
  "command-example": ["sh"],
  "output-example": ["text"],
  "config-example": ["json"],
};

// testing-doc-fence-classification-v1 — the expected inventory, in document
// order. Empty is the pinned state, not an omission: adding any fence to the
// doc fails the exact-inventory test below until the fence is classified here
// by its nearest ##/### section, info string, class, and a stable unique
// marker substring of its body.
const EXPECTED_FENCES = [];

// The section namespace a new fence would be classified under. Pinning the
// heading skeleton keeps "section" assignments deterministic: a renamed or
// reordered heading is surfaced here instead of silently re-homing a future
// fence entry.
const SECTIONS = [
  "The four gates (smallest → fullest)",
  "Test categories",
  "The CQ regression contract",
  "The setup-fixture contract",
  "Conventions",
];

// Every fenced code block with its info string, body, and the nearest ##/###
// heading above it. Section tracking is fence-aware (a heading-looking line
// inside an open fence is fence content, not a document section). Same parser
// shape as the README, quickstart, setup/MCP, and CLI/init fence audits.
function docFences() {
  const fences = [];
  let section = null;
  let open = null;
  for (const line of docText.split("\n")) {
    const heading = open === null && /^(##|###) /.exec(line);
    if (heading) section = line.slice(heading[1].length + 1);
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
  expect(open, `${DOC} has an unterminated fence`).toBeNull();
  return fences;
}

describe("testing doc fence inventory is pinned (testing-doc-fence-classification-v1)", () => {
  it("the expected inventory is internally sound: known classes, in-class info strings, unique markers", () => {
    const keys = [];
    for (const entry of EXPECTED_FENCES) {
      expect(CLASSES, `inventory uses unknown class "${entry.class}"`).toContain(entry.class);
      expect(
        ALLOWED[entry.class],
        `${entry.class} "${entry.marker}" has an out-of-class info string`,
      ).toContain(entry.lang);
      keys.push(`${entry.section}|${entry.lang}|${entry.marker}`);
    }
    expect(new Set(keys).size, "inventory entries must be distinguishable").toBe(keys.length);
  });

  it(`${DOC} has exactly the expected fences, in order — today none, and none unclassified`, () => {
    const fences = docFences();
    expect(
      fences.map((fence) => ({ section: fence.section, lang: fence.lang })),
      `${DOC} fence inventory drifted (a fence was added, removed, reordered, or relabeled); update EXPECTED_FENCES with a class for every fence`,
    ).toEqual(EXPECTED_FENCES.map((entry) => ({ section: entry.section, lang: entry.lang })));
    fences.forEach((fence, i) => {
      expect(
        fence.body,
        `${DOC} fence ${i + 1} under "${fence.section}" no longer contains its pinned marker; re-classify it`,
      ).toContain(EXPECTED_FENCES[i].marker);
    });
  });

  it("no line opens a fence at all — backtick or tilde — so nothing can hide from the parser", () => {
    // The parser above only walks ``` fences (like the sibling audits). With a
    // zero-fence inventory that leaves a gap: a ~~~ fence, or a lone
    // unterminated ``` line, must not slip in unclassified. Fail closed on the
    // marker itself.
    docText.split("\n").forEach((line, i) => {
      expect(
        /^(```|~~~)/.test(line),
        `${DOC}:${i + 1} opens a fenced block ("${line.trim()}"); classify it in EXPECTED_FENCES`,
      ).toBe(false);
    });
  });

  it("the section skeleton is pinned, so a future fence's section assignment is deterministic", () => {
    const headings = docText
      .split("\n")
      .filter((line) => /^(##|###) /.test(line))
      .map((line) => line.replace(/^#+ /, ""));
    expect(
      headings,
      `${DOC} headings drifted; update SECTIONS so fence classification keeps a stable namespace`,
    ).toEqual(SECTIONS);
  });

  it("the doc's runnable surface stays inline and delegated, never a fenced shell block", () => {
    // The four gates are the doc's only commands. They appear as inline code
    // spans in the gates table — command *citations*, not pasteable scripts —
    // and each is held by executable proof elsewhere (the scripts exist per
    // package-metadata.test.mjs M32; npm test runs the suite itself). If a
    // gate stops being cited inline, either the table changed shape (possibly
    // into a fenced block, which the inventory test catches) or a gate was
    // dropped; both need a deliberate re-classification.
    for (const gate of [
      "`npm run agentctx:proof`",
      "`npm run agentctx:validate`",
      "`npm run agentctx:smoke`",
      "`npm test`",
    ]) {
      expect(docText, `${DOC} no longer cites ${gate} as an inline code span`).toContain(gate);
    }
  });

  it("this audit never executes a fence: no process spawning in this file", () => {
    const self = readFileSync(fileURLToPath(import.meta.url), "utf8");
    expect(self, "fence classification must stay declarative").not.toMatch(
      /from\s+["']node:child_process["']/,
    );
  });
});
