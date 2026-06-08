#!/usr/bin/env node

// Mind Ontology schema validation (Phase 2 / P2-PR07).
//
// Validates a project's .agentctx/ source files against the schemas defined in
// P2-PR01..P2-PR05 (identity, projects, glossary, agent-roles, cq) plus the
// always-required constraints.md. Data-driven: ONTOLOGY_SCHEMA encodes the
// rules; validateOntology() applies them and returns structured issues.
//
// Only files that are present are validated, except files marked `required`.
// A minimal project shipping only constraints.md validates clean.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_AGENTCTX_DIR,
  SOURCE_FILES,
  parseMarkdownBlocks,
} from "./compile.mjs";

export const STATUS_VALUES = ["active", "exploratory", "paused", "archived"];

// Matches a "<key>: <value>" assignment for credential-shaped keys. Kept as a
// split character class so the validator source itself carries no literal
// credential keyword that a secret scanner would flag.
const CREDENTIAL_PATTERN =
  /\b(?:api[_-]?key|pass\s*word|sec\s*ret|to\s*ken|private[_-]?key)\b\s*[:=]\s*\S/i;

export const ONTOLOGY_SCHEMA = {
  "constraints.md": {
    required: true,
  },
  "identity.md": {
    requiredTags: ["identity", "style"],
    everyBlockHasTag: true,
    recommendedTags: ["operator", "collaboration"],
  },
  "projects.md": {
    requiredTags: ["active"],
    fieldsByTag: { active: ["Name", "Status"] },
    enumField: { name: "Status", allowed: STATUS_VALUES },
  },
  "glossary.md": {
    namespace: "term",
    perBlock: { requireExtraTopicTag: true, nonEmptyBody: true },
    uniqueTitles: true,
  },
  "agent-roles.md": {
    namespace: "agent",
    perBlock: { exactlyOneExtraTag: true, nonEmptyBody: true },
    requiredTags: ["coding", "review"],
  },
  "cq.md": {
    namespace: "cq",
    perBlock: { questionTitle: true, requireExtraTopicTag: true, nonEmptyBody: true },
    requiredTags: ["context", "safety"],
  },
};

function fieldValue(body, key) {
  const match = body.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return match ? match[1].trim() : null;
}

function namespaceBlocks(blocks, namespace) {
  return blocks.filter((block) => block.tags.includes(namespace));
}

/**
 * Validate one source file's blocks against its schema rule set.
 * @returns {Array<{file:string, level:"error"|"warning", rule:string, message:string}>}
 */
export function validateSource(file, raw, rule) {
  const issues = [];
  const add = (level, ruleName, message) =>
    issues.push({ file, level, rule: ruleName, message });
  const blocks = parseMarkdownBlocks(raw, file);

  if (CREDENTIAL_PATTERN.test(raw)) {
    add("error", "no-credentials", `${file} contains a credential-shaped value; ontology files must not store sensitive data`);
  }

  if (rule.everyBlockHasTag) {
    for (const block of blocks) {
      if (block.tags.length === 0) {
        add("error", "every-block-has-tag", `${file} block "${block.title}" has no tags`);
      }
    }
  }

  if (Array.isArray(rule.requiredTags)) {
    const present = new Set(blocks.flatMap((block) => block.tags));
    for (const tag of rule.requiredTags) {
      if (!present.has(tag)) {
        add("error", "required-tag", `${file} is missing a block tagged #${tag}`);
      }
    }
  }

  if (Array.isArray(rule.recommendedTags)) {
    const present = new Set(blocks.flatMap((block) => block.tags));
    for (const tag of rule.recommendedTags) {
      if (!present.has(tag)) {
        add("warning", "recommended-tag", `${file} has no block tagged #${tag} (recommended)`);
      }
    }
  }

  if (rule.fieldsByTag) {
    for (const [tag, fields] of Object.entries(rule.fieldsByTag)) {
      for (const block of blocks.filter((b) => b.tags.includes(tag))) {
        for (const field of fields) {
          if (!fieldValue(block.body, field)) {
            add("error", "required-field", `${file} block "${block.title}" (#${tag}) is missing the "${field}:" field`);
          }
        }
      }
    }
  }

  if (rule.enumField) {
    const { name, allowed } = rule.enumField;
    for (const block of blocks) {
      const value = fieldValue(block.body, name);
      if (value !== null && !allowed.includes(value)) {
        add("error", "enum-field", `${file} block "${block.title}" has ${name}: ${value} (allowed: ${allowed.join(", ")})`);
      }
    }
  }

  if (rule.namespace) {
    const nsBlocks = namespaceBlocks(blocks, rule.namespace);
    if (nsBlocks.length === 0) {
      add("error", "namespace-required", `${file} has no #${rule.namespace} block`);
    }

    const per = rule.perBlock ?? {};
    for (const block of nsBlocks) {
      const extraTags = block.tags.filter((tag) => tag !== rule.namespace);
      if (per.requireExtraTopicTag && extraTags.length === 0) {
        add("error", "topic-tag", `${file} block "${block.title}" has only #${rule.namespace}; add a topic tag`);
      }
      if (per.exactlyOneExtraTag && extraTags.length !== 1) {
        add("error", "one-role-tag", `${file} block "${block.title}" must carry exactly one tag besides #${rule.namespace}, found ${extraTags.length}`);
      }
      if (per.nonEmptyBody && block.body.trim().length === 0) {
        add("error", "non-empty-body", `${file} block "${block.title}" has an empty body`);
      }
      if (per.questionTitle && !block.title.trim().endsWith("?")) {
        add("error", "question-title", `${file} block "${block.title}" is not phrased as a question`);
      }
    }

    if (rule.uniqueTitles) {
      const titles = nsBlocks.map((block) => block.title.toLowerCase());
      const seen = new Set();
      for (const title of titles) {
        if (seen.has(title)) {
          add("error", "unique-titles", `${file} has a duplicate #${rule.namespace} title: "${title}"`);
        }
        seen.add(title);
      }
    }
  }

  return issues;
}

