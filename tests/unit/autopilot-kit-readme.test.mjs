import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DIR = resolve(REPO_ROOT, "templates/mind-ontology/autopilot");
const README = resolve(DIR, "README.md");
const PKG = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));

const text = () => readFileSync(README, "utf8");

describe("autopilot drop-in kit README (A22)", () => {
  it("ships the kit README", () => {
    expect(existsSync(README)).toBe(true);
  });

  it("documents every file that actually ships in the kit", () => {
    const t = text();
    for (const file of ["autopilot-blocks.md", "autopilot.mcp.json", "autopilot-codex.toml"]) {
      expect(t, `README omits ${file}`).toContain(file);
      expect(existsSync(resolve(DIR, file)), `kit file missing on disk: ${file}`).toBe(true);
    }
  });

  it("only cites npm scripts that exist", () => {
    const cited = [...text().matchAll(/npm run ([a-z:]+)/g)].map((m) => m[1]);
    for (const script of new Set(cited)) {
      expect(PKG.scripts, `cited missing script: ${script}`).toHaveProperty(script);
    }
  });

  it("keeps the two-tool / no-sprawl / local-first promise", () => {
    const t = text();
    expect(t).toContain("get_context");
    expect(t).toContain("list_constraints");
    const lower = t.toLowerCase();
    expect(lower).toMatch(/no tool sprawl/);
    expect(lower).toMatch(/no hosted dependency|local-first/);
    expect(lower).toMatch(/no secrets|never put credentials/);
  });

  it("embeds no hosted host or secret value", () => {
    const lower = text().toLowerCase();
    expect(lower).not.toMatch(/sirtai\.org|workers\.dev|bearer\s+[a-z0-9]/);
  });
});
