#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_TEMPLATE_NAME = "mind-ontology";
export const DEFAULT_TARGET_DIR = ".agentctx";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "../..");
const TEMPLATES_ROOT = resolve(REPO_ROOT, "templates");

export function parseInitArgv(argv = process.argv.slice(2)) {
  const options = {
    cwd: process.cwd(),
    force: false,
    template: DEFAULT_TEMPLATE_NAME,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--cwd") {
      options.cwd = resolve(argv[++i] ?? options.cwd);
    } else if (arg === "--template") {
      options.template = argv[++i] ?? DEFAULT_TEMPLATE_NAME;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "-h" || arg === "--help") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

export function initAgentctx(options = {}) {
  const cwd = resolve(options.cwd ?? process.cwd());
  const templateName = options.template ?? DEFAULT_TEMPLATE_NAME;
  const templateDir = resolve(
    options.templatesRoot ?? TEMPLATES_ROOT,
    templateName,
    DEFAULT_TARGET_DIR,
  );
  const targetDir = resolve(cwd, DEFAULT_TARGET_DIR);

  if (!existsSync(templateDir)) {
    throw new Error(`Template not found: ${templateName}`);
  }

  if (existsSync(targetDir) && options.force !== true) {
    throw new Error(`${DEFAULT_TARGET_DIR}/ already exists. Re-run with --force to overwrite template files.`);
  }

  mkdirSync(cwd, { recursive: true });
  cpSync(templateDir, targetDir, { recursive: true, force: options.force === true });

  return {
    cwd,
    template: templateName,
    targetDir,
    files: listFiles(targetDir).map((file) => relative(cwd, file).replace(/\\/g, "/")),
  };
}

function listFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(path));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files.sort();
}

function printHelp() {
  return `agentctx init — scaffold a Mind Ontology .agentctx/ template.

Usage:
  npm run agentctx:init -- [options]
  node scripts/agentctx/init.mjs --cwd ./my-project

Options:
  --cwd <path>            Directory where .agentctx/ will be created. Default: cwd.
  --template <name>       Template name under templates/. Default: ${DEFAULT_TEMPLATE_NAME}.
  --force                 Overwrite template files when .agentctx/ already exists.
  -h, --help              Show this help message.
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseInitArgv();
    if (options.help) {
      process.stdout.write(printHelp());
      process.exit(0);
    }
    const result = initAgentctx(options);
    process.stdout.write(
      [
        `Created ${DEFAULT_TARGET_DIR}/ from template "${result.template}".`,
        `Target: ${result.targetDir}`,
        `Files: ${result.files.length}`,
        "",
      ].join("\n"),
    );
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
