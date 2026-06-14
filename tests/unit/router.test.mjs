import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  loadManifest,
  parseRouteArgv,
  renderRoute,
  routeOntology,
  scanLibrary,
} from "../../scripts/agentctx/router.mjs";
import { compileFromCwd, parseArgv as parseCompileArgv } from "../../scripts/agentctx/compile.mjs";
import { initAgentctx } from "../../scripts/agentctx/init.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// A library where each box is a real (init-template) ontology plus a manifest.
function compilableLibrary(boxes) {
  const lib = tmp();
  for (const b of boxes) {
    const dir = join(lib, b.id);
    mkdirSync(dir, { recursive: true });
    initAgentctx({ cwd: dir });
    writeFileSync(join(dir, ".agentctx", "manifest.json"), JSON.stringify(b));
  }
  return lib;
}

const tempRoots = [];
function tmp() {
  const dir = mkdtempSync(join(tmpdir(), "agentctx-router-"));
  tempRoots.push(dir);
  return dir;
}
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

// Write `<lib>/<id>/.agentctx/manifest.json` and return the library dir.
function library(boxes) {
  const lib = tmp();
  for (const box of boxes) {
    const dir = join(lib, box.id, ".agentctx");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "manifest.json"), JSON.stringify(box));
  }
  return lib;
}

const box = (id, triggers, extra = {}) => ({ id, name: id, triggers, ...extra });

describe("manifest loading + validation", () => {
  it("loads a valid manifest with defaults for optional fields", () => {
    const lib = library([box("ar", ["売掛金明細表", "指定請求書"], { description: "AR", scopes: ["uriage"] })]);
    const m = loadManifest(join(lib, "ar"));
    expect(m).toMatchObject({ id: "ar", name: "ar", triggers: ["売掛金明細表", "指定請求書"], scopes: ["uriage"] });
    expect(m.excludeTerms).toEqual([]);
  });

  it("rejects a manifest missing id/name/triggers", () => {
    const lib = tmp();
    const write = (obj) => {
      const dir = join(lib, "x", ".agentctx");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "manifest.json"), JSON.stringify(obj));
      return join(lib, "x");
    };
    expect(() => loadManifest(write({ name: "x", triggers: ["a"] }))).toThrow(/"id"/);
    expect(() => loadManifest(write({ id: "x", triggers: ["a"] }))).toThrow(/"name"/);
    expect(() => loadManifest(write({ id: "x", name: "x" }))).toThrow(/triggers/);
    expect(() => loadManifest(write({ id: "x", name: "x", triggers: [] }))).toThrow(/triggers/);
  });

  it("scans a library in deterministic order and skips dirs without a manifest", () => {
    const lib = library([box("b", ["beta"]), box("a", ["alpha"])]);
    mkdirSync(join(lib, "no-manifest"), { recursive: true });
    const found = scanLibrary(lib);
    expect(found.map((o) => o.id)).toEqual(["a", "b"]); // sorted, no-manifest skipped
  });

  it("rejects a library with two boxes sharing an id", () => {
    // Different directories, same id — routing returns an id, so a duplicate is ambiguous.
    const lib = library([{ id: "dup", name: "one", triggers: ["a"] }]);
    const dir2 = join(lib, "second", ".agentctx");
    mkdirSync(dir2, { recursive: true });
    writeFileSync(join(dir2, "manifest.json"), JSON.stringify({ id: "dup", name: "two", triggers: ["b"] }));
    expect(() => scanLibrary(lib)).toThrow(/Duplicate ontology id "dup"/);
  });
});

