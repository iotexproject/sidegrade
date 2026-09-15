#!/usr/bin/env node
import { collect } from "../src/parse.js";
import { analyze } from "../src/analyze.js";
import { render } from "../src/render.js";

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };

if (has("-h") || has("--help")) {
  console.log(`
sidegrade — same intelligence, less money.

Reads your local coding-agent usage (Claude Code, Codex) and shows which model
gives you the same intelligence for a lower price. Everything runs on-device;
no account, no network calls, no telemetry.

Usage:
  npx sidegrade [options]

Options:
  --days <n>        Look back this many days (default: 30)
  --tolerance <n>   AA points you'll trade for savings in the "step down" pick (default: 8)
  --json            Emit machine-readable JSON instead of a table
  -h, --help        Show this help

Docs & source: https://github.com/iotexproject/sidegrade
`);
  process.exit(0);
}

const days = parseInt(val("--days", "30"), 10) || 30;
const tolerance = parseInt(val("--tolerance", "8"), 10) || 8;

const sessions = collect(days);
if (!sessions.length) {
  console.error("sidegrade: found no Claude Code or Codex usage on this machine in the last " + days + " days.");
  console.error("Looked in ~/.claude/projects and ~/.codex/sessions. Try a larger --days window.");
  process.exit(1);
}

const result = analyze(sessions, { days, tolerance });
if (has("--json")) console.log(JSON.stringify(result, null, 2));
else console.log(render(result));
