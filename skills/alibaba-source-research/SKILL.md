---
name: alibaba-source-research
description: "Alibaba source research through Bustly Browser Relay in the user's normal browser profile. Relay-only, no MCP fallback."
compatibility: "Relay-only. Requires Bustly Browser Relay (OpenClaw extension relay endpoint + gateway token)."
metadata:
  implementation: relay-only-cdp-runtime
  cli_entry: scripts/run.js
  platform: alibaba.com
---

# alibaba-source-research

## Relay Execution Policy

- Bustly Browser Relay is mandatory (relay-only).
- Any browser action must run on relay-attached tabs via OpenClaw browser context (`profile="chrome"`).
- Do not launch standalone Chrome/CDP debug browser sessions.
- Do not route this skill through MCP `product_supplier_search`.
- If relay is unavailable, stop and report blocker directly.

## Purpose

Search Alibaba (`www.alibaba.com`) for product and supplier candidates as source research, save structured raw JSON, and return a comparison-ready summary table.

## Commands

```bash
node {baseDir}/scripts/run.js relay-check
node {baseDir}/scripts/run.js prepare-login "yoga pants" --intent-type product
node {baseDir}/scripts/run.js open "yoga pants" --intent-type product
node {baseDir}/scripts/run.js search "yoga pants" --intent-type product --limit 20
```

### `relay-check`

Validate relay connectivity (`/json/version`, `/json/list`) and print current tab inventory.

### `prepare-login`

Returns:
- Alibaba login/home URL
- deterministic search URL based on keyword + intent
- next command to run after user confirms tab is ready

### `open`

Create a dedicated Alibaba search tab in relay session, so the agent does not depend on manual tab attach.

### `search`

Run relay CDP scraping against Alibaba search results and save JSON under `data/alibaba/`.

Supported options:

- `--intent-type product|supplier|both` (default: `product`)
- `--site <host>` (default: `www.alibaba.com`)
- `--limit <n>`
- `--page <n>`
- `--timeout <seconds>`
- `--output <path>`
- `--relay-host <host>`
- `--relay-port <port>`
- `--relay-token <token>`
- `--verbose`

## Standard Workflow

1. Run `relay-check`.
2. Run `prepare-login` and show user `https://www.alibaba.com/`.
3. Ask user to complete login/challenge in the same relay-connected profile if prompted.
4. Run `open` to create dedicated Alibaba search tab.
5. Run `search` and save raw JSON.
6. Return concise result table + output path + risk notes.

## Guardrails

- Do not fabricate product/supplier data.
- If login or anti-bot challenge appears, report exact blocker (`NOT_LOGGED_IN` / `RISK_CHALLENGE`) and stop.
- Do not silently return "success" when extraction is empty.
- Re-run command per user request; avoid stale cached answers.

## Output Contract

- 1-3 bullet summary.
- Structured table with: type, title, price, MOQ, supplier, location, URL.
- Saved JSON path under `data/alibaba/`.
- Risks and next action.
