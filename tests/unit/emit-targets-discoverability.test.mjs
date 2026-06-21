import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_TARGET_IDS,
  EMIT_TARGETS,
  SUPPORTED_TARGET_IDS,
} from "../../scripts/agentctx/emit.mjs";

// Lane 4 — discoverability guard. Once `cursor` / `paste-block` are emittable,
// a user must be able to FIND them: in `emit --help`, in the README, and in the
// unknown-target error row. These assertions key off the live registry, so a
// future target that is added to EMIT_TARGETS but left out of the help / README /
// error catalog fails here instead of shipping an undiscoverable feature.

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = resolve(REPO_ROOT, "scripts/agentctx/cli.mjs");
const read = (p) => readFileSync(resolve(REPO_ROOT, p), "utf8").replace(/\r\n/g, "\n");

const emitHelp = spawnSync(process.execPath, [CLI, "emit", "--help"], {
  encoding: "utf8",
}).stdout;
const README = read("README.md");
const CLI_ERRORS = read("docs/cli-errors.md");

describe("emit targets are discoverable (Lane 4)", () => {
  it("emit --help lists every supported target id and the default set", () => {
    for (const id of SUPPORTED_TARGET_IDS) {
      expect(emitHelp, `emit --help omits supported target ${id}`).toContain(id);
    }
    // The default set is named so a user knows which targets a bare emit writes.
    expect(emitHelp).toContain(`Default (no --target): ${DEFAULT_TARGET_IDS.join(", ")}`);
    // The supported-but-not-default targets are shown with a combined example.
    expect(emitHelp).toContain("supported but NOT default");
    expect(emitHelp).toContain("--target cursor,paste-block");
  });

  it("the README documents every supported target's command and artifact path", () => {
    for (const id of SUPPORTED_TARGET_IDS) {
      expect(README, `README omits supported target id ${id}`).toContain(id);
      expect(
        README,
        `README omits artifact path for ${id}`,
      ).toContain(EMIT_TARGETS[id].path);
    }
    // The combined non-default invocation is shown.
    expect(README).toContain("mind-ontology emit --target cursor,paste-block");
  });

  it("the unknown-target error row in docs/cli-errors.md lists every supported id", () => {
    const row = CLI_ERRORS.split("\n").find(
      (l) => l.includes("Unknown target id") && l.includes("--target must be one of"),
    );
    expect(row, "docs/cli-errors.md has no unknown-target row").toBeTruthy();
    for (const id of SUPPORTED_TARGET_IDS) {
      expect(row, `cli-errors unknown-target row omits ${id}`).toContain(`"${id}"`);
    }
  });

  it("README never implies cursor / paste-block are default targets", () => {
    // They must be described as supported but not default.
    expect(README).toContain("supported but not default");
    // The default walkthrough output names only the two default artifacts.
    expect(README).toContain("WROTE  AGENTS.md");
    expect(README).toContain("WROTE  CLAUDE.md");
  });
});
