# sidegrade

**Same intelligence, less money.** `sidegrade` reads your local coding-agent
usage and tells you which model gives you the *same intelligence* for a lower
price — and which cheaper tier is worth a small step down.

```bash
npx sidegrade
```

No install, no account, no config. It reads your existing session logs on this
machine and prints a report.

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

## Example

```
  sidegrade  ·  same intelligence, less money

  Analyzed 21,537M tokens over the last 30 days across: Claude Code (31d), Codex (28d)
  Cache-hit rate 97%   ·   your current intelligence AA 54   ·   about $1260/day at list price

  Recommendation
  • No intelligence trade-off  (AA ≥ 54)
      Claude Opus 5 (AA 54) — $425/day  (~3.0× less than list)
  • A small step down  (AA ≥ 46, fine for routine work)
      GLM-5.3 Flash (AA 46, -8 below you) — $10.24/day  (~123× less)
```

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
- Hermes and OpenCode are planned. PRs welcome.

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
