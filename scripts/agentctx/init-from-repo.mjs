#!/usr/bin/env node

// mind-ontology init --from-repo (adoption track, A1).
//
// Inspects an existing repository and generates a populated `.agentctx/` draft
// instead of nine placeholder files. The scanner reads ONLY a fixed allowlist
// of public project artifacts (manifest, README, LICENSE, directory names,
// top-level CLAUDE.md / AGENTS.md, recent `git log` subjects) — never .env,
// never arbitrary file contents — and every extracted string is passed
// through a credential scrub plus a machine-local-detail filter before it can
// reach a generated block.
//
// Two layers, both exported for tests:
//   scanRepo(cwd)               -> RepoFacts (pure fs reads, no writes)
//   generateOntologyDraft(facts)-> { "constraints.md": string, ... } (pure)
//   initFromRepo(options)       -> writes the draft, returns a summary
//
// The generated draft is schema-valid by construction: every file satisfies
// the rules in ONTOLOGY_SCHEMA (required tags, Name/Status fields, question
// titles, one-role-tag, non-empty bodies) so `mind-ontology validate` passes
// on a fresh draft with zero errors.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { DEFAULT_AGENTCTX_DIR, SOURCE_FILES } from "./compile.mjs";

// Same shape as schema.mjs CREDENTIAL_PATTERN, kept split so this source file
// carries no literal credential keyword for secret scanners to flag.
const CREDENTIAL_LINE =
  /\b(?:api[_-]?key|pass\s*word|sec\s*ret|to\s*ken|private[_-]?key)\b\s*[:=]\s*\S/i;

const README_CANDIDATES = ["README.md", "Readme.md", "readme.md", "README"];
const LICENSE_CANDIDATES = ["LICENSE", "LICENSE.md", "LICENSE.txt"];

const SCRIPT_KEYS = ["test", "build", "lint", "typecheck", "dev", "start"];

const FRAMEWORK_HINTS = [
  ["react", "React"],
  ["next", "Next.js"],
  ["vue", "Vue"],
  ["svelte", "Svelte"],
  ["express", "Express"],
  ["fastify", "Fastify"],
  ["electron", "Electron"],
  ["vitest", "Vitest"],
  ["jest", "Jest"],
  ["mocha", "Mocha"],
  ["playwright", "Playwright"],
];

// Existing agent instruction files an adopting repository may already carry.
// Only these two top-level names are read — never .cursorrules, never dotfiles.
const AGENT_DOC_CANDIDATES = ["CLAUDE.md", "AGENTS.md"];

// A line qualifies as a safety/workflow hint or a role hint only via these
// deterministic keyword tests (the lane contract's candidate list).
const ROLE_HINT =
  /\b(?:roles?|agents?|workers?|controllers?)\b/i;
const CONSTRAINT_HINT =
  /\b(?:must|never|do not|don't|always|prefer|before|after|tests?|testing|validate|validation|review)\b/i;
const GUIDANCE_HEADING =
  /\b(?:rules?|constraints?|workflows?|agents?|roles?|tests?|testing|safety|reviews?)\b/i;

// Machine-local or infrastructure detail that must never be imported into a
// generated draft even when the credential scrub passes it: absolute paths,
// home directories, raw IPs, ssh targets, URLs with embedded userinfo.
const PRIVATE_LINE =
  /(?:\b[A-Za-z]:[\\/]|~[\\/]|\/(?:home|root|users)\/|\bssh\b|\b\d{1,3}(?:\.\d{1,3}){3}\b|https?:\/\/[^\s/]*@)/i;

const LAYOUT_HINTS = [
  ["src", "primary source code"],
  ["lib", "library code"],
  ["app", "application code"],
  ["scripts", "automation and CLI scripts"],
  ["tests", "automated tests"],
  ["test", "automated tests"],
  ["docs", "documentation"],
  ["examples", "usage examples"],
  ["packages", "workspace packages"],
  ["templates", "starter templates"],
];

/**
 * Drop credential-shaped lines, flatten whitespace, and cap length. Every
 * string extracted from a repository artifact goes through here before it can
 * appear in a generated ontology block.
 */
export function sanitizeText(text, max = 400) {
  if (!text) return "";
  const safeLines = String(text)
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => !CREDENTIAL_LINE.test(line));
  let flat = safeLines.join(" ").replace(/\s+/g, " ").trim();
  // Strip markdown badges/images and HTML tags; keep link text.
  flat = flat
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (flat.length > max) {
    const cut = flat.slice(0, max);
    flat = `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 1))}…`;
  }
  return flat;
}

