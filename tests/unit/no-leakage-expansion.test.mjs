import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveAdapterFlags } from "../../scripts/agentctx/adapters/flags.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const r = (p) => resolve(REPO_ROOT, p);

// Credential-shaped assignment, split so this file carries no literal keyword.
const CREDENTIAL_PATTERN = /\b(?:api[_-]?key|pass\s*word|sec\s*ret|to\s*ken|private[_-]?key|authorization)\b\s*[:=]\s*["'][^"']{6,}/i;
// Real hosted endpoints that must never be shipped as enabled defaults.
const HOSTED_ENDPOINT_PATTERN = /https:\/\/[a-z0-9.-]*\.workers\.dev|connector\.sirtai\.org|https:\/\/[a-z0-9.-]*sirt[a-z0-9.-]*\.(?:com|dev|net|org|io)/i;

// M20 — extend the hosted-boundary no-leakage audit beyond scripts/agentctx/adapters
// to the package manifest and the connector/client setup examples a user actually copies.
function setupFiles() {
  const dir = r("docs/agentctx-setup");
  return readdirSync(dir).map((f) => ({ file: `docs/agentctx-setup/${f}`, text: readFileSync(resolve(dir, f), "utf8") }));
}

const PACKAGE = { file: "package.json", text: readFileSync(r("package.json"), "utf8") };
const AUDIT_SCOPE = [PACKAGE, ...setupFiles()];

describe("no-leakage audit expansion: package + setup examples (M20)", () => {
  it("no audited file embeds a credential value", () => {
    for (const { file, text } of AUDIT_SCOPE) {
      expect(CREDENTIAL_PATTERN.test(text), `${file} embeds a credential`).toBe(false);
    }
  });

  it("no audited file ships a real hosted endpoint", () => {
    for (const { file, text } of AUDIT_SCOPE) {
      expect(HOSTED_ENDPOINT_PATTERN.test(text), `${file} ships a real hosted endpoint`).toBe(false);
    }
  });

  it("package scripts run nothing networked or deploy-shaped", () => {
    const pkg = JSON.parse(PACKAGE.text);
    for (const [name, cmd] of Object.entries(pkg.scripts ?? {})) {
      expect(/\b(curl|wget|fetch|wrangler|deploy|publish|npm\s+publish)\b/i.test(cmd), `script "${name}" is networked/deploy-shaped: ${cmd}`).toBe(false);
    }
    // License is settled (Apache-2.0); publishing stays gated by `private`.
    expect(pkg.license).toBe("Apache-2.0");
    expect(pkg.private).toBe(true);
  });

  it("adapter flags default OFF with the real default environment", () => {
    const flags = resolveAdapterFlags({});
    expect(flags.memoryRetrieval).toBe(false);
    expect(flags.writebackProposals).toBe(false);
  });

  it("the product surface frames hosted memory as off-by-default / contract-only (M16)", () => {
    const readme = readFileSync(r("README.md"), "utf8").toLowerCase();
    expect(readme).toContain("off by default");
    expect(readme).toContain("fail-closed");
    // The README's capability table marks the hosted on-ramp as contracts only.
    expect(readme).toContain("contracts only");
  });
});
