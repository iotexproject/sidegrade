// Local log parsers for coding agents. Everything here is read-only and stays
// on-device: sidegrade never sends your prompts, code, file paths, or usage
// anywhere. We only read token *counts* from each agent's own session logs.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Minimal recursive file walk (no dependencies) that tolerates unreadable dirs.
function* walk(dir, filter) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full, filter);
    else if (filter(e.name)) yield full;
  }
}

function readLines(file, onObject) {
  let text;
  try { text = fs.readFileSync(file, "utf8"); } catch { return; }
  for (const line of text.split("\n")) {
    const s = line.trim();
    if (!s) continue;
    let obj;
    try { obj = JSON.parse(s); } catch { continue; }
    try { onObject(obj); } catch { /* one bad row must not abort the file */ }
  }
}

const inWindow = (ts, cutoffMs) => {
  if (!ts) return true; // undated rows are kept rather than silently dropped
  const t = Date.parse(ts);
  return Number.isNaN(t) ? true : t >= cutoffMs;
};

// Accumulate into a per-model token mix: { input, cacheCreate, cacheRead, output }.
function bump(map, model, mix) {
  const k = model || "unknown";
  const m = map.get(k) || { input: 0, cacheCreate: 0, cacheRead: 0, output: 0 };
  m.input += mix.input || 0; m.cacheCreate += mix.cacheCreate || 0;
  m.cacheRead += mix.cacheRead || 0; m.output += mix.output || 0;
  map.set(k, m);
}

// Claude Code: ~/.claude/projects/**/*.jsonl — assistant rows carry message.usage.
export function parseClaudeCode(cutoffMs) {
  const root = path.join(os.homedir(), ".claude", "projects");
  const byModel = new Map(); const days = new Set();
  for (const file of walk(root, (n) => n.endsWith(".jsonl"))) {
    readLines(file, (o) => {
      const msg = o.message || {};
      const u = msg.usage;
      if (!u || u.input_tokens === undefined) return;
      if (!inWindow(o.timestamp, cutoffMs)) return;
      bump(byModel, msg.model, {
        input: u.input_tokens, cacheCreate: u.cache_creation_input_tokens,
        cacheRead: u.cache_read_input_tokens, output: u.output_tokens,
      });
      if (o.timestamp) days.add(o.timestamp.slice(0, 10));
    });
  }
  return { agent: "Claude Code", byModel, days };
}

// Codex: ~/.codex/sessions/**/rollout-*.jsonl — token_count events + a model
// somewhere in the session's config/turn events.
export function parseCodex(cutoffMs) {
  const root = path.join(os.homedir(), ".codex", "sessions");
  const byModel = new Map(); const days = new Set();
  for (const file of walk(root, (n) => n.startsWith("rollout-") && n.endsWith(".jsonl"))) {
    let model = null;
    const rows = [];
    readLines(file, (o) => {
      const p = o.payload || {};
      const cand = p.model || (p.info && p.info.model) || o.model;
      if (cand && typeof cand === "string") model = cand;
      if (p.type === "token_count" && p.info) rows.push(o);
    });
    for (const o of rows) {
      if (!inWindow(o.timestamp, cutoffMs)) continue;
      const u = o.payload.info.last_token_usage || {};
      const cached = u.cached_input_tokens || 0;
      bump(byModel, model, {
        input: Math.max(0, (u.input_tokens || 0) - cached),
        cacheCreate: u.cache_write_input_tokens || 0,
        cacheRead: cached,
        output: u.output_tokens || 0,
      });
      if (o.timestamp) days.add(o.timestamp.slice(0, 10));
    }
  }
  return { agent: "Codex", byModel, days };
}

export function collect(days = 30) {
  const cutoffMs = Date.now() - days * 86400_000;
  return [parseClaudeCode(cutoffMs), parseCodex(cutoffMs)].filter((s) => s.byModel.size);
}
