/**
 * harvest-chatgpt.mjs — Parser for ChatGPT exported conversation JSON.
 *
 * ChatGPT exports a `conversations.json` file (zip → extract) containing an
 * array of conversation objects. Each conversation has a `mapping` of message
 * nodes, each node has a `message` with `author.role` and `content.parts`.
 *
 * This parser extracts meaningful utterances and turns them into
 * HarvestCandidate objects for the classifier.
 *
 * Usage:
 *   import { parseChatGPTExport } from "./harvest-chatgpt.mjs";
 *   const { source, candidates } = parseChatGPTExport(jsonString, filePath);
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Stable content-hash of a string for use as source ID.
 */
function contentHash(str) {
  return createHash("sha256").update(str).digest("hex").slice(0, 16);
}

/**
 * Flatten ChatGPT message tree into ordered [role, text] pairs.
 * The mapping is a DAG; we do a DFS from the root node.
 */
function flattenMessages(mapping) {
  // Find root(s) — nodes with no parent or parent is null
  const roots = Object.values(mapping).filter(
    n => !n.parent || !mapping[n.parent],
  );

  const messages = [];

  function walk(nodeId) {
    const node = mapping[nodeId];
    if (!node) return;
    const msg = node.message;
    if (msg && msg.author && msg.content) {
      const role = msg.author.role; // "user" | "assistant" | "system" | "tool"
      const parts = msg.content.parts ?? [];
      const text = parts
        .filter(p => typeof p === "string")
        .join("\n")
        .trim();
      if (text && role !== "system" && role !== "tool") {
        messages.push({ role, text });
      }
    }
    for (const childId of node.children ?? []) {
      walk(childId);
    }
  }

  for (const root of roots) {
    if (root.id) walk(root.id);
  }

  return messages;
}

/**
 * Split long assistant messages into sentence-level candidates.
 * We target individual statements that might contain durable knowledge.
 */
function splitIntoCandidates(text) {
  // Split on sentence boundaries (. ! ?) but keep minimum length
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length >= 30);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a ChatGPT export JSON string (one conversation object or array of them).
 *
 * @param {string} jsonString  Raw JSON from conversations.json or single conv.
 * @param {string} [filePath]  Original file path (for the source label).
 * @returns {{ source: import('./harvest-model.mjs').HarvestSource, candidates: import('./harvest-model.mjs').HarvestCandidate[] }[]}
 */
export function parseChatGPTExport(jsonString, filePath = "chatgpt-export.json") {
  let data;
  try {
    data = JSON.parse(jsonString);
  } catch {
    throw new Error(`harvest-chatgpt: invalid JSON in ${filePath}`);
  }

  const conversations = Array.isArray(data) ? data : [data];
  const results = [];

  for (const conv of conversations) {
    if (!conv || typeof conv !== "object") continue;

    const title = conv.title ?? "Untitled conversation";
    const convId = conv.id ?? contentHash(JSON.stringify(conv));
    const sourceId = `chatgpt:${convId}`;
    const importedAt = new Date().toISOString();

    /** @type {import('./harvest-model.mjs').HarvestSource} */
    const source = {
      id: sourceId,
      type: "chatgpt-export",
      label: `${title} (${filePath})`,
      importedAt,
      path: filePath,
    };

    const mapping = conv.mapping ?? {};
    const messages = Object.keys(mapping).length > 0
      ? flattenMessages(mapping)
      : [];

    const candidates = [];
    let turnIndex = 0;

    for (const { role, text } of messages) {
      // Only harvest user statements and assistant responses (not system)
      const snippets = splitIntoCandidates(text);
      for (const snippet of snippets) {
        candidates.push({
          sourceId,
          text: snippet,
          context: text.slice(0, 200),
          speakerRole: role,
          turnIndex,
        });
      }
      turnIndex++;
    }

    results.push({ source, candidates });
  }

  return results;
}

/**
 * Parse a conversations.json file path directly (reads from disk).
 * Used by the import CLI.
 *
 * @param {string} filePath
 * @returns {{ source: import('./harvest-model.mjs').HarvestSource, candidates: import('./harvest-model.mjs').HarvestCandidate[] }[]}
 */
export function parseChatGPTFile(filePath) {
  const json = readFileSync(filePath, "utf8");
  return parseChatGPTExport(json, filePath);
}
