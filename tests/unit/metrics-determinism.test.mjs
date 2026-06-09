import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileContext } from "../../scripts/agentctx/compile.mjs";
import { computeContextMetrics, metricsFromCwd } from "../../scripts/agentctx/metrics.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const EXAMPLE = resolve(REPO_ROOT, "docs/examples/team-ontology");

const SOURCES = {
  "constraints.md": "# Constraints\n\n## Safe #safety\n\nbe careful\n",
  "direction.md": "# Direction\n\n## Perf #perf\n\nmake it fast\n\n## API #api\n\nstabilize\n",
};

// M53 — metrics are a deterministic, pure function of their inputs. The same
// workspace + task + scope always yields the same numbers, so metrics can be
// compared across runs/CI without flakiness.
describe("context metrics are deterministic (M53)", () => {
  it("computeContextMetrics is a pure function of the pack", () => {
    const pack = compileContext({ sources: SOURCES, task: "speed it up", scopes: ["perf"], now: new Date("2026-06-09T00:00:00Z") });
    const m1 = computeContextMetrics(pack);
    const m2 = computeContextMetrics(pack);
    expect(JSON.stringify(m1)).toBe(JSON.stringify(m2));
  });

  it("metricsFromCwd yields identical metrics across repeated runs", () => {
    const opts = { cwd: EXAMPLE, task: "speed up the booking confirmation path", scopes: ["performance"] };
    const a = metricsFromCwd(opts);
    const b = metricsFromCwd(opts);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("metrics do not depend on wall-clock time (no generatedAt leakage)", () => {
    const m = metricsFromCwd({ cwd: EXAMPLE, task: "stabilize the api", scopes: ["api"] });
    // The metrics object reports structure/coverage only — never a timestamp.
    expect(JSON.stringify(m)).not.toMatch(/\d{4}-\d{2}-\d{2}T/); // no ISO timestamp
    expect(m).not.toHaveProperty("generatedAt");
  });

  it("a different task can produce different coverage (metrics actually reflect input)", () => {
    const perf = metricsFromCwd({ cwd: EXAMPLE, task: "speed up booking", scopes: ["performance"] });
    const api = metricsFromCwd({ cwd: EXAMPLE, task: "stabilize partner contract", scopes: ["api"] });
    // Same workspace, but the scope coverage targets differ.
    expect(perf.scopes).not.toEqual(api.scopes);
  });
});
