import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dir, "..", "data");

// Canonical model registry (id + label + intelligence score).
const CATALOG = JSON.parse(fs.readFileSync(path.join(DATA, "models.json"), "utf8"));
const BY_ID = new Map(CATALOG.models.map((m) => [m.id, { ...m, offers: [] }]));

// Merge every provider's price file (data/providers/*.json). Each provider owns
// one file and lists the models they sell — this is how new providers get in:
// add a file, open a PR. Offers referencing an unknown model id are skipped.
const provDir = path.join(DATA, "providers");
for (const f of (fs.existsSync(provDir) ? fs.readdirSync(provDir) : [])) {
  if (!f.endsWith(".json")) continue;
  let p;
  try { p = JSON.parse(fs.readFileSync(path.join(provDir, f), "utf8")); } catch { continue; }
  for (const o of p.offers || []) {
    const target = BY_ID.get(o.model) || BY_ID.get(CATALOG.aliases[o.model]);
    if (!target || !(o.in >= 0) || !(o.out >= 0)) continue;
    target.offers.push({ via: p.provider, in: o.in, out: o.out, cacheRead: o.cacheRead });
  }
}
// Drop models nobody prices, keep catalog ordering by intelligence.
CATALOG.models = [...BY_ID.values()].filter((m) => m.offers.length);

// Map a raw model string from an agent log to a catalog entry.
export function normalizeModel(raw) {
  if (!raw) return null;
  let n = String(raw).toLowerCase();
  n = n.split("/").pop(); // drop provider prefix e.g. "anthropic/"
  if (CATALOG.aliases[n]) return BY_ID.get(CATALOG.aliases[n]);
  if (BY_ID.has(n)) return BY_ID.get(n);
  for (const [alias, id] of Object.entries(CATALOG.aliases)) {
    if (n.includes(alias)) return BY_ID.get(id);
  }
  for (const id of BY_ID.keys()) {
    if (n.includes(id) || id.includes(n)) return BY_ID.get(id);
  }
  return null;
}

// Cost (USD) of a token mix under one price offer.
// Cache-hit input is far cheaper than fresh input. When a provider omits an
// explicit cacheRead price we assume a conservative 10% of the input rate — a
// common floor (Anthropic ~0.1x, OpenAI ~0.1x; DeepSeek is even cheaper). This
// matters a lot because coding agents are cache-heavy.
const CACHE_DISCOUNT = 0.1;
export function offerCost(mix, offer) {
  const cacheRate = offer.cacheRead ?? offer.in * CACHE_DISCOUNT;
  return (
    mix.input * offer.in +
    mix.cacheCreate * offer.in +
    mix.cacheRead * cacheRate +
    mix.output * offer.out
  ) / 1e6;
}

const cheapestOffer = (model, mix) =>
  model.offers.reduce((best, o) => (best && offerCost(mix, best) <= offerCost(mix, o) ? best : o), null);
const firstPartyOffer = (model) =>
  model.offers.find((o) => o.via !== "QuickSilver Pro") || model.offers[0];

const addMix = (a, b) => ({
  input: a.input + b.input, cacheCreate: a.cacheCreate + b.cacheCreate,
  cacheRead: a.cacheRead + b.cacheRead, output: a.output + b.output,
});
const ZERO = { input: 0, cacheCreate: 0, cacheRead: 0, output: 0 };
const tokensOf = (m) => m.input + m.cacheCreate + m.cacheRead + m.output;

export function analyze(sessions, { days = 30, tolerance = 8 } = {}) {
  let total = ZERO;
  let currentCost = 0;          // priced at each model's first-party offer
  let aaNum = 0, aaDen = 0;     // token-weighted current intelligence
  const unmatched = new Map();

  for (const s of sessions) {
    for (const [rawModel, mix] of s.byModel) {
      total = addMix(total, mix);
      const model = normalizeModel(rawModel);
      if (model) {
        currentCost += offerCost(mix, firstPartyOffer(model));
        const w = tokensOf(mix);
        aaNum += model.aa * w; aaDen += w;
      } else {
        unmatched.set(rawModel, (unmatched.get(rawModel) || 0) + tokensOf(mix));
      }
    }
  }

  const currentAA = aaDen ? aaNum / aaDen : 0;
  const totalTokens = tokensOf(total);
  const cacheHitPct = (total.input + total.cacheCreate + total.cacheRead)
    ? (total.cacheRead / (total.input + total.cacheCreate + total.cacheRead)) * 100 : 0;

  // Cost of running ALL of the user's tokens on each candidate model.
  const candidates = CATALOG.models.map((m) => {
    const offer = cheapestOffer(m, total);
    const c = offerCost(total, offer);
    return { id: m.id, label: m.label, aa: m.aa, aaEstimated: !!m.aaEstimated, via: offer.via, perDay: c / days, perMonth: c };
  }).sort((a, b) => b.aa - a.aa);

  // Efficient frontier: cheapest option at each intelligence level or better.
  let bestSoFar = Infinity;
  for (const c of candidates) {
    if (c.perMonth < bestSoFar) { c.frontier = true; bestSoFar = c.perMonth; }
  }

  const floorSame = Math.round(currentAA) - 1;
  const floorOk = Math.round(currentAA) - tolerance;
  const cheapestAtOrAbove = (floor) =>
    candidates.filter((c) => c.aa >= floor).sort((a, b) => a.perMonth - b.perMonth)[0] || null;

  return {
    days, totalTokens, cacheHitPct, currentAA,
    currentPerDay: currentCost / days, currentPerMonth: currentCost,
    candidates,
    sameIntelligence: cheapestAtOrAbove(floorSame),
    acceptable: cheapestAtOrAbove(floorOk),
    tolerance,
    unmatched: [...unmatched.entries()].sort((a, b) => b[1] - a[1]),
    agents: sessions.map((s) => ({ agent: s.agent, days: s.days.size })),
  };
}
