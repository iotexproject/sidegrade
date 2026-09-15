# sidegrade

**Same intelligence, less money.** `sidegrade` reads your local coding-agent
usage — **Claude Code, Codex, Hermes, and OpenCode** — and tells you which model
gives you the *same intelligence* for a lower price, and which cheaper tier is
worth a small step down.

```bash
npx sidegrade
```

No install, no account, no config. It reads your existing Claude Code, Codex,
Hermes, and OpenCode session logs on this machine and prints a report — whichever
of the four you use.

## Or just ask your agent

Already inside Claude Code, Codex, Cursor, or any coding agent? Paste this — it
runs sidegrade and tells you what to do, no terminal needed:

```text
Run `npx -y sidegrade --json` and tell me the intelligence (AA) I'm running and
what it costs per day, the cheapest model at the same intelligence, and a cheaper
step-down — with $/day and savings for each.
```

## What you'll see

Run it and you get a report built from *your* actual usage. Example:

```text
  sidegrade  ·  same intelligence, less money
  100% local · no account · no telemetry · your prompts & code never leave this machine

  You're using AI at intelligence AA 53, costing about $151/day at list price.

  Based on 3.3B tokens over the last 30 days · 94% cache-hit · Claude Code (26d), Codex (21d)

  Intelligence-per-dollar (if you ran all of it on one model)
  model                   AA  vs you     $/day  via
  ────────────────────────────────────────────────────────────────
  Claude Fable 5.1        57      +4      $201  QuickSilver Pro same+ ◆
  GPT-6 Astra             55      +2      $326  NEAR AI         same+
  Claude Opus 5           54      +1      $130  QuickSilver Pro same+ ◆
  Muse Spark 1.3          53      -0    $29.21  QuickSilver Pro same+ ◆
  Grok 4.6                51      -2    $81.50  NEAR AI         ~-2
  Kimi K3                 50      -3    $83.05  QuickSilver Pro ~-3
  GLM 5.3                 49      -4    $36.93  Z.ai            ~-4
  Gemini 3.8 Flash        47      -6    $20.76  QuickSilver Pro ~-6 ◆
  GLM 5.3 Flash           46      -7     $2.03  Z.ai            ~-7 ◆
  Grok 4.5                45      -8    $51.80  xAI             ▼-8
  DeepSeek V4.1 Flash    42~     -11     $6.39  NEAR AI         ▼-11
  Qwen3.8 27B             41     -12    $13.78  AkashML         ▼-12
  Gemini 3.6 Flash        40     -13    $30.54  Venice          ▼-13
  GPT-OSS 120B            16     -37     $2.11  Venice          ▼-37
  ◆ = cheapest option at that intelligence level or higher
  (trimmed — the full run scores 29 models across 12 providers)

  Recommendation
  • No intelligence trade-off  (AA ≥ 53)
      Muse Spark 1.3 (AA 53) via QuickSilver Pro — $29.21/day  (~5.2× less than list)
  • A small step down  (AA ≥ 45, fine for routine work)
      GLM 5.3 Flash (AA 46, -7 below you) via Z.ai — $2.03/day  (~75× less)

  A lower AA score means a genuinely less capable model — pick the tier your work needs,
  not just the cheapest row. The big savings above come with a real capability drop.

  Prices: providers' public pages · intelligence: Artificial Analysis (artificialanalysis.ai).
```

*(Numbers above are illustrative; your report reflects your own machine.)*

## Why

Coding agents (Claude Code, Codex, …) are cache-heavy: the same context is
re-sent every turn, so most of your tokens are cache reads. That means two
things most cost dashboards miss:

1. Your bill is dominated by a small slice of **output** and **fresh input**,
   not the huge cache-read count — so raw token totals mislead.
2. A model that is nearly as capable but priced right can cost a fraction of
   what you pay, *for your specific usage shape*.

`sidegrade` scores every candidate model on the **Artificial Analysis
Intelligence Index** and re-prices *your* actual token mix on each, so you can
pick the cheapest model **at the intelligence level your work needs** — not just
the cheapest row.

## Privacy — this is the whole point

- **100% local.** It only reads token *counts* from your agents' own log files.
- **No network calls at runtime.** Prices and intelligence scores are bundled
  in the package. The only network access is `npm`/`npx` fetching sidegrade
  itself.
- **No telemetry, no account, no API key** to run.
- **Read-only.** Your prompts, code, file paths, and completions never leave
  your machine.
- **Zero runtime dependencies** — the whole thing is a few small files you can
  read in a couple of minutes.

## Options

```
--days <n>        Look back this many days (default: 30)
--tolerance <n>   AA points you'll trade for savings in the "step down" pick (default: 8)
--json            Machine-readable output (handy inside an agent session)
-h, --help        Help
```

Running it inside a coding-agent session works well: ask your agent to run
`npx sidegrade --json` and it can reason over the result for you.

## Supported agents

- **Claude Code** — `~/.claude/projects`
- **Codex** — `~/.codex/sessions`
- **Hermes** — `~/.hermes/state.db` `session_model_usage` (read via the system `sqlite3`; verified against real data and covered by a fixture test; skipped if `sqlite3` is unavailable)
- **OpenCode** — `~/.local/share/opencode` (reads `storage/session/message`; matched to the v1.18.x message schema and covered by a fixture test)

Adding another agent is a small read-only parser in `src/parse.js` — PRs welcome.

## Data & sources

- **Intelligence:** Artificial Analysis Intelligence Index
  (<https://artificialanalysis.ai>), rounded to the nearest integer, in
  [`data/models.json`](data/models.json).
- **Prices:** one file per provider in
  [`data/providers/`](data/providers), each labeled with a link to its public
  pricing page. Some of the cheapest offers today are via
  [QuickSilver Pro](https://quicksilverpro.io), an OpenAI-compatible gateway.

`sidegrade` ranks strictly by intelligence and price. It does not favor any
provider — a source wins a row only by being the cheapest for that model.

## For providers — add your prices in ~2 minutes

Run an inference service? Add **one file**,
`data/providers/<you>.json`, list your models and public prices, and open a PR.
CI validates it automatically. See [CONTRIBUTING.md](CONTRIBUTING.md) for the
template, or open an issue with the **"Add / update a provider"** form.

## License

MIT
