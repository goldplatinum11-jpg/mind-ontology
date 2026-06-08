#!/usr/bin/env node

// Mind Ontology task-risk classification (Phase 2 / P2-PR09).
//
// A task that deletes data, rewrites history, deploys, or changes production
// structure needs the ontology's safety guidance forced into its context pack
// even if the task wording does not lexically match a safety block. This module
// classifies a task as "safe" or "risky" so the compiler can adjust what it
// forces in. Classification is conservative and keyword-driven: it only flags
// clearly destructive/structural intent, so ordinary build tasks stay "safe".

// Single-word destructive/structural signals (matched as whole, lower-cased
// tokens so "resetting" or "deletes" also hit via the stem list below).
export const RISK_WORDS = new Set([
  "delete",
  "deletes",
  "deleting",
  "drop",
  "drops",
  "truncate",
  "truncating",
  "destroy",
  "destroys",
  "destructive",
  "wipe",
  "purge",
  "overwrite",
  "overwriting",
  "migrate",
  "migration",
  "migrations",
  "deploy",
  "deploys",
  "deployment",
  "irreversible",
  "uninstall",
  "downgrade",
  "revoke",
  "production",
  "prod",
]);

// Multi-word / punctuated phrases matched as substrings of the lower-cased task.
export const RISK_PHRASES = [
  "force push",
  "force-push",
  "rm -rf",
  "schema change",
  "data loss",
  "rewrite history",
  "drop table",
  "delete from",
];

const WORD_SPLIT = /[^a-z0-9-]+/;

/**
 * Classify a task's risk from its wording and scopes.
 * @returns {{ level: "safe"|"risky", signals: string[] }}
 */
export function classifyTaskRisk(task = "", scopes = []) {
  const haystack = `${task} ${scopes.join(" ")}`.toLowerCase();
  const signals = [];

  for (const phrase of RISK_PHRASES) {
    if (haystack.includes(phrase)) signals.push(phrase);
  }

  for (const token of haystack.split(WORD_SPLIT)) {
    if (token && RISK_WORDS.has(token) && !signals.includes(token)) {
      signals.push(token);
    }
  }

  return { level: signals.length > 0 ? "risky" : "safe", signals };
}

/**
 * Resolve the effective risk level given an explicit mode.
 * mode "auto" classifies; "safe"/"risky" force the level.
 */
export function resolveRiskLevel(mode, task, scopes) {
  if (mode === "safe" || mode === "risky") {
    return { level: mode, mode, signals: mode === "risky" ? ["forced"] : [] };
  }
  const { level, signals } = classifyTaskRisk(task, scopes);
  return { level, mode: "auto", signals };
}
