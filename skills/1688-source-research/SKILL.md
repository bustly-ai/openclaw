---
name: 1688-source-research
description: "1688 source research through Bustly Browser Relay in the user's normal browser profile. Relay-only, no dedicated debug-browser launch."
compatibility: "Relay-only. Requires Bustly Browser Relay (OpenClaw extension relay endpoint + gateway token) with manual user login on www.1688.com in the user's normal browser profile."
metadata:
  implementation: relay-only-cdp-runtime
  cli_entry: scripts/run.js
  consolidated_from: ["1688-product-research"]
---

# 1688-source-research

## Relay Execution Policy

- Bustly Browser Relay is mandatory (relay-only).
- Any browser action must run on relay-attached tabs via OpenClaw `browser` with `profile="chrome"`.
- Do not launch dedicated Chrome/CDP debug browser instances.

Use the bundled wrapper directly:

```bash
node {baseDir}/scripts/run.js prepare-login "手机壳"
node {baseDir}/scripts/run.js search "手机壳" --limit 20 --sort sale
```

## Purpose

Run a fresh 1688 source research workflow through Bustly relay, save raw JSON under the current project, and summarize high-signal supplier/product records. This skill now includes the former `1688-product-research` capability scope (supplier discovery + product research) in one execution path.

## Relay-First Preconditions

- Bustly Browser Relay extension is installed and connected.
- The user's normal browser profile is already connected to relay.
- User can manually complete login/slider on `https://www.1688.com/` (desktop preferred).
- Optional explicit relay flags:
  - `--relay-host <host>`
  - `--relay-port <port>`
  - `--relay-token <token>`
- If relay flags are omitted, the wrapper auto-detects from local OpenClaw config (`~/.bustly/openclaw.json`).

## Guardrails

- Re-run CLI for every request; do not answer from stale files alone.
- Save raw JSON to `data/1688/` unless user explicitly overrides output path.
- Surface exact CLI error when relay/login/search fails.
- If `NOT_LOGGED_IN`, `NO_1688_TAB`, `NO_RESULTS_PAGE`, `RISK_CHALLENGE`, or `NO_RELAY_SESSION` appears, stop and report blocker exactly.
- For `RISK_CHALLENGE`, ask user to complete verification in the same relay-connected tab, then rerun search.
- Do not claim zero-config. This is still BYO Auth (user must complete login manually).
- Do not use generic browser automation calls (`use_browser`, browser tool) for this skill path.
- Always run `node {baseDir}/scripts/run.js ...` as the execution path.
- If browser-level debugging is unavoidable, only use relay-attached Chrome context (`profile="chrome"`); never start standalone debug Chrome/CDP.

## Commands

### `prepare-login`

Returns:
- `login_url` (default `https://www.1688.com/`)
- relay endpoint hint (when auto-detected)
- exact next command to run

Example:

```bash
node {baseDir}/scripts/run.js prepare-login "鞋子"
```

### `launch-browser` (compatibility command)

In relay mode this command is a no-op guidance response.
It does **not** launch a dedicated debug browser anymore.

Example:

```bash
node {baseDir}/scripts/run.js launch-browser "鞋子"
```

### `search`

Primary path (relay):
- Connect to relay `/json/version`, `/json/list`, `/cdp`
- Discover or create a 1688 page target in the connected browser profile
- Attach to that target, submit keyword, scrape live result cards
- Save normalized JSON artifact

Examples:

```bash
node {baseDir}/scripts/run.js search "鞋子" --limit 10 --sort sale
node {baseDir}/scripts/run.js search "手机壳" --output data/1688/phone-case.json
node {baseDir}/scripts/run.js search "瑜伽裤" --relay-port 18002 --relay-token <token>
```

Supported options:

- `--sort sale|price_asc|price_desc`
- `--limit <n>`
- `--page <n>`
- `--timeout <seconds>`
- `--output <path>`
- `--relay-host <host>`
- `--relay-port <port>`
- `--relay-token <token>`
- `--verbose`

## Standard Workflow

1. Run `prepare-login` and show `login_url`.
2. Ask user to complete login on `www.1688.com` in normal browser profile (relay-connected).
3. Run `search`.
4. Read generated JSON and summarize products.
5. Report saved JSON path.

## Output Contract

- 1-3 bullet executive summary.
- Compact product table: title, price, sales, location, rating, URL.
- Saved JSON path under `data/1688/`.
- Risk notes and suggested next actions.
