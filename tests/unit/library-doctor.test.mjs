import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { lintLibrary, parseDoctorArgv, renderLint } from "../../scripts/agentctx/library-doctor.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOCTOR = resolve(REPO_ROOT, "scripts/agentctx/library-doctor.mjs");

const tempRoots = [];
function library(boxes) {
  const lib = mkdtempSync(join(tmpdir(), "agentctx-doctor-"));
  tempRoots.push(lib);
  for (const [id, manifest] of Object.entries(boxes)) {
    const dir = join(lib, id, ".agentctx");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "manifest.json"), typeof manifest === "string" ? manifest : JSON.stringify(manifest));
  }
  return lib;
}
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

describe("library doctor", () => {
  it("reports a clean library with no issues", () => {
    const lib = library({
      a: { id: "a", name: "A", triggers: ["alpha"] },
      b: { id: "b", name: "B", triggers: ["beta"] },
    });
    const r = lintLibrary(lib);
    expect(r.ok).toBe(true);
    expect(r.boxes).toBe(2);
    expect(r.issues).toEqual([]);
  });

  it("collects every problem instead of throwing on the first (unlike scanLibrary)", () => {
    const lib = library({
      good: { id: "good", name: "Good", triggers: ["alpha"] },
      // two distinct dirs that resolve to the same id
      dupA: { id: "dup", name: "Dup A", triggers: ["x"] },
      dupB: { id: "dup", name: "Dup B", triggers: ["y"] },
      broken: { id: "broken", name: "Broken" }, // missing triggers
    });
    const r = lintLibrary(lib);
    expect(r.ok).toBe(false);
    const codes = r.issues.map((i) => i.code);
    expect(codes).toContain("duplicate-id");
    expect(codes).toContain("bad-manifest");
  });

  it("warns about a trigger shared by two boxes (the misroute risk)", () => {
    const lib = library({
      ar: { id: "ar", name: "AR", triggers: ["invoice", "売掛金明細表"] },
      ap: { id: "ap", name: "AP", triggers: ["invoice", "買掛"] },
    });
    const r = lintLibrary(lib);
    const overlap = r.issues.find((i) => i.code === "overlapping-trigger");
    expect(overlap).toBeTruthy();
    expect(overlap.message).toContain("invoice");
    expect(overlap.level).toBe("warning"); // a warning, not an error — still routable
    expect(r.ok).toBe(true);
  });

  it("renders text and json, and parses doctor args", () => {
    const report = { ok: false, boxes: 1, issues: [{ level: "error", code: "duplicate-id", message: "id x" }] };
    expect(renderLint(report, "text")).toContain("[error] duplicate-id");
    expect(JSON.parse(renderLint(report, "json")).ok).toBe(false);
    expect(parseDoctorArgv(["doctor", "--library", "lib", "--format", "json"])).toMatchObject({
      library: "lib",
      format: "json",
    });
    expect(() => parseDoctorArgv(["doctor", "--library"])).toThrow(/--library requires/);
  });

  it("end-to-end: exits 1 with errors, 0 when clean", () => {
    const dirty = library({ a: { id: "d", name: "A", triggers: ["x"] }, b: { id: "d", name: "B", triggers: ["y"] } });
    const r1 = spawnSync(process.execPath, [DOCTOR, "doctor", "--library", dirty, "--format", "json"], { encoding: "utf8" });
    expect(r1.status).toBe(1);
    expect(JSON.parse(r1.stdout).ok).toBe(false);

    const clean = library({ a: { id: "a", name: "A", triggers: ["x"] } });
    const r2 = spawnSync(process.execPath, [DOCTOR, "doctor", "--library", clean], { encoding: "utf8" });
    expect(r2.status).toBe(0);
  });
});
