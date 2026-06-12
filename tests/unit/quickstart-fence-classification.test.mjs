import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// Both quickstart docs ship in the npm pack (see packaging-dry-run-contract),
// so their fences are public surface. CRLF-normalized like the README audit:
// working-tree EOLs are a git autocrlf artifact, not part of the inventory.
const DOCS = [
  "docs/mind-ontology-quickstart.md",
  "docs/mind-ontology-quickstart-examples-v0.md",
];
const docText = Object.fromEntries(
  DOCS.map((doc) => [doc, readFileSync(resolve(REPO_ROOT, doc), "utf8").replace(/\r\n/g, "\n")]),
);

// The fence classes the quickstart docs may contain. Classification is
// deterministic and test-only — it never executes a fence:
//   command-example   ```sh — commands a reader can run. The fence is
//                     documentation, never an unscoped integration test;
//                     the documented *outcomes* are held by the executable
//                     delegates below.
//   illustrative      ```text/```json/```jsonc — diagram, expected-shape,
//                     config, agent instruction, or transport transcript;
//                     explanatory content with nothing to run.
const CLASSES = new Set(["command-example", "illustrative"]);

// The executable proofs the examples doc cites. The doc's outcome bullets are
// asserted by these tests against the real engine, so the doc's illustrative
// fences delegate freshness to them instead of being run from the audit.
const EXAMPLES_PROOF = "tests/unit/agentctx-quickstart-examples.test.mjs";
const MCP_PROOF = "tests/unit/mcp-server-smoke.test.mjs";

// quickstart-fence-classification-v1 — the expected inventory, per doc, in
// document order. Every fence is pinned by the nearest ##/### heading above
// it, its info string, its class, and a stable marker substring of its body.
// Adding, removing, or reordering a fence, or changing an info string, fails
// the exact-inventory test below until this table is updated — the same drift
// contract README.md carries in readme-fence-classification.test.mjs.
const EXPECTED_FENCES = {
  "docs/mind-ontology-quickstart.md": [
    { section: "What you will run", lang: "text", class: "illustrative", marker: ".agentctx/ Markdown files" },
    { section: "Step 1 - Install dependencies", lang: "sh", class: "command-example", marker: "npm install" },
    { section: "Step 2 - Confirm source files exist", lang: "text", class: "illustrative", marker: "constraints.md   # ALWAYS included" },
    { section: "Step 2 - Confirm source files exist", lang: "sh", class: "command-example", marker: 'agentctx:init -- --cwd "C:/path/to/my-project"' },
    { section: "Step 2 - Confirm source files exist", lang: "sh", class: "command-example", marker: "--from-repo" },
    { section: "Step 3 - Compile a context pack", lang: "sh", class: "command-example", marker: '--scope "mind-ontology,mcp,quickstart"' },
    { section: "Step 3 - Compile a context pack", lang: "sh", class: "command-example", marker: "--format json" },
    { section: "Step 3 - Compile a context pack", lang: "json", class: "illustrative", marker: '"omittedCount"' },
    { section: "Optional - One-command acceptance smoke", lang: "sh", class: "command-example", marker: "agentctx:smoke" },
    { section: "Optional - Measure how focused the pack is", lang: "sh", class: "command-example", marker: "agentctx:metrics" },
    { section: "Step 4 - Start the MCP server", lang: "sh", class: "command-example", marker: "agentctx:mcp" },
    { section: "Step 4 - Start the MCP server", lang: "text", class: "illustrative", marker: "get_context(task: string, scope?: string)" },
    { section: "Step 5 - Add the client instruction", lang: "text", class: "illustrative", marker: "At task start, call get_context(task)" },
    { section: "Step 6 - Smoke a real task", lang: "text", class: "illustrative", marker: "plan the next OSS MCP foundation PR." },
    { section: "Step 6 - Smoke a real task", lang: "text", class: "illustrative", marker: 'scope="mind-ontology,oss,mcp"' },
    { section: "The compiler cannot find `.agentctx/`", lang: "sh", class: "command-example", marker: '--task "Test context"' },
    { section: "The compiler cannot find `.agentctx/`", lang: "sh", class: "command-example", marker: 'agentctx:init -- --cwd "C:/path/to/repo"' },
    { section: "The pack is too broad", lang: "sh", class: "command-example", marker: '"license,oss,boundary"' },
    { section: "The MCP client sees too many tools", lang: "text", class: "illustrative", marker: "list_constraints" },
  ],
  "docs/mind-ontology-quickstart-examples-v0.md": [
    { section: null, lang: "sh", class: "command-example", marker: "agentctx:init -- --cwd ./demo" },
    { section: "Example 1 — A focused task", lang: "sh", class: "command-example", marker: "--scope review --format json" },
    { section: "Example 2 — How focused is the pack?", lang: "sh", class: "command-example", marker: "agentctx:metrics -- --cwd ./demo" },
    { section: "Example 3 — A risky task forces safety context", lang: "sh", class: "command-example", marker: "Delete the production database" },
    { section: "Example 4 — A task that matches nothing still gets constraints", lang: "sh", class: "command-example", marker: "zzzz unrelated gibberish" },
    { section: "Example 5 — Validate the ontology", lang: "sh", class: "command-example", marker: "agentctx:validate" },
    { section: "Example 6 — End-to-end over the MCP transport", lang: "sh", class: "command-example", marker: "agentctx:mcp" },
    { section: "Example 6 — End-to-end over the MCP transport", lang: "jsonc", class: "illustrative", marker: '"name":"get_context"' },
    { section: "One-command check", lang: "sh", class: "command-example", marker: "agentctx:smoke" },
  ],
};

