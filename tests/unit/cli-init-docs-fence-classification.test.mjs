import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// Both CLI/init docs ship in the npm pack (see packaging-dry-run-contract),
// so their fences are public operator surface. CRLF-normalized like the
// README, quickstart, and setup/MCP audits: working-tree EOLs are a git
// autocrlf artifact, not part of the inventory.
const DOCS = ["docs/cli-errors.md", "docs/init-from-repo.md"];
const docText = Object.fromEntries(
  DOCS.map((doc) => [doc, readFileSync(resolve(REPO_ROOT, doc), "utf8").replace(/\r\n/g, "\n")]),
);

// The fence classes the CLI/init docs may contain. Classification is
// deterministic and test-only — it never executes a fence:
//   output-example   ```text — a pasted report shape illustrating what an
//                    operator sees. The fence is explanatory; the real
//                    message bytes are held by the executable delegates
//                    below, never re-derived from here.
//   usage-synopsis   ```text — command grammar with [optional] brackets and
//                    <placeholders>; notation to read, not a line to run.
//                    The named flags are exercised by the executable
//                    delegate below.
// Neither doc carries a runnable shell fence today; if one appears it must
// enter the inventory as a command example (sh-tagged, command lines only,
// per the README/quickstart/setup audits) — never as an unscoped
// integration test run from this file.
const CLASSES = new Set(["output-example", "usage-synopsis"]);

// Executable delegates the classes above lean on:
//   CATALOG_PROOF       — drives the real `mind-ontology` wrapper end-to-end
//                         and pins the validate report shape (issue lines,
//                         fix: continuations, INVALID summary, authoring-doc
//                         pointer).
//   VALIDATE_PROOF      — unit-tests the validator and pins the rule ids the
//                         report example cites.
//   INIT_FROM_REPO_PROOF — exercises `init --from-repo` including the flag
//                          parsing the synopsis documents.
const CATALOG_PROOF = "tests/unit/cli-error-ux-catalog.test.mjs";
const VALIDATE_PROOF = "tests/unit/agentctx-validate.test.mjs";
const INIT_FROM_REPO_PROOF = "tests/unit/init-from-repo.test.mjs";

// cli-init-docs-fence-classification-v1 — the expected inventory, per doc, in
// document order. Every fence is pinned by the nearest ##/### heading above
// it, its info string, its class, and a stable marker substring of its body.
// Adding, removing, or reordering a fence, or changing an info string, fails
// the exact-inventory test below until this table is updated — the same drift
// contract the README, quickstart, and setup/MCP docs carry.
const EXPECTED_FENCES = {
  "docs/cli-errors.md": [
    {
      section: "`agentctx:validate`",
      lang: "text",
      class: "output-example",
      marker: "INVALID — 2 error(s), 0 warning(s)",
    },
  ],
  "docs/init-from-repo.md": [
    {
      section: null,
      lang: "text",
      class: "usage-synopsis",
      marker: "mind-ontology init --from-repo [--cwd <path>] [--force]",
    },
  ],
};