describe("deterministic routing", () => {
  const boxes = [
    box("ar", ["売掛金明細表", "指定請求書", "SAP"], { scopes: ["uriage"] }),
    box("ap", ["買掛", "仕入れデータ", "OCR", "突合"], { scopes: ["kaikake"] }),
    box("supp", ["SirtuinX", "サプリ"], { scopes: ["supplement"] }),
  ];

  it("routes a task to the box whose trigger appears verbatim (handles Japanese)", () => {
    const r = routeOntology("指定請求書の件で売掛金明細表を確認したい", [], boxes);
    expect(r.selected).toBe("ar");
    expect(r.ambiguous).toBe(false);
    expect(r.candidates[0].reasons).toContain("trigger:売掛金明細表");
  });

  it("routes a different domain to a different box (boxes are never blended)", () => {
    expect(routeOntology("40カケをOCRして仕入れデータと突合", [], boxes).selected).toBe("ap");
    expect(routeOntology("SirtuinXのサプリ", [], boxes).selected).toBe("supp");
  });

  it("selects nothing when no box matches", () => {
    const r = routeOntology("今日の天気はどう", [], boxes);
    expect(r.selected).toBe(null);
  });

  it("a weak name/description token alone does not select a box (regression)", () => {
    // Independent review caught this: "team status" must not route to a box just because
    // "team" is in its name — only a trigger or scope hit makes a box selectable.
    const lib = [{ id: "team", name: "team", triggers: ["booking"], description: "scheduling" }];
    expect(routeOntology("team status update", [], lib).selected).toBe(null);
    expect(routeOntology("the booking flow", [], lib).selected).toBe("team"); // real trigger still works
  });

  it("an explicit scope routes even without a trigger word", () => {
    const r = routeOntology("この件をまとめて", ["uriage"], boxes);
    expect(r.selected).toBe("ar");
    expect(r.candidates[0].reasons).toContain("scope:uriage");
  });

  it("excludeTerms suppress a box that would misfire on a shared word", () => {
    const lib = [
      box("general", ["請求書"], {}),
      box("strict", ["請求書"], { excludeTerms: ["見積"] }),
    ];
    const r = routeOntology("見積と請求書の話", [], lib);
    expect(r.selected).toBe("general"); // strict suppressed by the exclude term
    expect(r.candidates.find((c) => c.id === "strict").reasons).toContain("exclude:見積");
  });

  it("an ASCII trigger matches on a word boundary, not a substring (regression)", () => {
    // Independent review caught this: substring matching let the trigger "API" fire
    // inside "rapid"/"scraping". Single ASCII tokens must match as whole words.
    const lib = [box("team", ["API", "booking"])];
    expect(routeOntology("rapid onboarding and scraping", [], lib).selected).toBe(null);
    expect(routeOntology("call the partner API", [], lib).selected).toBe("team"); // real word matches
    // An ASCII trigger containing the letter "s" must still use the word boundary, not a
    // substring (a whitespace test typo once sent these to the substring path).
    const sLib = [box("host", ["hosted", "release"])];
    expect(routeOntology("the app got ghosted before prerelease", [], sLib).selected).toBe(null);
    expect(routeOntology("ship the hosted release", [], sLib).selected).toBe("host");
    // CJK / multi-word triggers still match as a substring (no word boundaries in CJK).
    const jp = [box("ar", ["売掛金明細表"])];
    expect(routeOntology("指定の売掛金明細表を見る", [], jp).selected).toBe("ar");
  });

  it("excludeTerms hard-veto a box even when it is the only candidate (regression)", () => {
    // The exclude penalty used to be too weak to offset a trigger hit; now it rejects.
    const lib = [box("inv", ["invoice"], { excludeTerms: ["quote"] })];
    const r = routeOntology("quote invoice please", [], lib);
    expect(r.selected).toBe(null); // vetoed despite the "invoice" trigger
    expect(r.candidates[0].vetoed).toBe(true);
  });

  it("flags ambiguous when the runner-up is within the margin, but still picks one", () => {
    const lib = [box("x", ["alpha"]), box("y", ["alpha"])]; // identical strength on the same word
    const r = routeOntology("alpha please", [], lib);
    expect(r.selected).not.toBe(null);
    expect(r.ambiguous).toBe(true);
    expect(r.candidates).toHaveLength(2);
  });

  it("is deterministic: same inputs give the same ranking", () => {
    const a = routeOntology("売掛金明細表", [], boxes);
    const b = routeOntology("売掛金明細表", [], boxes);
    expect(a.candidates.map((c) => `${c.id}:${c.score}`)).toEqual(b.candidates.map((c) => `${c.id}:${c.score}`));
  });
});

