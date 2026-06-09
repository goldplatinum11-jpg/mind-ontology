import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => readFileSync(resolve(REPO_ROOT, p), "utf8");
// Collapse markdown line-wrapping so multi-word phrases match regardless of where
// the prose happens to wrap.
const flat = (p) => read(p).replace(/\s+/g, " ").toLowerCase();

// M37 — the status report must be honest: usable-now, fail-closed, no hosted claims.
describe("product status report is honest (M37)", () => {
  it("ships and names the real gates and their states", () => {
    expect(existsSync(resolve(REPO_ROOT, "docs/product-status.md"))).toBe(true);
    const s = read("docs/product-status.md");
    for (const gate of ["agentctx:proof", "agentctx:validate", "agentctx:smoke"]) {
      expect(s).toContain(gate);
    }
    expect(s.toLowerCase()).toContain("fail-closed");
  });

  it("does not claim hosted SIRT is available", () => {
    const s = read("docs/product-status.md").toLowerCase();
    expect(s).not.toMatch(/hosted sirt is (now )?available/);
    expect(s).toMatch(/not\s+available from this repository|not.*part of this repository/);
  });
});

// M38 — next-lane candidates must avoid deploy/migration/secrets/live-write/SIRT write.
describe("next-lanes stay within the safe boundary (M38)", () => {
  it("ships and frames every ready candidate as docs/tests, local-first", () => {
    expect(existsSync(resolve(REPO_ROOT, "NEXT-LANES.md"))).toBe(true);
    const n = flat("NEXT-LANES.md");
    expect(n).toContain("no deploy");
    expect(n).toContain("no secrets");
    expect(n).toMatch(/hosted\/closed boundary|stay in hosted sirt/);
  });

  it("explicitly excludes the hosted/closed capabilities from the product", () => {
    const n = flat("NEXT-LANES.md");
    for (const closed of ["writeback execution", "tenant storage", "deploy"]) {
      expect(n).toContain(closed);
    }
  });
});
