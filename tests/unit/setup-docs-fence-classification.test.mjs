import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// All three setup/MCP docs ship in the npm pack (see packaging-dry-run-contract),
// so their fences are public onboarding surface. CRLF-normalized like the README
// and quickstart audits: working-tree EOLs are a git autocrlf artifact, not part
// of the inventory.
const DOCS = [
  "docs/agent-setup.md",
  "docs/agentctx-mcp-setup.md",
  "docs/agentctx-mcp.md",
];
const docText = Object.fromEntries(
  DOCS.map((doc) => [doc, readFileSync(resolve(REPO_ROOT, doc), "utf8").replace(/\r\n/g, "\n")]),
);

// The fence classes the setup/MCP docs may contain. Classification is
// deterministic and test-only — it never executes a fence:
//   command-example   ```sh / ```powershell — commands a reader can run. The
//                     fence is documentation, never an unscoped integration
//                     test; the live MCP behavior is held by the executable
//                     delegates below.
//   config-example    ```json / ```toml — MCP client config a reader pastes.
//                     Validity and canonical-server-entry freshness are
//                     delegated to the fixtures audit (M43), which parses the
//                     non-illustrative json blocks of both MCP docs.
//   illustrative      ```text / ```json — agent instruction, client command
//                     palette entry, or transport request example; explanatory
//                     content with nothing to run.
const CLASSES = new Set(["command-example", "config-example", "illustrative"]);

// Executable delegates the classes above lean on:
//   FIXTURES_AUDIT — parses every non-illustrative json config block in the
//                    two MCP docs and pins the canonical server entry.
//   MCP_PROOF      — spawns the real stdio server the configs launch.
//   SETUP_PROOF    — runs the setup command and pins the printed bootstrap
//                    instruction the agent-setup doc quotes.
const FIXTURES_AUDIT = "tests/unit/mcp-setup-fixtures.test.mjs";
const MCP_PROOF = "tests/unit/mcp-server-smoke.test.mjs";
const SETUP_PROOF = "tests/unit/setup-command.test.mjs";

// setup-docs-fence-classification-v1 — the expected inventory, per doc, in
// document order. Every fence is pinned by the nearest ##/### heading above
// it, its info string, its class, and a stable marker substring of its body.
// Adding, removing, or reordering a fence, or changing an info string, fails
// the exact-inventory test below until this table is updated — the same drift
// contract the README and quickstart docs carry.
const EXPECTED_FENCES = {
  "docs/agent-setup.md": [
    { section: null, lang: "sh", class: "command-example", marker: "mind-ontology setup --target codex --cwd <project> --print" },
    { section: "The bootstrap instruction", lang: "text", class: "illustrative", marker: "Mind Ontology bootstrap — startup / first action:" },
    { section: "Verify", lang: "sh", class: "command-example", marker: "claude mcp list" },
  ],
  "docs/agentctx-mcp-setup.md": [
    { section: "Option A — copy the template (project scope, shared via git)", lang: "sh", class: "command-example", marker: "cp docs/agentctx-setup/claude-code.mcp.json .mcp.json" },
    { section: "Option A — copy the template (project scope, shared via git)", lang: "json", class: "config-example", marker: '"args": ["scripts/agentctx/mcp-server.mjs"]' },
    { section: "Option B — `claude mcp add` (exact command + args)", lang: "sh", class: "command-example", marker: "claude mcp add agentctx --scope project" },
    { section: "Verify (Claude Code)", lang: "sh", class: "command-example", marker: "claude mcp get agentctx" },
    { section: "Verify (Claude Code)", lang: "text", class: "illustrative", marker: "/mcp" },
    { section: "Option A — copy the template (project-local config)", lang: "toml", class: "config-example", marker: "[mcp_servers.agentctx]" },
    { section: "Option B — `codex mcp add` (exact command + args)", lang: "sh", class: "command-example", marker: "codex mcp add agentctx -- node" },
    { section: "Global install variant (`~/.codex/config.toml`)", lang: "toml", class: "config-example", marker: 'AGENTCTX_HOME = "/ABSOLUTE/PATH/TO/mind-ontology"' },
    { section: "Verify (Codex)", lang: "sh", class: "command-example", marker: "codex mcp get agentctx" },
    { section: "Verify the server itself (client-independent)", lang: "sh", class: "command-example", marker: '"method":"tools/list"' },
    { section: "Verify the server itself (client-independent)", lang: "sh", class: "command-example", marker: '"name":"get_context"' },
    { section: "Verify the server itself (client-independent)", lang: "sh", class: "command-example", marker: "cd /tmp && printf" },
    { section: "Verify the server itself (client-independent)", lang: "powershell", class: "command-example", marker: "$env:AGENTCTX_HOME" },
    { section: "Verify the server itself (client-independent)", lang: "sh", class: "command-example", marker: "npm test -- agentctx" },
  ],
  "docs/agentctx-mcp.md": [
    { section: "Quick start", lang: "sh", class: "command-example", marker: "npm run agentctx:mcp" },
    { section: "`get_context`", lang: "json", class: "illustrative", marker: '"scope": "auth,security"' },
    { section: "Claude Code (`.mcp.json`, repo root — project scope)", lang: "json", class: "config-example", marker: '"args": ["scripts/agentctx/mcp-server.mjs"]' },
    { section: "Claude Code (`.mcp.json`, repo root — project scope)", lang: "json", class: "config-example", marker: '"AGENTCTX_HOME": "/absolute/path/to/repo"' },
    { section: "Codex (`.codex/config.toml`, repo root — project scope)", lang: "toml", class: "config-example", marker: "[mcp_servers.agentctx]" },
    { section: "Cursor (`.cursor/mcp.json`)", lang: "json", class: "config-example", marker: '"args": ["scripts/agentctx/mcp-server.mjs"]' },
    { section: "Generic stdio client", lang: "sh", class: "command-example", marker: "node scripts/agentctx/mcp-server.mjs" },
  ],
};

