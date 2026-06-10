import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => readFileSync(resolve(REPO_ROOT, p), "utf8");
const PKG = JSON.parse(read("package.json"));
const BIN_TARGET = "scripts/agentctx/cli.mjs";

const listTgz = () => readdirSync(REPO_ROOT).filter((f) => f.endsWith(".tgz"));

// M48 — the dry-run distribution posture, verified by actually running the pack.
// `npm pack --dry-run --json` lists the would-be tarball without writing one and
// without publishing; we inspect that listing and assert the package stays
// fail-closed. If npm is unavailable the suite fails loudly rather than skipping —
// packaging is a shipped guarantee, not an optional one.
describe("npm pack --dry-run is non-publishing and fail-closed (M48)", () => {
  let pack; // the parsed pack descriptor
  let packError = null;
  let tgzBefore = [];
  let tgzAfter = [];

  beforeAll(() => {
    tgzBefore = listTgz();
    try {
      // execSync (not execFile) so Windows resolves npm.cmd via the shell.
      const stdout = execSync("npm pack --dry-run --json", {
        cwd: REPO_ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"], // npm prints progress to stderr; --json data is on stdout
        maxBuffer: 64 * 1024 * 1024,
      });
      const parsed = JSON.parse(stdout);
      pack = Array.isArray(parsed) ? parsed[0] : parsed;
    } catch (err) {
      packError = err;
    }
    tgzAfter = listTgz();
  }, 60_000); // spawning npm pack is slow under the full parallel suite; default 10s hook timeout is too tight

  const filePaths = () => (pack?.files ?? []).map((f) => f.path.replace(/\\/g, "/"));

  it("runs `npm pack --dry-run --json` and returns a parseable descriptor", () => {
    expect(packError, packError && `npm pack failed: ${packError.message}`).toBeNull();
    expect(pack, "npm pack --dry-run --json produced no descriptor").toBeTruthy();
    expect(Array.isArray(pack.files)).toBe(true);
    expect(pack.files.length).toBeGreaterThan(0);
  });

  it("leaves no tarball behind — dry-run publishes nothing", () => {
    // No new .tgz must appear as a side effect of the dry-run.
    const created = tgzAfter.filter((f) => !tgzBefore.includes(f));
    expect(created, `dry-run wrote tarball(s): ${created.join(", ")}`).toEqual([]);
  });

  it("includes the bin target so the `mind-ontology` command resolves when installed", () => {
    expect(PKG.bin?.["mind-ontology"]).toBe(BIN_TARGET);
    expect(existsSync(resolve(REPO_ROOT, BIN_TARGET))).toBe(true);
    expect(filePaths()).toContain(BIN_TARGET);
  });

  it("includes LICENSE, NOTICE, and README in the would-be tarball", () => {
    const paths = filePaths();
    for (const required of ["LICENSE", "NOTICE", "README.md"]) {
      expect(paths, `tarball is missing ${required}`).toContain(required);
    }
  });

  it("ships only the allowlisted product surface — tests, examples, and internal docs excluded", () => {
    const paths = filePaths();
    // The `files` allowlist is applied (release prep for 0.1.0); the tarball is
    // the product, not the workshop.
    expect(Array.isArray(PKG.files), "the files allowlist must be applied").toBe(true);
    expect(PKG.files).toContain("scripts/agentctx/**");
    expect(PKG.files).toContain("templates/**");
    expect(paths.some((p) => p.startsWith("tests/")), "tests/** must not ship in the tarball").toBe(false);
    expect(paths.some((p) => p.startsWith("docs/examples/")), "docs/examples/** must not ship").toBe(false);
    for (const internal of ["EXTRACTION-INVENTORY.md", "CONTROL.md", "NEXT-LANES.md", "MIGRATION-PLAN.md"]) {
      expect(paths, `${internal} is internal and must not ship`).not.toContain(internal);
    }
    expect(paths.length).toBeLessThan(60);
  });

  it("would produce a 0.1.0 tarball; publishing stays an explicit operator decision", () => {
    expect(PKG.private, "publish-ready: the gate is the operator decision, not package.json").toBeUndefined();
    expect(PKG.publishConfig).toBeUndefined();
    // filename encodes name + the prepared first-release version.
    expect(pack.filename.replace(/\\/g, "/")).toMatch(/mind-ontology-0\.1\.0\.tgz$/);
    expect(pack.version ?? PKG.version).toBe("0.1.0");
  });
});

// M49 — the doc must explain the tested contract: non-publishing dry-run, the
// broad-tarball-today / allowlist-tomorrow split, and the operator-only gate.
describe("packaging doc explains the tested dry-run contract (M49)", () => {
  const doc = read("docs/packaging.md");

  it("frames the dry-run as non-publishing and names the live pack test", () => {
    expect(doc).toContain("npm pack --dry-run --json");
    expect(doc).toContain("tests/unit/packaging-dry-run-contract.test.mjs");
    expect(doc.toLowerCase()).toContain("leaves no");
  });

  it("ties the publish gate to a separate operator decision, not a passing test", () => {
    expect(doc.toLowerCase()).toContain("operator decision");
    expect(doc).toContain("RELEASE-CHECKLIST.md");
    // documents both the current broad tarball and the proposed future allowlist
    expect(doc.toLowerCase()).toContain("broad");
    expect(doc).toContain("files");
  });
});