// Every fenced code block in a doc with its info string, body, and the
// nearest ##/### heading above it (the quickstart nests optional steps and
// troubleshooting cases under ###, so ##-only tracking would blur them).
// Section tracking is fence-aware: a heading-looking line inside an open
// fence is fence content, not a document section. Same parser shape as the
// README and schema-reference fence audits.
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

describe("quickstart fence inventory is pinned (quickstart-fence-classification-v1)", () => {
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

  it("info strings are deterministic per class: sh commands, text/json/jsonc otherwise", () => {
    for (const doc of DOCS) {
      for (const entry of EXPECTED_FENCES[doc]) {
        if (entry.class === "command-example") {
          expect(entry.lang, `command-example "${entry.marker}" must be a \`\`\`sh fence`).toBe("sh");
        } else {
          expect(
            ["text", "json", "jsonc"],
            `${entry.class} "${entry.marker}" has executable-looking info string`,
          ).toContain(entry.lang);
        }
      }
    }
  });
});

describe("quickstart shell fences are command examples, not integration proof", () => {
  it("every sh fence holds npm/npx commands (with \\-continuations) — never pasted output", () => {
    for (const doc of DOCS) {
      const fences = docFences(doc).filter((fence) => fence.lang === "sh");
      expect(fences.length).toBeGreaterThan(0);
      for (const fence of fences) {
        let continued = false;
        for (const line of fence.body.split("\n")) {
          if (line.trim() === "") {
            continued = false;
            continue;
          }
          expect(
            continued || /^(npm|npx) /.test(line),
            `sh fence under "${fence.section}" in ${doc} has a non-command line: ${line}`,
          ).toBe(true);
          continued = line.endsWith("\\");
        }
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

describe("quickstart illustrative fences stay inert and well-formed", () => {
  it("the expected-JSON-shape example in the quickstart parses as JSON", () => {
    const fence = docFences("docs/mind-ontology-quickstart.md").find((f) => f.lang === "json");
    expect(() => JSON.parse(fence.body), "expected JSON shape example is not valid JSON").not.toThrow();
    expect(JSON.parse(fence.body), "JSON shape example lost its pack keys").toHaveProperty("omittedCount");
  });

  it("the jsonc MCP transcript is one well-formed JSON-RPC object per line", () => {
    const fence = docFences("docs/mind-ontology-quickstart-examples-v0.md").find((f) => f.lang === "jsonc");
    const requests = fence.body
      .split("\n")
      .filter((line) => line.trim() !== "" && !line.trim().startsWith("//"))
      .map((line) => JSON.parse(line));
    expect(requests.length, "MCP transcript lost its request lines").toBeGreaterThanOrEqual(4);
    for (const req of requests) expect(req.jsonrpc, "transcript line is not JSON-RPC 2.0").toBe("2.0");
    const tools = requests.filter((r) => r.method === "tools/call").map((r) => r.params.name);
    expect(tools, "transcript no longer calls the two thin tools").toEqual(["get_context", "list_constraints"]);
  });

  it("documented outcomes are covered: the examples doc cites real executable proof", () => {
    const examples = docText["docs/mind-ontology-quickstart-examples-v0.md"];
    expect(examples, `examples doc no longer cites ${EXAMPLES_PROOF}`).toContain("agentctx-quickstart-examples.test.mjs");
    expect(examples, `examples doc no longer cites ${MCP_PROOF}`).toContain("mcp-server-smoke.test.mjs");
    // The delegates really exercise the shipped tooling; if they stop doing
    // so, the docs' "cannot drift from the code" claim is hollow and the
    // illustrative class must be re-judged.
    const examplesProof = readFileSync(resolve(REPO_ROOT, EXAMPLES_PROOF), "utf8");
    expect(examplesProof, "examples proof no longer runs the compiler").toContain("compileFromCwd");
    expect(examplesProof, "examples proof no longer scaffolds the template").toContain("initAgentctx");
    const mcpProof = readFileSync(resolve(REPO_ROOT, MCP_PROOF), "utf8");
    expect(mcpProof, "MCP proof no longer spawns the real server").toContain("node:child_process");
    expect(mcpProof, "MCP proof no longer drives the stdio server").toContain("mcp-server.mjs");
  });
});
