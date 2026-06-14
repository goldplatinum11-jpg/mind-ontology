import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { parseScaffoldArgv, renderScaffold, scaffoldManifest } from "../../scripts/agentctx/manifest-scaffold.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SCAFFOLD = resolve(REPO_ROOT, "scripts/agentctx/manifest-scaffold.mjs");

const tempRoots = [];
function ontology(files) {
  const dir = mkdtempSync(join(tmpdir(), "agentctx-scaffold-"));
  tempRoots.push(dir);
  mkdirSync(join(dir, ".agentctx"), { recursive: true });
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, ".agentctx", name), body);
  return dir;
}
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

describe("manifest scaffolding", () => {
  it("drafts triggers from distinctive names/terms and drops generic placeholders", () => {
    const dir = ontology({
      "projects.md":
        "# Projects\n\n## Booking fast-path #project #active #performance\n\nName: booking-fast-path\nStatus: active\n\nThe booking service.\n\n## Active project #project #generic\n\nName: Example Project\nStatus: active\n\nplaceholder text\n",
      "glossary.md": "# Glossary\n\n## Availability TTL #term\n\nA cache window.\n",
      "identity.md": "# Identity\n\n## Helios scheduling team #identity\n\nWe run scheduling.\n",
    });
    const r = scaffoldManifest(dir);
    expect(r.draft).toBe(true);
    expect(r.manifest.id).toBe(basename(dir));
    expect(r.manifest.name).toBe("Helios scheduling team");
    expect(r.manifest.triggers).toContain("booking-fast-path"); // distinctive project Name
    expect(r.manifest.triggers).toContain("Availability TTL"); // glossary term
    // Generic template placeholders are filtered out.
    expect(r.manifest.triggers).not.toContain("Example Project");
    expect(r.manifest.triggers).not.toContain("Active project");
    expect(r.manifest.scopes).toContain("performance"); // a non-generic tag becomes a scope
  });

  it("errors clearly when no distinctive triggers can be derived (regression)", () => {
    // Independent review caught this: a placeholder/template ontology yields triggers: [],
    // which loadManifest rejects. Fail with guidance instead of emitting an unusable draft.
    const dir = ontology({
      "projects.md": "# Projects\n\n## Active project #project #active\n\nName: Example Project\nStatus: active\n\nplaceholder\n",
      "direction.md": "# Direction\n\n## Current direction #direction\n\nplaceholder\n",
    });
    expect(() => scaffoldManifest(dir)).toThrow(/Could not derive any routing triggers/);
  });

  it("keeps non-English (CJK) terms as triggers", () => {
    const dir = ontology({
      "glossary.md": "# Glossary\n\n## 売掛金明細表 #term\n\n指定先の売掛管理。\n",
      "projects.md": "# Projects\n\n## 指定請求書 #project #active\n\nName: shitei-seikyu\nStatus: active\n\n指定請求書の発行。\n",
    });
    const r = scaffoldManifest(dir);
    expect(r.manifest.triggers).toContain("売掛金明細表");
    expect(r.manifest.triggers).toContain("指定請求書");
  });

  it("renders json (the manifest) and text (manifest + sources), and parses args", () => {
    const dir = ontology({ "projects.md": "# Projects\n\n## Lumen Cloud #project #active\n\nName: lumen-cloud\nStatus: active\n\nhosted.\n" });
    const r = scaffoldManifest(dir);
    expect(JSON.parse(renderScaffold(r, "json")).triggers).toContain("lumen-cloud");
    expect(renderScaffold(r, "text")).toContain("DRAFT manifest.json");
    expect(parseScaffoldArgv(["scaffold", "--cwd", "x", "--format", "json"])).toMatchObject({ cwd: "x", format: "json" });
    expect(() => parseScaffoldArgv(["scaffold", "--cwd"])).toThrow(/--cwd requires/);
  });

  it("end-to-end: prints a draft and errors without an .agentctx/", () => {
    const dir = ontology({ "glossary.md": "# Glossary\n\n## Workspace #term\n\nA billed tenant.\n" });
    const r = spawnSync(process.execPath, [SCAFFOLD, "scaffold", "--cwd", dir, "--format", "json"], { encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).triggers).toContain("Workspace");

    const empty = mkdtempSync(join(tmpdir(), "agentctx-empty-"));
    tempRoots.push(empty);
    const bad = spawnSync(process.execPath, [SCAFFOLD, "scaffold", "--cwd", empty], { encoding: "utf8" });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toMatch(/No \.agentctx/);
  });
});
