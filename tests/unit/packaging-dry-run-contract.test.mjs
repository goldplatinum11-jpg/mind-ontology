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

  it("still bundles a broad tree (tests included) — the `files` allowlist is not applied yet", () => {
    const paths = filePaths();
    expect(PKG.files, "a files allowlist would narrow the tarball").toBeUndefined();
    // With no allowlist, npm ships everything not gitignored, including tests/**.
    expect(paths.some((p) => p.startsWith("tests/")), "expected test files in the broad tarball").toBe(true);
    expect(paths.length).toBeGreaterThan(50);
  });

  it("would produce a private, un-bumped tarball name and refuses to publish", () => {
    expect(PKG.private, "removing private is a separate operator decision").toBe(true);
    expect(PKG.publishConfig).toBeUndefined();
    // filename encodes name + current version; no version bump in this lane.
    expect(pack.filename.replace(/\\/g, "/")).toMatch(/mind-ontology-0\.0\.0\.tgz$/);
    expect(pack.version ?? PKG.version).toBe("0.0.0");
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
