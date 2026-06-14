import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { handleGetContext } from "../../scripts/agentctx/mcp-server.mjs";
import { initAgentctx } from "../../scripts/agentctx/init.mjs";

const tempRoots = [];
function library(boxes) {
  const lib = mkdtempSync(join(tmpdir(), "agentctx-mcplib-"));
  tempRoots.push(lib);
  const dirs = {};
  for (const b of boxes) {
    const dir = join(lib, b.id);
    mkdirSync(dir, { recursive: true });
    initAgentctx({ cwd: dir });
    writeFileSync(join(dir, ".agentctx", "manifest.json"), JSON.stringify(b));
    dirs[b.id] = dir;
  }
  return { lib, dirs };
}
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

const getJson = (args, defaultCwd, env) => JSON.parse(handleGetContext(args, defaultCwd, env).content[0].text);

describe("MCP get_context library routing (AGENTCTX_LIBRARY)", () => {
  it("routes the task to a box and records routedTo when AGENTCTX_LIBRARY is set", () => {
    const { lib } = library([
      { id: "ar", name: "AR", triggers: ["売掛金明細表", "指定請求書"] },
      { id: "ap", name: "AP", triggers: ["買掛", "OCR"] },
    ]);
    const out = getJson({ task: "指定請求書の件で確認", format: "json" }, lib, { AGENTCTX_LIBRARY: lib });
    expect(out.routedTo.selected).toBe("ar");
    expect(out.selected.length).toBeGreaterThan(0); // really compiled the box
  });

  it("errors clearly when no box in the library matches", () => {
    const { lib } = library([{ id: "ar", name: "AR", triggers: ["売掛金明細表"] }]);
    expect(() => handleGetContext({ task: "今日の天気" }, lib, { AGENTCTX_LIBRARY: lib })).toThrow(
      /library .* matched/,
    );
  });

  it("an explicit cwd pins a box and skips routing even with a library set", () => {
    const { lib, dirs } = library([
      { id: "ar", name: "AR", triggers: ["売掛金明細表"] },
      { id: "ap", name: "AP", triggers: ["買掛"] },
    ]);
    const out = getJson({ task: "anything", format: "json", cwd: dirs.ap }, lib, { AGENTCTX_LIBRARY: lib });
    expect(out.routedTo).toBeUndefined(); // pinned, not routed
  });

  it("backward compatible: with no AGENTCTX_LIBRARY it is the existing single-box path", () => {
    const { dirs } = library([{ id: "ar", name: "AR", triggers: ["売掛金明細表"] }]);
    const out = getJson({ task: "anything", format: "json" }, dirs.ar, {});
    expect(out.routedTo).toBeUndefined();
    expect(out.selected.length).toBeGreaterThan(0);
  });
});