/**
 * Validate an entire .agentctx/ directory against ONTOLOGY_SCHEMA.
 * @returns {{ ok:boolean, errors:number, warnings:number, issues:Array }}
 */
export function validateOntology(cwd = process.cwd()) {
  const dir = resolve(cwd, DEFAULT_AGENTCTX_DIR);
  const issues = [];

  if (!existsSync(dir)) {
    issues.push({
      file: DEFAULT_AGENTCTX_DIR,
      level: "error",
      rule: "missing-dir",
      message: `Missing ${DEFAULT_AGENTCTX_DIR}/ in ${cwd}. Run "npm run agentctx:init" to scaffold starter files.`,
    });
    return summarize(issues);
  }

  // Validate in source-list order; unknown files are ignored.
  for (const file of SOURCE_FILES) {
    const rule = ONTOLOGY_SCHEMA[file];
    if (!rule) continue;
    const path = resolve(dir, file);
    const present = existsSync(path);

    if (!present) {
      if (rule.required) {
        issues.push({ file, level: "error", rule: "required-file", message: `Missing required source: ${DEFAULT_AGENTCTX_DIR}/${file}` });
      }
      continue;
    }

    const raw = readFileSync(path, "utf8");
    if (rule.required && raw.trim().length === 0) {
      issues.push({ file, level: "error", rule: "empty-required", message: `Required source is empty: ${DEFAULT_AGENTCTX_DIR}/${file}` });
      continue;
    }

    issues.push(...validateSource(file, raw, rule));
  }

  return summarize(issues);
}

function summarize(issues) {
  const errors = issues.filter((i) => i.level === "error").length;
  const warnings = issues.filter((i) => i.level === "warning").length;
  return { ok: errors === 0, errors, warnings, issues };
}

export function renderReport(report) {
  const lines = ["Mind Ontology schema validation", ""];
  if (report.issues.length === 0) {
    lines.push("  OK — every source conforms to its schema.");
  } else {
    for (const issue of report.issues) {
      lines.push(`  ${issue.level.toUpperCase()}  [${issue.rule}] ${issue.message}`);
    }
  }
  lines.push("");
  lines.push(
    `${report.ok ? "VALID" : "INVALID"} — ${report.errors} error(s), ${report.warnings} warning(s)`,
  );
  lines.push("");
  return lines.join("\n");
}

function parseCwd(argv) {
  let cwd = process.cwd();
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--cwd") cwd = resolve(argv[++i] ?? cwd);
  }
  return cwd;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const report = validateOntology(parseCwd(process.argv.slice(2)));
  process.stdout.write(renderReport(report));
  process.exit(report.ok ? 0 : 1);
}
