import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TPL = resolve(REPO_ROOT, "templates/mind-ontology/autopilot/autopilot-blocks.md");

const text = () => readFileSync(TPL, "utf8");

describe("autopilot template blocks (A4)", () => {
  it("ships the drop-in autopilot blocks template", () => {
    expect(existsSync(TPL)).toBe(true);
  });

  it("uses .agentctx block style (heading + #tags) for both target files", () => {
    const t = text();
    // Tagged blocks that paste into constraints.md and agent-roles.md.
    expect(t).toMatch(/##\s+.+#autopilot/);
    expect(t).toContain("constraints.md");
    expect(t).toContain("agent-roles.md");
  });

  it("references only the two read-only tools, no hosted dependency", () => {
    const t = text();
    expect(t).toContain("get_context(task)");
    expect(t).toContain("list_constraints()");
    const lower = t.toLowerCase();
    expect(lower).toMatch(/no hosted|no account|no network|local-first/);
    // Must not embed a hosted endpoint or credential.
    expect(lower).not.toMatch(/sirtai\.org|bearer |authorization:/);
  });

  it("encodes the right-axis read, the constraint re-read, and the stop policy", () => {
    const lower = text().toLowerCase();
    expect(lower).toMatch(/right axis|not as a memory store/);
    expect(lower).toMatch(/before .*irreversible|before risky writes/);
    expect(lower).toMatch(/valid terminal|stop the line only/);
  });

  it("points back at the three pack docs so the template can't drift", () => {
    const t = text();
    expect(t).toContain("mind-ontology-autopilot-pack-v1.md");
    expect(t).toContain("mind-ontology-autopilot-reading-protocol-v1.md");
    expect(t).toContain("mind-ontology-autopilot-stop-policy-v1.md");
  });
});
