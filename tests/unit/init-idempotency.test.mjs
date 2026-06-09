import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initAgentctx } from "../../scripts/agentctx/init.mjs";

const tempRoots = [];
function makeTempRoot() {
  const dir = mkdtempSync(join(tmpdir(), "agentctx-init-idem-"));
  tempRoots.push(dir);
  return dir;
}
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

// M21 — init must never destroy user context. The default refuses; even --force
// only refreshes template files and leaves the user's own files untouched.
describe("agentctx init is non-destructive to user context (M21)", () => {
  it("a refused second init leaves the user's edits intact (no partial overwrite)", () => {
    const cwd = makeTempRoot();
    initAgentctx({ cwd });
    const constraints = join(cwd, ".agentctx", "constraints.md");
    const edited = "# Constraints\n\n## My own rule #safety\n\nDo not touch my notes.\n";
    writeFileSync(constraints, edited);

    expect(() => initAgentctx({ cwd })).toThrow(/already exists/);
    // The throw happened before any write — the user's edit survives byte-for-byte.
    expect(readFileSync(constraints, "utf8")).toBe(edited);
  });

  it("--force refreshes template files but preserves user-created extra files", () => {
    const cwd = makeTempRoot();
    initAgentctx({ cwd });
    const myFile = join(cwd, ".agentctx", "my-private-notes.md");
    writeFileSync(myFile, "personal context the template does not know about\n");

    initAgentctx({ cwd, force: true });

    // Template file is restored to template content...
    expect(readFileSync(join(cwd, ".agentctx", "constraints.md"), "utf8")).toContain(
      "No secrets in ontology files",
    );
    // ...but the user's own file is NOT pruned.
    expect(existsSync(myFile)).toBe(true);
    expect(readFileSync(myFile, "utf8")).toContain("personal context");
  });

  it("init is deterministic: two fresh inits yield the same file set", () => {
    const a = initAgentctx({ cwd: makeTempRoot() });
    const b = initAgentctx({ cwd: makeTempRoot() });
    expect(a.files).toEqual(b.files);
  });
});
