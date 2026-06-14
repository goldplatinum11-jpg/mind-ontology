import { describe, expect, it } from "vitest";
import {
  compileContext,
  parseArgv,
  parseBlockAliases,
  renderContextPackJson,
  scoreBlock,
  tokenize,
} from "../../scripts/agentctx/compile.mjs";

// Lane B — static alias matching. parseBlockAliases reads a block's author-declared
// `Aliases:` line; scoreBlock (opt-in) folds those synonyms into the block's body
// token set so a task/scope term matching a synonym scores as a body hit. No stemming,
// no schema change, and byte-for-byte legacy when the flag is off.

describe("parseBlockAliases (Lane B)", () => {
  it("parses a comma-separated alias line, lowercased and tokenized", () => {
    expect(parseBlockAliases("Aliases: Auth, Authentication, OAuth").sort()).toEqual([
      "auth",
      "authentication",
      "oauth",
    ]);
  });

  it("is case-insensitive on the label and tolerates whitespace", () => {
    expect(parseBlockAliases("  aliases:   sso ,  saml  ").sort()).toEqual(["saml", "sso"]);
  });

  it("returns [] when no Aliases line is present", () => {
    expect(parseBlockAliases("Status: accepted\n\njust body")).toEqual([]);
  });

  it("drops stop-words and sub-3-char tokens like the main tokenizer", () => {
    // "to" is a stop word, "ab" is too short → neither survives tokenize().
    expect(parseBlockAliases("Aliases: to, ab, login")).toEqual(["login"]);
  });
});

describe("--aliases scoring (Lane B)", () => {
  const block = {
    title: "Login flow",
    tags: ["session"],
    body: "Aliases: auth, authentication\n\nHow the login flow works.",
  };
  const tokens = tokenize("authentication");

  it("default (no opts) ignores aliases — byte-for-byte legacy", () => {
    expect(scoreBlock(block, tokens, [])).toBe(scoreBlock(block, tokens, [], { aliases: false }));
  });

  it("a task term matching a declared alias is promoted to a heading-tier hit", () => {
    const plain = scoreBlock(block, tokens, []);
    const aliased = scoreBlock(block, tokens, [], { aliases: true });
    expect(aliased).toBeGreaterThan(plain);
    // The synonym already appears in the body (+1, counted both ways); enabling
    // aliases adds the heading-tier task hit (+4) on top. No inflation beyond that.
    expect(aliased - plain).toBe(4);
  });

  it("a scope term matching a declared alias is promoted to the heading tier", () => {
    const plain = scoreBlock(block, [], ["authentication"]);
    const aliased = scoreBlock(block, [], ["authentication"], { aliases: true });
    // Scope heading hit is +5.
    expect(aliased - plain).toBe(5);
  });

  it("a block with no alias line is unaffected by the flag", () => {
    const noAlias = { title: "Other", tags: [], body: "nothing relevant here" };
    const t = tokenize("authentication");
    expect(scoreBlock(noAlias, t, [], { aliases: true })).toBe(scoreBlock(noAlias, t, []));
  });
});

describe("--aliases selection: auth → authentication (Lane B)", () => {
  const SOURCES = {
    "constraints.md": "# Constraints\n\n## Care #safety\n\nbe careful\n",
    "decisions.md":
      "# Decisions\n\n## Session handling #session\n\n" +
      "Aliases: auth, authentication, oauth\n\n" +
      "We keep the session in a signed cookie.\n",
  };
  const hit = (opts) => {
    const p = JSON.parse(
      renderContextPackJson(compileContext({ sources: SOURCES, task: "auth", scopes: [], ...opts })),
    );
    return p.selected.some((b) => b.title === "Session handling");
  };

  it("without --aliases the task 'auth' does NOT surface the block", () => {
    expect(hit({})).toBe(false);
  });

  it("with --aliases the task 'auth' surfaces the block via its declared synonym", () => {
    expect(hit({ aliases: true })).toBe(true);
  });
});

describe("--aliases byte-for-byte backward compatibility (Lane B)", () => {
  const SOURCES = {
    "constraints.md": "# Constraints\n\n## Care #safety\n\nbe careful\n",
    "decisions.md": "# Decisions\n\n## D #perf\n\nAliases: speed, latency\n\nperf cache redis\n",
  };
  it("aliases:false renders identically to aliases omitted", () => {
    const now = new Date("2026-06-09T00:00:00.000Z");
    const ARGS = { sources: SOURCES, task: "perf", scopes: ["perf"], now };
    expect(renderContextPackJson(compileContext({ ...ARGS }))).toBe(
      renderContextPackJson(compileContext({ ...ARGS, aliases: false })),
    );
  });
});

describe("parseArgv: --recency and --aliases flags", () => {
  it("--recency defaults off and sets true when passed", () => {
    expect(parseArgv(["compile", "--task", "x"]).recency).toBeUndefined();
    expect(parseArgv(["compile", "--task", "x", "--recency"]).recency).toBe(true);
  });

  it("--aliases defaults off and sets true when passed", () => {
    expect(parseArgv(["compile", "--task", "x"]).aliases).toBeUndefined();
    expect(parseArgv(["compile", "--task", "x", "--aliases"]).aliases).toBe(true);
  });

  it("both flags can be combined", () => {
    const p = parseArgv(["compile", "--task", "x", "--recency", "--aliases"]);
    expect(p.recency).toBe(true);
    expect(p.aliases).toBe(true);
  });
});
