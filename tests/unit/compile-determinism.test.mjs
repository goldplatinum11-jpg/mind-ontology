import { describe, expect, it } from "vitest";
import { compileContext, renderContextPackJson, renderContextPack } from "../../scripts/agentctx/compile.mjs";

const SOURCES = {
  "constraints.md": "# Constraints\n\n## Safe #safety\n\nbe careful\n\n## Secrets #secrets\n\nno secrets\n",
  "direction.md": "# Direction\n\n## Perf #perf\n\nmake the booking path fast\n\n## API #api\n\nstabilize the api\n",
  "decisions.md": "# Decisions\n\n## Cache #perf #cache\n\nuse redis\n",
  "glossary.md": "# Glossary\n\n## Ramp #term #rollout\n\nstaged flag exposure\n",
};
const FIXED_NOW = new Date("2026-06-09T00:00:00.000Z");
const ARGS = { sources: SOURCES, task: "speed up the booking path", scopes: ["perf"], now: FIXED_NOW };

// M51 — compilation is deterministic: identical inputs (with an injected clock)
// produce an identical pack. This guards against accidental nondeterminism
// (insertion-order surprises, stray Date/random) leaking into context packs.
describe("compile is deterministic (M51)", () => {
  it("two compiles with the same inputs and clock are byte-identical (JSON)", () => {
    const a = renderContextPackJson(compileContext(ARGS));
    const b = renderContextPackJson(compileContext(ARGS));
    expect(a).toBe(b);
  });

  it("the markdown render is identical too", () => {
    expect(renderContextPack(compileContext(ARGS))).toBe(renderContextPack(compileContext(ARGS)));
  });

  it("generatedAt comes from the injected clock", () => {
    const pack = compileContext(ARGS);
    expect(pack.generatedAt).toBe(FIXED_NOW.toISOString());
  });

  it("changing only the clock changes only generatedAt, not the selection", () => {
    const p1 = compileContext({ ...ARGS, now: new Date("2026-01-01T00:00:00.000Z") });
    const p2 = compileContext({ ...ARGS, now: new Date("2026-12-31T23:59:59.000Z") });
    expect(p1.generatedAt).not.toBe(p2.generatedAt);
    const strip = (p) => p.selected.map((b) => `${b.file}/${b.title}/${b.score}/${b.reason}`);
    expect(strip(p1)).toEqual(strip(p2));
  });

  it("selection order is stable across repeated runs", () => {
    const order = () => compileContext(ARGS).selected.map((b) => `${b.file}/${b.title}`);
    expect(order()).toEqual(order());
  });
});
