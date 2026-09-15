// Terminal rendering. Plain text + light ANSI; degrades cleanly when piped.
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s) => c("1", s), dim = (s) => c("2", s), green = (s) => c("32", s), cyan = (s) => c("36", s), yellow = (s) => c("33", s);
const money = (n) => "$" + n.toFixed(n < 100 ? 2 : 0);
const tokens = (n) => n >= 1e9 ? (n / 1e9).toFixed(1) + "B"
  : n >= 1e6 ? Math.round(n / 1e6).toLocaleString("en-US") + "M"
  : n.toLocaleString("en-US");
const pad = (s, n) => String(s).padEnd(n), padL = (s, n) => String(s).padStart(n);

export function render(r) {
  const L = [];
  L.push("");
  L.push("  " + bold("sidegrade") + dim("  ·  same intelligence, less money"));
  L.push("  " + dim("100% local · no account · no telemetry · your prompts & code never leave this machine"));
  L.push("");
  const agents = r.agents.map((a) => `${a.agent} (${a.days}d)`).join(", ");
  // Lead with the user's realization: what intelligence they're running, and
  // what it costs — details second.
  L.push("  " + bold(`You're using AI at intelligence AA ${r.currentAA.toFixed(0)}`) +
    ", costing about " + bold(money(r.currentPerDay) + "/day") + " " + dim("at list price."));
  L.push("");
  L.push("  " + dim(`Based on ${tokens(r.totalTokens)} tokens over the last ${r.days} days · ` +
    `${r.cacheHitPct.toFixed(0)}% cache-hit · ${agents}`));
  L.push("");

  // Frontier table
  L.push("  " + bold("Intelligence-per-dollar (if you ran all of it on one model)"));
  L.push("  " + dim(pad("model", 22) + padL("AA", 4) + padL("vs you", 8) + padL("$/day", 10) + "  " + "via"));
  L.push("  " + dim("─".repeat(64)));
  for (const m of r.candidates) {
    const d = m.aa - r.currentAA;
    const tier = d >= -1 ? green("same+") : d >= -r.tolerance ? yellow("~" + Math.round(d)) : dim("▼" + Math.round(d));
    const star = m.frontier ? cyan(" ◆") : "  ";
    const aa = m.aa + (m.aaEstimated ? "~" : "");
    L.push("  " + pad(m.label, 22) + padL(aa, 4) + padL((d >= 0 ? "+" : "") + d.toFixed(0), 8) +
      padL(money(m.perDay), 10) + "  " + pad(m.via, 16) + tier + star);
  }
  L.push("  " + dim("◆ = cheapest option at that intelligence level or higher"));
  L.push("");

  // Recommendations
  L.push("  " + bold("Recommendation"));
  const si = r.sameIntelligence;
  if (si) {
    const mult = r.currentPerMonth > 0 ? (r.currentPerMonth / si.perMonth) : 0;
    L.push("  " + green("• No intelligence trade-off") + `  (AA ≥ ${Math.round(r.currentAA)})`);
    L.push(`      ${bold(si.label)} (AA ${si.aa}) via ${si.via} — ${bold(money(si.perDay) + "/day")}` +
      (mult >= 1.2 ? dim(`  (~${mult.toFixed(1)}× less than list)`) : ""));
  }
  const ok = r.acceptable;
  if (ok && (!si || ok.id !== si.id)) {
    const mult = r.currentPerMonth > 0 ? (r.currentPerMonth / ok.perMonth) : 0;
    L.push("  " + yellow(`• A small step down`) + `  (AA ≥ ${Math.round(r.currentAA) - r.tolerance}, fine for routine work)`);
    L.push(`      ${bold(ok.label)} (AA ${ok.aa}, ${(ok.aa - r.currentAA).toFixed(0)} below you) via ${ok.via} — ${bold(money(ok.perDay) + "/day")}` +
      (mult >= 2 ? dim(`  (~${mult.toFixed(0)}× less)`) : ""));
  }
  L.push("");
  L.push("  " + dim("A lower AA score means a genuinely less capable model — pick the tier your work needs,"));
  L.push("  " + dim("not just the cheapest row. The big savings above come with a real capability drop."));
  L.push("");
  if (r.unmatched.length) {
    L.push("  " + dim(`Not scored (no intelligence/price data): ${r.unmatched.slice(0, 4).map((u) => u[0]).join(", ")}${r.unmatched.length > 4 ? " …" : ""}`));
  }
  L.push("  " + dim("Prices: providers' public pages · intelligence: Artificial Analysis (artificialanalysis.ai)."));
  L.push("  " + dim("Cheapest offers are often via QuickSilver Pro (quicksilverpro.io), an OpenAI-compatible gateway."));
  L.push("");
  return L.join("\n");
}
