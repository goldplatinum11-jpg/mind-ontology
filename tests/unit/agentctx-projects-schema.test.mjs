import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseMarkdownBlocks } from "../../scripts/agentctx/compile.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PROJECTS_PATH = resolve(
  REPO_ROOT,
  "templates/mind-ontology/.agentctx/projects.md",
);

// Field line: "Key: value" on its own line.
function fieldValue(body, key) {
  const match = body.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return match ? match[1].trim() : null;
}

function loadProjectBlocks() {
  return parseMarkdownBlocks(readFileSync(PROJECTS_PATH, "utf8"), "projects.md");
}

describe("projects.md schema v0 conformance", () => {
  it("parses into tagged blocks", () => {
    const blocks = loadProjectBlocks();
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    for (const block of blocks) {
      expect(block.tags.length, `block "${block.title}" has no tags`).toBeGreaterThan(0);
    }
  });

  it("has a required active project block tagged #project #active", () => {
    const blocks = loadProjectBlocks();
    const active = blocks.find(
      (block) => block.tags.includes("active") && block.tags.includes("project"),
    );
    expect(active, "missing active project block (#project #active)").toBeTruthy();
    expect(active.body.trim().length).toBeGreaterThan(0);
  });

  it("active project block carries Name and Status field lines", () => {
    const blocks = loadProjectBlocks();
    const active = blocks.find((block) => block.tags.includes("active"));
    expect(active).toBeTruthy();
    expect(fieldValue(active.body, "Name"), "missing Name: field").toBeTruthy();
    const status = fieldValue(active.body, "Status");
    expect(status, "missing Status: field").toBeTruthy();
    expect(["active", "exploratory", "paused", "archived"]).toContain(status);
  });

  it("every project block that declares Status uses a known value", () => {
    const blocks = loadProjectBlocks();
    for (const block of blocks) {
      const status = fieldValue(block.body, "Status");
      if (status !== null) {
        expect(
          ["active", "exploratory", "paused", "archived"],
          `block "${block.title}" has unknown Status: ${status}`,
        ).toContain(status);
      }
    }
  });
});
