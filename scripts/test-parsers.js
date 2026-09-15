#!/usr/bin/env node
// Verifies parsers against realistic fixtures. The OpenCode fixture mirrors the
// released v1.18.31 message schema (metadata.assistant.tokens), since we can't
// assume a live OpenCode install in CI.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sidegrade-test-"));
const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), "sidegrade-hermes-"));
const now = Date.now();
const msgDir = path.join(tmp, "opencode", "storage", "session", "message", "ses_1");
fs.mkdirSync(msgDir, { recursive: true });
fs.writeFileSync(path.join(msgDir, "msg_1.json"), JSON.stringify({
  id: "msg_1", role: "assistant", parts: [],
  metadata: {
    time: { created: now, completed: now },
    sessionID: "ses_1",
    assistant: {
      system: [], modelID: "claude-sonnet-5", providerID: "anthropic",
      path: { cwd: "/x", root: "/x" }, cost: 0.01,
      tokens: { input: 100, output: 50, reasoning: 10, cache: { read: 900, write: 20 } },
    },
  },
}));

process.env.XDG_DATA_HOME = tmp;
const { parseOpenCode } = await import("../src/parse.js");
const r = parseOpenCode(now - 86400_000);
const m = r.byModel.get("claude-sonnet-5");
assert.ok(m, "OpenCode: expected the claude-sonnet-5 message to be parsed");
assert.strictEqual(m.input, 100, "OpenCode input tokens");
assert.strictEqual(m.output, 50, "OpenCode output tokens");
assert.strictEqual(m.cacheRead, 900, "OpenCode cache-read tokens");
assert.strictEqual(m.cacheCreate, 20, "OpenCode cache-write tokens");
assert.strictEqual(r.days.size, 1, "OpenCode active-day count");

// Out-of-window messages must be excluded.
assert.ok(!parseOpenCode(now + 86400_000).byModel.size, "OpenCode: future cutoff must exclude the message");


// --- Hermes fixture: build a tiny SQLite DB with the real session_model_usage
// shape and confirm parseHermes reads it (skips cleanly if sqlite3 is absent).
import { spawnSync } from "node:child_process";
if (spawnSync("sqlite3", ["--version"]).status === 0) {
  const hdb = path.join(tmp2, "state.db");
  const sec = now / 1000;
  const sql = "CREATE TABLE session_model_usage (session_id TEXT, model TEXT, "
    + "input_tokens INT, output_tokens INT, cache_read_tokens INT, cache_write_tokens INT, "
    + "reasoning_tokens INT, last_seen REAL);"
    + `INSERT INTO session_model_usage VALUES ('s1','deepseek-v4-flash',200,30,5000,10,0,${sec});`
    + `INSERT INTO session_model_usage VALUES ('s2','deepseek-v4-flash',100,20,3000,5,0,${sec});`
    + `INSERT INTO session_model_usage VALUES ('s3','qwen3.8-27b',50,5,900,0,0,${sec - 10 * 86400});`;
  const w = spawnSync("sqlite3", [hdb, sql], { encoding: "utf8" });
  assert.strictEqual(w.status, 0, "Hermes: failed to build fixture DB");
  const { parseHermes } = await import("../src/parse.js");
  const hr = parseHermes(now - 86400_000, hdb);          // 1-day window
  const ds = hr.byModel.get("deepseek-v4-flash");
  assert.ok(ds, "Hermes: expected deepseek-v4-flash rows");
  assert.strictEqual(ds.input, 300, "Hermes input tokens summed across sessions");
  assert.strictEqual(ds.output, 50, "Hermes output tokens");
  assert.strictEqual(ds.cacheRead, 8000, "Hermes cache-read tokens");
  assert.strictEqual(ds.cacheCreate, 15, "Hermes cache-write tokens");
  assert.ok(!hr.byModel.has("qwen3.8-27b"), "Hermes: the 10-day-old row must fall outside a 1-day window");
  console.log("hermes fixture ok — session_model_usage parsed and windowed correctly");
} else {
  console.log("hermes fixture skipped — sqlite3 not on PATH");
}

fs.rmSync(tmp, { recursive: true, force: true });
fs.rmSync(tmp2, { recursive: true, force: true });
console.log("parser fixtures ok — OpenCode schema (v1.18.31) parsed correctly");