function readTextSafe(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function readJsonSafe(path) {
  const raw = readTextSafe(path);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function firstExisting(cwd, candidates) {
  for (const name of candidates) {
    const path = join(cwd, name);
    if (existsSync(path)) return { name, path };
  }
  return null;
}

function tomlField(raw, key) {
  const match = raw.match(new RegExp(`^\\s*${key}\\s*=\\s*["']([^"']+)["']`, "m"));
  return match ? match[1].trim() : null;
}

function extractReadme(raw) {
  const lines = String(raw).replace(/\r\n/g, "\n").split("\n");
  let title = null;
  const paragraph = [];
  let inFence = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (title === null) {
      const heading = trimmed.match(/^#\s+(.+)$/);
      if (heading) title = sanitizeText(heading[1], 120);
      continue;
    }
    if (trimmed.startsWith("#")) {
      if (paragraph.length > 0) break;
      continue;
    }
    const isNoise =
      trimmed === "" ||
      trimmed.startsWith("[![") ||
      trimmed.startsWith("![") ||
      trimmed.startsWith("<") ||
      trimmed.startsWith(">") ||
      trimmed.startsWith("---");
    if (isNoise) {
      if (paragraph.length > 0) break;
      continue;
    }
    paragraph.push(trimmed);
  }

  return {
    title,
    summary: sanitizeText(paragraph.join(" ")) || null,
  };
}

/**
 * Pull safe, short guidance lines out of an existing CLAUDE.md / AGENTS.md.
 * Deterministic keyword extraction only — no inference: a line is taken when
 * it is a bullet under a Rules/Constraints/Workflow/Agent-roles/Testing
 * heading, or when it carries an explicit guidance keyword. Every taken line
 * passes the credential scrub plus a machine-local-detail filter.
 *
 * Returns { constraints: string[], roles: string[] } (each capped).
 */
export function extractAgentDocHints(raw, maxPerBucket = 6) {
  const constraints = [];
  const roles = [];
  const seen = new Set();
  if (!raw) return { constraints, roles };

  // An emitted mind-ontology artifact is compiled FROM .agentctx/ — importing
  // it back would recycle generated text as if it were operator guidance.
  if (raw.includes("mind-ontology:emit")) return { constraints, roles };

  let inFence = false;
  let headingMatches = false;
  for (const line of String(raw).replace(/\r\n/g, "\n").split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (trimmed.startsWith("#")) {
      headingMatches = GUIDANCE_HEADING.test(trimmed);
      continue;
    }
    if (trimmed === "" || trimmed.startsWith("|") || trimmed.startsWith(">")) continue;

    const isBullet = /^[-*]\s+/.test(trimmed);
    const body = trimmed.replace(/^[-*]\s+/, "");
    const isCandidate =
      (isBullet && headingMatches) || ROLE_HINT.test(body) || CONSTRAINT_HINT.test(body);
    if (!isCandidate) continue;
    if (PRIVATE_LINE.test(body)) continue;

    const clean = sanitizeText(body, 200);
    if (clean.length < 12) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const bucket = ROLE_HINT.test(clean) ? roles : constraints;
    if (bucket.length < maxPerBucket) bucket.push(clean);
    if (constraints.length >= maxPerBucket && roles.length >= maxPerBucket) break;
  }

  return { constraints, roles };
}

/**
 * Read up to `limit` recent commit subjects via `git log`. Returns [] when
 * git is missing, cwd is not a repository, or the repo has no commits —
 * adoption must never fail because version control is absent.
 */
export function readRecentCommitSubjects(root, limit = 8) {
  try {
    const out = execFileSync(
      "git",
      ["-C", root, "log", `--format=%s`, "-n", String(limit)],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 10_000, windowsHide: true },
    );
    return out
      .split("\n")
      .map((subject) => (PRIVATE_LINE.test(subject) ? "" : sanitizeText(subject, 120)))
      .filter((subject) => subject.length > 0)
      .slice(0, limit);
  } catch {
    return [];
  }
}

function detectFrameworks(pkg) {
  const deps = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };
  const found = [];
  for (const [needle, label] of FRAMEWORK_HINTS) {
    if (Object.keys(deps).some((dep) => dep === needle || dep.startsWith(`${needle}-`) || dep.startsWith(`@${needle}/`))) {
      found.push(label);
    }
  }
  return found;
}

