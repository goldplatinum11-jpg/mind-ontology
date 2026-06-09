import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PKG = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));

function markdownFiles() {
  const files = [];
  for (const name of readdirSync(REPO_ROOT)) {
    if (name.endsWith(".md")) files.push(resolve(REPO_ROOT, name));
  }
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith(".md")) files.push(p);
    }
  };
  walk(resolve(REPO_ROOT, "docs"));
  return files;
}

// GitHub-flavoured heading slug: lowercase, drop backticks, strip punctuation
// except word/space/hyphen, spaces -> hyphens (consecutive spaces -> consecutive
// hyphens, matching GitHub's anchor generation).
function slug(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s/g, "-");
}

function headingSlugs(text) {
  const slugs = new Set();
  for (const line of text.split("\n")) {
    const m = /^#{1,6}\s+(.+?)\s*$/.exec(line);
    if (m) slugs.add(slug(m[1]));
  }
  return slugs;
}

const LINK_RE = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

// M46 — deeper doc audit: anchor links must resolve to a real heading, and every
// cited `npm run <script>` must be a real package.json script.
describe("doc anchor links resolve to real headings (M46)", () => {
  it("every [text](#anchor) / [text](file.md#anchor) points at an existing heading", () => {
    const slugCache = new Map();
    const slugsFor = (file) => {
      if (!slugCache.has(file)) slugCache.set(file, headingSlugs(readFileSync(file, "utf8")));
      return slugCache.get(file);
    };

    const dead = [];
    for (const file of markdownFiles()) {
      const text = readFileSync(file, "utf8");
      let m;
      LINK_RE.lastIndex = 0;
      while ((m = LINK_RE.exec(text)) !== null) {
        const target = m[1];
        if (!target.includes("#")) continue;
        if (/^https?:/i.test(target)) continue;
        const [filePart, anchor] = target.split("#");
        if (!anchor) continue;
        const targetFile = filePart === "" ? file : resolve(dirname(file), filePart);
        if (!targetFile.endsWith(".md")) continue; // only audit markdown anchors
        let slugs;
        try {
          slugs = slugsFor(targetFile);
        } catch {
          dead.push(`${relative(REPO_ROOT, file)} -> ${target} (target file missing)`);
          continue;
        }
        if (!slugs.has(anchor.toLowerCase())) {
          dead.push(`${relative(REPO_ROOT, file)} -> #${anchor}`);
        }
      }
    }
    expect(dead, `dead anchors:\n${dead.join("\n")}`).toEqual([]);
  });

  it("every `npm run <script>` cited in docs is a real package.json script", () => {
    const bad = [];
    const re = /npm run ([a-zA-Z0-9:_-]+)/g;
    for (const file of markdownFiles()) {
      const text = readFileSync(file, "utf8");
      let m;
      while ((m = re.exec(text)) !== null) {
        if (!PKG.scripts?.[m[1]]) bad.push(`${relative(REPO_ROOT, file)}: npm run ${m[1]}`);
      }
    }
    expect(bad, `citations to missing scripts:\n${bad.join("\n")}`).toEqual([]);
  });
});