// Every fenced code block in a doc with its info string, body, and the
// nearest ##/### heading above it. Section tracking is fence-aware: a
// heading-looking line inside an open fence (the report example carries an
// indented "## <title> #style" remedy) is fence content, not a document
// section. Same parser shape as the README, quickstart, and setup/MCP fence
// audits.
function docFences(doc) {
  const fences = [];
  let section = null;
  let open = null;
  for (const line of docText[doc].split("\n")) {
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
  expect(open, `${doc} has an unterminated fence`).toBeNull();
  return fences;
}

describe("CLI/init docs fence inventory is pinned (cli-init-docs-fence-classification-v1)", () => {
  it("the expected inventory is internally sound: known classes, unique markers", () => {
    const keys = [];
    for (const doc of DOCS) {
      for (const entry of EXPECTED_FENCES[doc]) {
        expect(CLASSES, `inventory uses unknown class "${entry.class}"`).toContain(entry.class);
        keys.push(`${doc}|${entry.section}|${entry.lang}|${entry.marker}`);
      }
    }
    expect(new Set(keys).size, "inventory entries must be distinguishable").toBe(keys.length);
  });

  for (const doc of DOCS) {
    it(`${doc} has exactly the expected fences, in order — none unclassified`, () => {
      const fences = docFences(doc);
      expect(
        fences.map((fence) => ({ section: fence.section, lang: fence.lang })),
        `${doc} fence inventory drifted (added/removed/reordered fence, or info string changed); update EXPECTED_FENCES with a class for every fence`,
      ).toEqual(EXPECTED_FENCES[doc].map((entry) => ({ section: entry.section, lang: entry.lang })));
      fences.forEach((fence, i) => {
        expect(
          fence.body,
          `${doc} fence ${i + 1} under "${fence.section}" no longer contains its pinned marker; re-classify it`,
        ).toContain(EXPECTED_FENCES[doc][i].marker);
      });
    });
  }

  it("info strings are deterministic per class: every fence in these docs is inert text", () => {
    const ALLOWED = {
      "output-example": ["text"],
      "usage-synopsis": ["text"],
    };
    for (const doc of DOCS) {
      for (const entry of EXPECTED_FENCES[doc]) {
        expect(
          ALLOWED[entry.class],
          `${entry.class} "${entry.marker}" in ${doc} has an out-of-class info string`,
        ).toContain(entry.lang);
      }
    }
  });

  it("no fence is bare: every fence carries an info string, so its class is mechanical", () => {
    for (const doc of DOCS) {
      for (const fence of docFences(doc)) {
        expect(
          fence.lang,
          `fence under "${fence.section}" in ${doc} lost its info string; label it so classification stays deterministic`,
        ).not.toBe("");
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

describe("the validate report example is an output illustration, delegated to executable proof", () => {
  const fence = () =>
    docFences("docs/cli-errors.md").find((f) => f.section === "`agentctx:validate`");

  it("every line follows the documented report grammar: issue, fix:, summary, pointer", () => {
    const lines = fence().body.split("\n").filter((line) => line !== "");
    const GRAMMAR = [
      /^ {2}ERROR {2}\[[a-z-]+\] \S/, // issue line, severity + [rule-id] + message
      /^ {9}fix: \S/, // indented continuation naming the next action
      /^INVALID — \d+ error\(s\), \d+ warning\(s\)$/, // machine-signal summary
      /^See docs\/schema-authoring\.md /, // pointer to the authoring doc
    ];
    for (const line of lines) {
      expect(
        GRAMMAR.some((rule) => rule.test(line)),
        `report example line breaks the documented grammar: "${line}"`,
      ).toBe(true);
    }
    const errors = lines.filter((line) => /^ {2}ERROR /.test(line));
    expect(errors.length, "report example lost its issue lines").toBeGreaterThanOrEqual(2);
    expect(errors.length, "every issue line needs its fix: continuation").toBe(
      lines.filter((line) => /^ {9}fix: /.test(line)).length,
    );
    expect(
      fence().body,
      "report example summary no longer counts its own issue lines",
    ).toContain(`INVALID — ${errors.length} error(s), 0 warning(s)`);
  });

  it("the rule ids the example cites are real validator rules pinned by unit proof", () => {
    const cited = [...fence().body.matchAll(/\[([a-z-]+)\]/g)].map((m) => m[1]);
    expect(cited, "report example stopped citing concrete rules").not.toHaveLength(0);
    const proof = readFileSync(resolve(REPO_ROOT, VALIDATE_PROOF), "utf8");
    for (const rule of cited) {
      expect(proof, `validate proof no longer covers cited rule "${rule}"`).toContain(`"${rule}"`);
    }
  });

  it("the report shape is held end-to-end by the error-UX catalog, not by this example", () => {
    const proof = readFileSync(resolve(REPO_ROOT, CATALOG_PROOF), "utf8");
    expect(proof, "catalog proof no longer pins the fix: continuation shape").toContain("fix:");
    expect(proof, "catalog proof no longer pins the INVALID summary").toContain("INVALID");
    expect(proof, "catalog proof no longer pins the authoring-doc pointer").toMatch(
      /schema-authoring\\?\.md/,
    );
    // The doc cites both error-UX test files as the keepers of these messages;
    // if the citation goes, the example is unverified prose and must be
    // re-judged.
    expect(
      docText["docs/cli-errors.md"],
      `docs/cli-errors.md no longer cites ${CATALOG_PROOF}`,
    ).toContain("cli-error-ux-catalog.test.mjs");
  });
});

describe("the init --from-repo synopsis is grammar to read, delegated to executable proof", () => {
  const fence = () => docFences("docs/init-from-repo.md")[0];

  it("the synopsis is a single line of command grammar, not a runnable paste", () => {
    const lines = fence().body.split("\n").filter((line) => line !== "");
    expect(lines, "the synopsis fence grew beyond its one grammar line; re-classify it").toHaveLength(1);
    expect(lines[0]).toBe("mind-ontology init --from-repo [--cwd <path>] [--force]");
  });

  it("every flag the synopsis names is documented in prose and parsed by the proof", () => {
    const flags = [...fence().body.matchAll(/--[a-z-]+/g)].map((m) => m[0]);
    expect(flags, "synopsis lost its flags").toEqual(["--from-repo", "--cwd", "--force"]);
    const prose = docText["docs/init-from-repo.md"].split("```")[2];
    const proof = readFileSync(resolve(REPO_ROOT, INIT_FROM_REPO_PROOF), "utf8");
    for (const flag of flags) {
      expect(prose, `the doc body no longer explains ${flag}`).toContain(`\`${flag}\``);
      expect(proof, `init --from-repo proof no longer exercises ${flag}`).toContain(`"${flag}"`);
    }
    expect(proof, "proof no longer parses the init argv").toContain("parseInitArgv");
  });
});
