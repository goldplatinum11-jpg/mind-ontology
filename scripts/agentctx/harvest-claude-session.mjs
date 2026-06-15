/**
 * harvest-claude-session.mjs — Parser for Claude Code JSONL session transcripts.
 *
 * Claude Code stores sessions at:
 *   ~/.claude/projects/<project-hash>/<session-id>.jsonl
 *
 * Each line is a JSON object. Relevant types:
 *   "user"      — human turn  (message.content: string or array)
 *   "assistant" — agent turn  (message.content: array of text/thinking/tool_use blocks)
 *
 * Returns a single { source, candidates } pair (one session = one source).
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function contentHash(str) {
  return createHash("sha256").update(str).digest("hex").slice(0, 16);
}

/**
 * Extract plain text from a Claude Code message content value.
 * content is either a string (user messages) or an array of blocks (assistant).
 */
function extractText(content) {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .filter(b => b.type === "text" && typeof b.text === "string")
    .map(b => b.text)
    .join("\n")
    .trim();
}

/**
 * Split text into sentence-level candidates (≥ 30 chars each).
 */
function splitIntoCandidates(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length >= 30);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a Claude Code JSONL transcript file into harvest candidates.
 *
 * @param {string} jsonlPath   Absolute path to the .jsonl transcript file.
 * @returns {{ source: import('./harvest-model.mjs').HarvestSource,
 *             candidates: import('./harvest-model.mjs').HarvestCandidate[] }}
 */
export function parseClaudeSession(jsonlPath) {
  const raw = readFileSync(jsonlPath, "utf8");
  const lines = raw.split("\n").filter(Boolean);

  // Derive session ID from filename if not found in records
  const fileBase = basename(jsonlPath, ".jsonl");

  let sessionId = fileBase;
  const messages = [];

  for (const line of lines) {
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }

    // Capture session ID from any record that has it
    if (record.sessionId && sessionId === fileBase) {
      sessionId = record.sessionId;
    }

    const role = record.type; // "user" | "assistant"
    if (role !== "user" && role !== "assistant") continue;

    const text = extractText(record.message?.content ?? "");
    if (!text) continue;

    messages.push({ role, text });
  }

  const sourceId = `claude-session:${sessionId}`;
  const importedAt = new Date().toISOString();

  /** @type {import('./harvest-model.mjs').HarvestSource} */
  const source = {
    id: sourceId,
    type: "claude-session",
    label: `Claude session ${sessionId.slice(0, 8)} (${basename(jsonlPath)})`,
    importedAt,
    path: jsonlPath,
  };

  const candidates = [];
  let turnIndex = 0;

  for (const { role, text } of messages) {
    const snippets = splitIntoCandidates(text);
    for (const snippet of snippets) {
      candidates.push({
        sourceId,
        text: snippet,
        context: text.slice(0, 200),
        speakerRole: role === "user" ? "user" : "assistant",
        turnIndex,
      });
    }
    turnIndex++;
  }

  return { source, candidates };
}