// Every fenced code block in a doc with its info string, body, and the nearest
// ##/### heading above it (the setup docs nest per-client options and verify
// steps under ###, so ##-only tracking would blur them). Section tracking is
// fence-aware: a heading-looking line inside an open fence is fence content,
// not a document section. Same parser shape as the README and quickstart
// fence audits.
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

function expectedOfClass(cls) {
  return DOCS.flatMap((doc) => EXPECTED_FENCES[doc].map((entry) => ({ doc, ...entry }))).filter(
    (entry) => entry.class === cls,
  );
}

describe("setup docs fence inventory is pinned (setup-docs-fence-classification-v1)", () => {
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

  it("info strings are deterministic per class: sh/powershell commands, json/toml config, text/json illustration", () => {
    const ALLOWED = {
      "command-example": ["sh", "powershell"],
      "config-example": ["json", "toml"],
      illustrative: ["text", "json"],
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
});

describe("setup docs shell fences are command examples, not integration proof", () => {
  // The command vocabulary of these docs: the shipped CLI, the two MCP
  // clients, and the POSIX/Node verbs the verify sections use. A line that
  // starts with anything else is pasted output and must be re-classified.
  const COMMAND = /^(npm|npx|node|mind-ontology|claude|codex|cp|printf|cd) /;

  it("every sh fence holds commands (full-line comments and \\-continuations allowed) — never pasted output", () => {
    for (const doc of DOCS) {
      const fences = docFences(doc).filter((fence) => fence.lang === "sh");
      expect(fences.length).toBeGreaterThan(0);
      for (const fence of fences) {
        let continued = false;
        for (const line of fence.body.split("\n")) {
          if (line.trim() === "" || line.startsWith("# ")) {
            continued = false;
            continue;
          }
          expect(
            continued || COMMAND.test(line),
            `sh fence under "${fence.section}" in ${doc} has a non-command line: ${line}`,
          ).toBe(true);
          continued = line.endsWith("\\");
        }
      }
    }
  });

  it("the one powershell fence pins AGENTCTX_HOME and pipes JSON-RPC into the real server entry", () => {
    const fences = DOCS.flatMap((doc) => docFences(doc).filter((fence) => fence.lang === "powershell"));
    expect(fences, "the AGENTCTX_HOME pinning section carries exactly one powershell variant").toHaveLength(1);
    const body = fences[0].body;
    expect(body, "powershell variant no longer pins the env var").toMatch(/^\$env:AGENTCTX_HOME = /m);
    expect(body, "powershell variant no longer pipes a JSON-RPC request").toMatch(/'\{"jsonrpc":"2\.0"/);
    expect(body, "powershell variant no longer launches the server entry").toContain("mcp-server.mjs");
    let continued = false;
    for (const line of body.split("\n")) {
      if (line.trim() === "" || line.startsWith("# ")) {
        continued = false;
        continue;
      }
      expect(
        continued || /^(\$env:[A-Z_]+ = |'\{")/.test(line),
        `powershell fence has a non-command line: ${line}`,
      ).toBe(true);
      continued = line.endsWith("|") || line.endsWith("`");
    }
  });

  it("this audit never executes a fence: no process spawning in this file", () => {
    const self = readFileSync(fileURLToPath(import.meta.url), "utf8");
    expect(self, "fence classification must stay declarative").not.toMatch(
      /from\s+["']node:child_process["']/,
    );
  });
});

describe("setup docs config fences are well-formed and delegated to executable proof", () => {
  it("every json config-example parses and launches the canonical server entry via node", () => {
    const entries = expectedOfClass("config-example").filter((entry) => entry.lang === "json");
    expect(entries.length).toBeGreaterThanOrEqual(4);
    for (const entry of entries) {
      const fence = docFences(entry.doc).find(
        (f) => f.lang === "json" && f.section === entry.section && f.body.includes(entry.marker),
      );
      let cfg;
      expect(() => { cfg = JSON.parse(fence.body); }, `config-example under "${entry.section}" in ${entry.doc} is not valid JSON`).not.toThrow();
      const server = cfg.mcpServers?.agentctx;
      expect(server, `config-example under "${entry.section}" in ${entry.doc} lost its agentctx server`).toBeTruthy();
      expect(server.command, `${entry.doc} "${entry.section}": MCP launcher must be node`).toBe("node");
      expect(
        server.args.some((a) => a.includes("scripts/agentctx/mcp-server.mjs")),
        `${entry.doc} "${entry.section}": config no longer launches the canonical server entry`,
      ).toBe(true);
    }
  });

  it("every toml config-example declares the agentctx server table launching the entry via node", () => {
    const entries = expectedOfClass("config-example").filter((entry) => entry.lang === "toml");
    expect(entries.length).toBeGreaterThanOrEqual(3);
    for (const entry of entries) {
      const fence = docFences(entry.doc).find(
        (f) => f.lang === "toml" && f.section === entry.section && f.body.includes(entry.marker),
      );
      expect(fence.body, `${entry.doc} "${entry.section}": toml config lost its server table`).toContain("[mcp_servers.agentctx]");
      expect(fence.body, `${entry.doc} "${entry.section}": toml launcher must be node`).toMatch(/command\s*=\s*"node"/);
      expect(fence.body, `${entry.doc} "${entry.section}": toml config no longer launches the server entry`).toContain("mcp-server.mjs");
    }
  });

  it("config freshness is covered: the fixtures audit parses both MCP docs' json blocks", () => {
    const audit = readFileSync(resolve(REPO_ROOT, FIXTURES_AUDIT), "utf8");
    expect(audit, "fixtures audit no longer covers docs/agentctx-mcp.md").toContain('"docs/agentctx-mcp.md"');
    expect(audit, "fixtures audit no longer covers docs/agentctx-mcp-setup.md").toContain('"docs/agentctx-mcp-setup.md"');
    expect(audit, "fixtures audit no longer pins the server entry").toContain("mcp-server.mjs");
  });

  it("the configured entry really speaks MCP: the smoke proof spawns the real server", () => {
    const proof = readFileSync(resolve(REPO_ROOT, MCP_PROOF), "utf8");
    expect(proof, "MCP proof no longer spawns the real server").toContain("node:child_process");
    expect(proof, "MCP proof no longer drives the stdio server").toContain("mcp-server.mjs");
  });
});

describe("setup docs illustrative fences stay inert / delegated", () => {
  it("the get_context request example is a well-formed JSON-RPC tools/call", () => {
    const fence = docFences("docs/agentctx-mcp.md").find(
      (f) => f.section === "`get_context`" && f.lang === "json",
    );
    let req;
    expect(() => { req = JSON.parse(fence.body); }, "get_context request example is not valid JSON").not.toThrow();
    expect(req.jsonrpc, "request example is not JSON-RPC 2.0").toBe("2.0");
    expect(req.method, "request example is not a tools/call").toBe("tools/call");
    expect(req.params.name, "request example no longer calls get_context").toBe("get_context");
  });

  it("the bootstrap instruction fence names the two-tool contract and is pinned by the setup proof", () => {
    const fence = docFences("docs/agent-setup.md").find((f) => f.lang === "text");
    expect(fence.body, "bootstrap instruction dropped get_context").toContain("get_context");
    expect(fence.body, "bootstrap instruction dropped list_constraints").toContain("list_constraints");
    expect(fence.body, "bootstrap instruction dropped the fail-closed fallback").toContain("mind-ontology init");
    // The doc cites the executable proof; the proof really pins the printed
    // instruction. If either link breaks, this fence is unverified prose and
    // must be re-judged.
    expect(docText["docs/agent-setup.md"], `doc no longer cites ${SETUP_PROOF}`).toContain("setup-command.test.mjs");
    const proof = readFileSync(resolve(REPO_ROOT, SETUP_PROOF), "utf8");
    expect(proof, "setup proof no longer pins the bootstrap instruction").toContain("Mind Ontology bootstrap");
  });

  it("the /mcp fence is the bare client command-palette entry, nothing more", () => {
    const fence = docFences("docs/agentctx-mcp-setup.md").find((f) => f.lang === "text");
    expect(fence.body.trim(), "the Claude Code verify step grew beyond /mcp; re-classify it").toBe("/mcp");
  });
});
