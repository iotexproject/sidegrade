# Contributing

## Add or update a provider (the common case)

`sidegrade` compares models across providers. If you run an inference service
and want your prices to show up, it takes about two minutes:

1. Add or edit **one file**: `data/providers/<your-provider>.json`.
2. List the models you serve and your public prices (USD per 1M tokens).
3. Open a pull request. CI validates it automatically.

```jsonc
{
  "provider": "Your Company",
  "url": "https://your-site.example",
  "pricing_url": "https://your-site.example/pricing",
  "offers": [
    { "model": "claude-sonnet-5", "in": 2.5, "out": 12, "cacheRead": 0.25 },
    { "model": "deepseek-v4.1-flash", "in": 0.28, "out": 1.1, "cacheRead": 0.006 }
  ]
}
```

- `model` must match an id in [`data/models.json`](data/models.json) (or one of
  its `aliases`). If the model isn't there yet, add it to `data/models.json`
  with its **Artificial Analysis** intelligence score in the same PR.
- `in` / `out` are your price per 1M input / output tokens.
- `cacheRead` (optional) is your price per 1M **cache-hit** input tokens — this
  matters a lot for coding agents, which are cache-heavy, so include it if you
  offer prompt caching.

That's it. We only ask that prices are real and match a public pricing page —
`sidegrade` ranks strictly by intelligence and price and does not favor any
provider.

Prefer a form? Open an issue with the **"Add / update a provider"** template and
a maintainer will turn it into a PR.

## Other contributions

- **A new agent** (Hermes, OpenCode, Cursor, …): add a parser in
  `src/parse.js` that returns per-model token counts. Keep it read-only.
- Keep the project **dependency-free** and **local-only** — no telemetry, no
  network calls at runtime.

Run `npm run validate` before opening a PR.
