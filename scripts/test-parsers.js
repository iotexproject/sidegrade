#!/usr/bin/env node
// Verifies parsers against realistic fixtures. The OpenCode fixture mirrors the
// released v1.18.31 message schema (metadata.assistant.tokens), since we can't
// assume a live OpenCode install in CI.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sidegrade-test-"));
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

fs.rmSync(tmp, { recursive: true, force: true });
console.log("parser fixtures ok — OpenCode schema (v1.18.31) parsed correctly");
