import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const INDEX = readFileSync(resolve(REPO_ROOT, "docs/mind-ontology.md"), "utf8");

// Slice out just the "Autopilot integration" section of the index.
function autopilotSection() {
  const start = INDEX.indexOf("Autopilot integration");
  expect(start, "no autopilot section in index").toBeGreaterThan(-1);
  const after = INDEX.indexOf("\n### ", start + 1);
  return INDEX.slice(start, after === -1 ? undefined : after);
}

const section = autopilotSection();
const pos = (doc) => section.indexOf(doc);

describe("autopilot docs index ordering (A70)", () => {
  it("lists the frame first in the autopilot section", () => {
    const frame = pos("mind-ontology-autopilot-pack-v1.md");
    expect(frame).toBeGreaterThan(-1);
    for (const later of [
      "mind-ontology-autopilot-reading-protocol-v1.md",
      "mind-ontology-autopilot-stop-policy-v1.md",
      "mind-ontology-autopilot-manifest-v1.md",
    ]) {
      expect(frame, `frame should precede ${later}`).toBeLessThan(pos(later));
    }
  });

  it("orders behavior (reading protocol, stop policy) before the manifest tail", () => {
    expect(pos("mind-ontology-autopilot-reading-protocol-v1.md")).toBeLessThan(
      pos("mind-ontology-autopilot-stop-policy-v1.md"),
    );
    expect(pos("mind-ontology-autopilot-stop-policy-v1.md")).toBeLessThan(
      pos("mind-ontology-autopilot-manifest-v1.md"),
    );
  });

  it("keeps the manifest 'pack at a glance' as the closing entry", () => {
    const manifest = pos("mind-ontology-autopilot-manifest-v1.md");
    // No autopilot doc link appears after the manifest line in the section.
    const tail = section.slice(manifest);
    const laterDocs = [...tail.matchAll(/mind-ontology-autopilot-[a-z0-9-]+-v1\.md/g)]
      .map((m) => m[0])
      .filter((d) => d !== "mind-ontology-autopilot-manifest-v1.md");
    expect(laterDocs).toEqual([]);
  });
});