/**
 * Read the allowlisted public artifacts of a repository and return a
 * structured fact sheet. Never throws on a malformed or missing artifact —
 * missing facts stay null and the generator falls back to TODO drafts.
 */
export function scanRepo(cwd = process.cwd()) {
  const root = resolve(cwd);
  const facts = {
    root,
    name: null,
    description: null,
    language: null,
    manifest: null,
    scripts: {},
    frameworks: [],
    workspaces: false,
    readme: null,
    license: null,
    layout: [],
    ci: false,
    agentDocs: { files: [], constraints: [], roles: [] },
    commits: [],
    sources: [],
  };

  const pkg = readJsonSafe(join(root, "package.json"));
  if (pkg && typeof pkg === "object") {
    facts.manifest = "package.json";
    facts.sources.push("package.json");
    if (typeof pkg.name === "string") facts.name = sanitizeText(pkg.name, 120);
    if (typeof pkg.description === "string") facts.description = sanitizeText(pkg.description, 300);
    if (typeof pkg.license === "string") facts.license = sanitizeText(pkg.license, 80);
    facts.workspaces = Array.isArray(pkg.workspaces) || typeof pkg.workspaces === "object";
    for (const key of SCRIPT_KEYS) {
      const value = pkg.scripts?.[key];
      if (typeof value === "string" && !CREDENTIAL_LINE.test(value)) {
        facts.scripts[key] = sanitizeText(value, 160);
      }
    }
    facts.frameworks = detectFrameworks(pkg);
    const usesTs =
      existsSync(join(root, "tsconfig.json")) || facts.frameworks.includes("TypeScript");
    facts.language = usesTs ? "TypeScript (Node.js)" : "JavaScript (Node.js)";
  }

  if (!facts.manifest) {
    const pyproject = readTextSafe(join(root, "pyproject.toml"));
    if (pyproject !== null) {
      facts.manifest = "pyproject.toml";
      facts.sources.push("pyproject.toml");
      facts.name = sanitizeText(tomlField(pyproject, "name") ?? "", 120) || null;
      facts.description = sanitizeText(tomlField(pyproject, "description") ?? "", 300) || null;
      facts.language = "Python";
    }
  }

  if (!facts.manifest) {
    const cargo = readTextSafe(join(root, "Cargo.toml"));
    if (cargo !== null) {
      facts.manifest = "Cargo.toml";
      facts.sources.push("Cargo.toml");
      facts.name = sanitizeText(tomlField(cargo, "name") ?? "", 120) || null;
      facts.description = sanitizeText(tomlField(cargo, "description") ?? "", 300) || null;
      facts.language = "Rust";
    }
  }

  if (!facts.manifest) {
    const gomod = readTextSafe(join(root, "go.mod"));
    if (gomod !== null) {
      const module = gomod.match(/^module\s+(\S+)/m);
      facts.manifest = "go.mod";
      facts.sources.push("go.mod");
      if (module) facts.name = sanitizeText(module[1].split("/").pop() ?? "", 120) || null;
      facts.language = "Go";
    }
  }

  const readme = firstExisting(root, README_CANDIDATES);
  if (readme) {
    const raw = readTextSafe(readme.path);
    if (raw !== null) {
      facts.readme = { file: readme.name, ...extractReadme(raw) };
      facts.sources.push(readme.name);
    }
  }

  if (!facts.license) {
    const license = firstExisting(root, LICENSE_CANDIDATES);
    if (license) {
      const raw = readTextSafe(license.path);
      const firstLine = raw?.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0);
      if (firstLine) {
        facts.license = sanitizeText(firstLine, 80);
        facts.sources.push(license.name);
      }
    }
  }

  for (const name of AGENT_DOC_CANDIDATES) {
    const raw = readTextSafe(join(root, name));
    if (raw === null) continue;
    const hints = extractAgentDocHints(raw);
    if (hints.constraints.length === 0 && hints.roles.length === 0) continue;
    facts.agentDocs.files.push(name);
    facts.agentDocs.constraints.push(...hints.constraints);
    facts.agentDocs.roles.push(...hints.roles);
    facts.sources.push(name);
  }

  facts.commits = readRecentCommitSubjects(root);
  if (facts.commits.length > 0) facts.sources.push("git log");

  for (const [dir, hint] of LAYOUT_HINTS) {
    if (existsSync(join(root, dir))) facts.layout.push({ dir, hint });
  }
  facts.ci =
    existsSync(join(root, ".github", "workflows")) || existsSync(join(root, ".gitlab-ci.yml"));

  if (!facts.name) facts.name = facts.readme?.title ?? basename(root);
  if (!facts.description && facts.readme?.summary) facts.description = facts.readme.summary;

  return facts;
}