describe("route CLI", () => {
  it("parses route args and rejects a bad --format", () => {
    const p = parseRouteArgv(["route", "--library", "lib", "--task", "x", "--scope", "a,b", "--format", "json"]);
    expect(p).toMatchObject({ library: "lib", task: "x", scopes: ["a", "b"], format: "json" });
    expect(() => parseRouteArgv(["route", "--format", "xml"])).toThrow(/--format/);
    expect(() => parseRouteArgv(["route", "--bogus"])).toThrow(/Unknown argument/);
    // A missing --library operand must fail, not silently swallow the next flag.
    expect(() => parseRouteArgv(["route", "--library"])).toThrow(/--library requires/);
    expect(() => parseRouteArgv(["route", "--library", "--task"])).toThrow(/--library requires/);
  });

  it("renders json and text with the ranked candidates", () => {
    const result = {
      selected: "ar",
      ambiguous: false,
      candidates: [{ id: "ar", name: "AR", score: 8, reasons: ["trigger:売掛金明細表"] }],
    };
    expect(JSON.parse(renderRoute(result, "json")).selected).toBe("ar");
    const text = renderRoute(result, "text");
    expect(text).toContain("Selected box: ar");
    expect(text).toContain("ar (score=8)");
  });

  it("end-to-end: `route` on a real library prints the chosen box", () => {
    const lib = library([
      box("ar", ["売掛金明細表", "指定請求書"]),
      box("ap", ["買掛", "OCR", "突合"]),
    ]);
    const ROUTER = resolve(REPO_ROOT, "scripts/agentctx/router.mjs");
    const r = spawnSync(process.execPath, [ROUTER, "route", "--library", lib, "--task", "指定請求書の件", "--format", "json"], {
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).selected).toBe("ar");

    const missing = spawnSync(process.execPath, [ROUTER, "route", "--task", "x"], { encoding: "utf8" });
    expect(missing.status).toBe(1);
    expect(missing.stderr).toMatch(/--library/);
  });
});

describe("compile --library: route then compile", () => {
  it("routes to the matching box, compiles it, and records routedTo (json + markdown)", () => {
    const lib = compilableLibrary([
      box("ar", ["売掛金明細表", "指定請求書"]),
      box("ap", ["買掛", "OCR", "突合"]),
    ]);
    const j = JSON.parse(compileFromCwd({ cwd: ".", library: lib, task: "指定請求書の件", scopes: [], format: "json" }));
    expect(j.routedTo.selected).toBe("ar");
    expect(j.selected.length).toBeGreaterThan(0); // it really compiled the box
    const md = compileFromCwd({ cwd: ".", library: lib, task: "指定請求書の件", scopes: [], format: "markdown" });
    expect(md).toMatch(/^Routed to: ar/m);
  });

  it("errors when no box matches the task", () => {
    const lib = compilableLibrary([box("ar", ["売掛金明細表"])]);
    expect(() => compileFromCwd({ cwd: ".", library: lib, task: "今日の天気", scopes: [], format: "json" })).toThrow(
      /matched the task/,
    );
  });

  it("without --library the output is unchanged (no routedTo key)", () => {
    const lib = compilableLibrary([box("ar", ["売掛金明細表"])]);
    const j = JSON.parse(compileFromCwd({ cwd: join(lib, "ar"), task: "anything", scopes: [], format: "json" }));
    expect(j.routedTo).toBeUndefined();
  });

  it("compile rejects --library without a directory operand (regression)", () => {
    // Otherwise a malformed `compile --library` silently compiles --cwd from the wrong box.
    expect(() => parseCompileArgv(["compile", "--task", "x", "--library"])).toThrow(/--library requires/);
    expect(() => parseCompileArgv(["compile", "--task", "x", "--library", "--format"])).toThrow(/--library requires/);
  });
});
