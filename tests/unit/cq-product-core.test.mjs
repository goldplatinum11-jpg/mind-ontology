import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseMarkdownBlocks } from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CQ_PATH = resolve(REPO_ROOT, "templates/mind-ontology/.agentctx/cq.md");

function cqBlocks() {
  return parseMarkdownBlocks(readFileSync(CQ_PATH, "utf8"), "cq.md").filter((b) =>
    b.tags.includes("cq"),
  );
}

// M6 — CQs are the verification core: they must answer concrete agent questions,
// not abstract ones. Each entry: a topic tag the template must carry, and a
// substring proving the CQ targets the concrete thing an agent needs before acting.
const CONCRETE_CQ_EXPECTATIONS = [
  { tag: "scope", needle: "allowed to write" }, // which files may I write?
  { tag: "direction", needle: "current direction" }, // what direction does this serve?
  { tag: "safety", needle: "forbidden" }, // forbidden writes / fail closed
];

describe("CQ product core answers concrete agent questions (M6)", () => {
  it("carries the concrete topic tags an agent needs before acting", () => {
    const tags = new Set(cqBlocks().flatMap((b) => b.tags));
    for (const { tag } of CONCRETE_CQ_EXPECTATIONS) {
      expect(tags.has(tag), `CQ template missing concrete topic #${tag}`).toBe(true);
    }
  });

  it("phrases the concrete questions in CQ bodies/titles, not just abstractly", () => {
    const haystack = cqBlocks()
      .map((b) => `${b.title} ${b.body}`.toLowerCase())
      .join("\n");
    for (const { needle } of CONCRETE_CQ_EXPECTATIONS) {
      expect(haystack, `no CQ addresses "${needle}"`).toContain(needle.toLowerCase());
    }
  });

  it("ties the fail-closed write question to the forbidden-write boundary", () => {
    const failClosed = cqBlocks().find((b) => b.title.toLowerCase().includes("fail closed"));
    expect(failClosed, "missing a 'fail closed' competency question").toBeTruthy();
    const body = failClosed.body.toLowerCase();
    // Must enumerate concrete forbidden writes, not hand-wave.
    expect(["deploy", "migration", "secrets", "production"].some((w) => body.includes(w))).toBe(true);
  });
});