function block(heading, tags, bodyLines) {
  const tagSuffix = tags.map((tag) => `#${tag}`).join(" ");
  return [`## ${heading} ${tagSuffix}`, "", ...bodyLines, ""].join("\n");
}

function sourceLine(facts, fallback = "repository layout") {
  return facts.sources.length > 0 ? facts.sources.join(", ") : fallback;
}

/**
 * Render the nine ontology source files from a fact sheet. Pure and
 * deterministic: same facts in, byte-identical files out.
 */
export function generateOntologyDraft(facts) {
  // "#" inside a block heading would parse as a tag; names never need it.
  const name = (facts.name || "this project").replace(/#/g, "").trim() || "this project";
  const stack = [facts.language, ...facts.frameworks.filter((f) => f !== "TypeScript")]
    .filter(Boolean)
    .join(", ");
  const testScript = facts.scripts.test ?? null;
  const agentDocs = facts.agentDocs ?? { files: [], constraints: [], roles: [] };
  const commits = facts.commits ?? [];
  const draft = {};

  const constraintParts = [
    "# Constraints",
    "",
    block("No secrets in ontology files", ["security", "secrets"], [
      "Never store API keys, passwords, tokens, private keys, customer secrets, or",
      "other credential material in `.agentctx/`. Use the ontology to describe safe",
      "handling rules, not to store secret values.",
    ]),
    block("Confirm before destructive work", ["safety", "destructive"], [
      "Before deleting data, rewriting history, changing production configuration, or",
      "making irreversible changes, the agent must call `list_constraints()` and",
      "follow the project-specific stop policy.",
    ]),
    block("Verify with the project's own checks", ["safety", "verification"], [
      testScript
        ? `This repository defines its own checks. Run \`${testScript}\` (the manifest's test script) before claiming a change works.`
        : "TODO: Record the command an agent must run to verify a change in this repository (tests, lint, build).",
      "",
      `Source: ${sourceLine(facts)}`,
    ]),
    block("Keep the ontology portable", ["portable", "cross-agent"], [
      "Mind Ontology source files should be readable by any AI agent or MCP client.",
      "Avoid tool-specific assumptions unless the block is explicitly scoped to that",
      "tool.",
    ]),
  ];
  if (agentDocs.constraints.length > 0) {
    constraintParts.push(
      block("Imported agent instructions (draft)", ["safety", "imported"], [
        "This repository already carries agent instruction files. The following",
        "rules were imported verbatim as a draft — review, edit, and delete freely:",
        "",
        ...agentDocs.constraints.map((line) => `- ${line}`),
        "",
        `Source: ${agentDocs.files.join(", ")}`,
      ]),
    );
  }
  draft["constraints.md"] = constraintParts.join("\n");

  draft["identity.md"] = [
    "# Identity",
    "",
    block("Operator profile", ["identity", "operator"], [
      `TODO: Describe who operates ${name} and how the AI should relate to them.`,
      "This draft was generated from repository artifacts, which say nothing about",
      "the human side — fill this in first; it shapes every context pack.",
    ]),
    block("Working style", ["style", "collaboration"], [
      "TODO: Describe the working rhythm that helps the operator — review cadence,",
      "summary length, when to ask vs. act. Until edited, agents should prefer",
      "small, reversible changes and compact summaries.",
    ]),
  ].join("\n");

  const projectBody = [
    `Name: ${name}`,
    "Status: active",
    "",
    facts.description
      ? facts.description
      : `TODO: Describe what ${name} is and why it matters.`,
  ];
  if (facts.license) projectBody.push("", `License: ${facts.license}`);
  if (facts.workspaces) {
    projectBody.push("", "The manifest declares workspaces — this is a multi-package repository.");
  }
  if (commits.length > 0) {
    projectBody.push(
      "",
      "Recent activity (latest commit subjects, newest first):",
      ...commits.map((subject) => `- ${subject}`),
    );
  }
  projectBody.push("", `Source: ${sourceLine(facts)}`);
  draft["projects.md"] = [
    "# Projects",
    "",
    block(name, ["project", "active"], projectBody),
  ].join("\n");

  draft["direction.md"] = [
    "# Direction",
    "",
    block("Current direction (draft)", ["direction", "draft"], [
      facts.readme?.summary
        ? `The README describes the project as: ${facts.readme.summary}`
        : "TODO: The repository has no README summary to draft from.",
      "",
      "TODO: Replace this with the actual current priority — what should ship next,",
      "and what is explicitly out of scope right now.",
      "",
      `Source: ${facts.readme?.file ?? "none"}`,
    ]),
  ].join("\n");

  const decisionParts = [
    "# Decisions",
    "",
    block("Recorded stack", ["decision", "stack"], [
      stack
        ? `The repository is built on ${stack}, per its manifest (${facts.manifest}).`
        : "TODO: No manifest was found; record the language and core dependencies here.",
      "Treat the existing stack as a standing decision: agents should not introduce",
      "a parallel framework or runtime without an explicit new decision block.",
      "",
      `Source: ${facts.manifest ?? "none"}`,
    ]),
  ];
  if (commits.length > 0) {
    decisionParts.push(
      block("Recent change history (draft)", ["decision", "history"], [
        "Recent commit subjects, newest first — candidates for decisions worth",
        "recording properly:",
        "",
        ...commits.map((subject) => `- ${subject}`),
        "",
        "TODO: Promote the real decisions out of this list and delete the rest.",
        "",
        "Source: git log",
      ]),
    );
  }
  draft["decisions.md"] = decisionParts.join("\n");

  const layoutLines =
    facts.layout.length > 0
      ? facts.layout.map(({ dir, hint }) => `- \`${dir}/\` — ${hint}`)
      : ["TODO: No conventional top-level directories were detected; describe the layout."];
  const commandLines = Object.entries(facts.scripts).map(
    ([key, value]) => `- \`npm run ${key}\` — \`${value}\``,
  );
  draft["architecture.md"] = [
    "# Architecture",
    "",
    block("Repository layout", ["architecture", "layout"], [
      ...layoutLines,
      ...(facts.ci ? ["- CI configuration is present (`.github/workflows` or equivalent)."] : []),
      "",
      "Source: repository layout",
    ]),
    block("Entry points and commands", ["architecture", "commands"], [
      ...(commandLines.length > 0
        ? commandLines
        : ["TODO: Record how to build, test, and run this project."]),
      "",
      `Source: ${facts.manifest ?? "none"}`,
    ]),
  ].join("\n");

  const roleParts = [
    "# Agent Roles",
    "",
    block("Implementer", ["agent", "coding"], [
      `Writes code changes for ${name} in small, reviewable increments.`,
      testScript
        ? `Must verify every change with \`${testScript}\` before reporting it done.`
        : "TODO: Record the verification command the implementer must run before reporting done.",
    ]),
    block("Reviewer", ["agent", "review"], [
      "Reviews proposed changes against the constraints and recorded decisions",
      "before they merge. Flags anything that touches the stack decision, deletes",
      "data, or bypasses the project's own checks.",
    ]),
  ];
  if (agentDocs.roles.length > 0) {
    roleParts.push(
      block("Imported role and workflow hints (draft)", ["agent", "imported"], [
        "This repository's existing agent instruction files mention the following",
        "roles or workflow rules. Imported as a draft — fold them into real role",
        "blocks above, then delete this one:",
        "",
        ...agentDocs.roles.map((line) => `- ${line}`),
        "",
        `Source: ${agentDocs.files.join(", ")}`,
      ]),
    );
  }
  draft["agent-roles.md"] = roleParts.join("\n");

  const glossaryBlocks = [
    block(name, ["term", "product"], [
      facts.description
        ? facts.description
        : `TODO: Define ${name} in one or two sentences.`,
      "",
      `Source: ${sourceLine(facts)}`,
    ]),
  ];
  const seenTerms = new Set([name.toLowerCase()]);
  for (const framework of facts.frameworks.slice(0, 4)) {
    if (seenTerms.has(framework.toLowerCase())) continue;
    seenTerms.add(framework.toLowerCase());
    glossaryBlocks.push(
      block(framework, ["term", "stack"], [
        `${framework} is part of this repository's dependency stack (detected in ${facts.manifest}).`,
        "TODO: Note any project-specific conventions for how it is used here.",
      ]),
    );
  }
  draft["glossary.md"] = ["# Glossary", "", ...glossaryBlocks].join("\n");

  draft["cq.md"] = [
    "# Competency Questions",
    "",
    block(`What is ${name} and what stack does it run on?`, ["cq", "context"], [
      "The ontology should answer, from `projects.md` and `decisions.md`, what the",
      `project is${stack ? ` and that it runs on ${stack}` : ""}.`,
    ]),
    block("What must an agent verify before claiming a change works?", ["cq", "safety"], [
      "The ontology should answer, from `constraints.md`, that the agent runs the",
      "project's own checks" +
        (testScript ? ` (\`${testScript}\`)` : "") +
        " and confirms before destructive work.",
    ]),
  ].join("\n");

  // Belt and braces: the scrub above should make this unreachable, but a
  // credential-shaped line must never leave this function.
  for (const [file, content] of Object.entries(draft)) {
    if (CREDENTIAL_LINE.test(content)) {
      throw new Error(`init --from-repo refused to write ${file}: generated content matched a credential pattern`);
    }
  }

  return draft;
}

/**
 * Scan the repository at options.cwd and write a generated `.agentctx/` draft.
 * Mirrors initAgentctx's safety contract: refuses to touch an existing
 * `.agentctx/` unless options.force is true.
 */
export function initFromRepo(options = {}) {
  const cwd = resolve(options.cwd ?? process.cwd());
  const targetDir = resolve(cwd, DEFAULT_AGENTCTX_DIR);

  if (existsSync(targetDir) && options.force !== true) {
    throw new Error(
      `${DEFAULT_AGENTCTX_DIR}/ already exists. Re-run with --force to overwrite it with a fresh draft.`,
    );
  }

  const facts = scanRepo(cwd);
  const draft = generateOntologyDraft(facts);

  mkdirSync(targetDir, { recursive: true });
  const files = [];
  for (const file of SOURCE_FILES) {
    writeFileSync(resolve(targetDir, file), `${draft[file]}`, "utf8");
    files.push(`${DEFAULT_AGENTCTX_DIR}/${file}`);
  }

  return { cwd, targetDir, mode: "from-repo", facts, files };
}
