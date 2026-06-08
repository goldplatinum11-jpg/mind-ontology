// Vitest config — minimal, standalone Mind Ontology product.
//
// Workaround: vitest's default ESM transform on Node 24 chokes on a
// `#!/usr/bin/env node` shebang line inside a `.mjs` module when that module
// is imported by a test. Several agentctx CLI scripts keep their shebang so
// they can be run directly (`node script.mjs` / `./script.mjs`). We strip the
// shebang at transform time only — the on-disk file is untouched.

import { defineConfig } from "vitest/config";

const SHEBANG_RE = /^#![^\n]*\n/;

/** @type {import('vite').Plugin} */
const stripShebangPlugin = {
  name: "mind-ontology-strip-shebang",
  enforce: "pre",
  transform(code, id) {
    if (!id.endsWith(".mjs") && !id.endsWith(".js")) return null;
    if (!code.startsWith("#!")) return null;
    return {
      code: code.replace(SHEBANG_RE, "// (shebang stripped at transform)\n"),
      map: null,
    };
  },
};

export default defineConfig({
  plugins: [stripShebangPlugin],
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", ".claude/**"],
  },
});
