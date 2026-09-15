#!/usr/bin/env node
// Validates the model registry and every provider price file. Run locally with
// `npm run validate`; CI runs it on every pull request so contributors get
// instant feedback. Zero dependencies.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const errors = [];
const warns = [];
const err = (f, m) => errors.push(`${f}: ${m}`);
const warn = (f, m) => warns.push(`${f}: ${m}`);
const isNum = (n) => typeof n === "number" && Number.isFinite(n);

// --- registry ---
let reg;
try { reg = JSON.parse(fs.readFileSync(path.join(DATA, "models.json"), "utf8")); }
catch (e) { console.error("data/models.json: invalid JSON —", e.message); process.exit(1); }

const ids = new Set();
for (const m of reg.models || []) {
  const f = "data/models.json";
  if (!m.id || typeof m.id !== "string") err(f, `model missing string "id"`);
  else if (ids.has(m.id)) err(f, `duplicate model id "${m.id}"`);
  else ids.add(m.id);
  if (!m.label) warn(f, `model "${m.id}" missing "label"`);
  if (!isNum(m.aa)) err(f, `model "${m.id}" needs a numeric "aa" (Artificial Analysis score)`);
  else if (m.aa < 0 || m.aa > 100) err(f, `model "${m.id}" aa=${m.aa} out of range 0–100`);
}
const resolve = (id) => (ids.has(id) ? id : reg.aliases && reg.aliases[id]);
for (const [a, target] of Object.entries(reg.aliases || {})) {
  if (!ids.has(target)) err("data/models.json", `alias "${a}" points to unknown model "${target}"`);
}

// --- providers ---
const provDir = path.join(DATA, "providers");
const files = fs.existsSync(provDir) ? fs.readdirSync(provDir).filter((f) => f.endsWith(".json")) : [];
if (!files.length) warn("data/providers", "no provider files found");
for (const file of files) {
  const rel = `data/providers/${file}`;
  let p;
  try { p = JSON.parse(fs.readFileSync(path.join(provDir, file), "utf8")); }
  catch (e) { err(rel, `invalid JSON — ${e.message}`); continue; }
  if (!p.provider || typeof p.provider !== "string") err(rel, `missing string "provider"`);
  if (!p.url) warn(rel, `missing "url" (link to your homepage)`);
  if (!Array.isArray(p.offers) || !p.offers.length) { err(rel, `"offers" must be a non-empty array`); continue; }
  const seen = new Set();
  for (const o of p.offers) {
    const where = `${rel} → ${o.model}`;
    if (!o.model) { err(rel, `an offer is missing "model"`); continue; }
    if (seen.has(o.model)) err(where, `duplicate offer for this model`);
    seen.add(o.model);
    if (!resolve(o.model)) warn(where, `model not in registry — add it to data/models.json (with its AA score) in the same PR`);
    if (!isNum(o.in) || o.in < 0) err(where, `"in" (USD per 1M input tokens) must be a number ≥ 0`);
    if (!isNum(o.out) || o.out < 0) err(where, `"out" (USD per 1M output tokens) must be a number ≥ 0`);
    if (o.cacheRead != null && (!isNum(o.cacheRead) || o.cacheRead < 0)) err(where, `"cacheRead" must be a number ≥ 0 when present`);
  }
}

for (const w of warns) console.warn("warn  " + w);
if (errors.length) { for (const e of errors) console.error("error " + e); console.error(`\n${errors.length} error(s).`); process.exit(1); }
console.log(`ok — ${ids.size} models, ${files.length} providers, ${warns.length} warning(s).`);
