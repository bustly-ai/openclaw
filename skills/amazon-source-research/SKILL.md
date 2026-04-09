---
name: amazon-source-research
description: "Amazon source research through Bustly Browser Relay. Relay-only workflow with deterministic preflight, tab attach, and SKU-level output."
compatibility: "Relay-only. Requires Bustly Browser Relay + local OpenClaw gateway token. Do not launch dedicated debug browser sessions."
metadata:
  implementation: relay-only-browser-workflow
  cli_entry: scripts/run.js
---

# amazon-source-research

## Relay Execution Policy

- Bustly Browser Relay is mandatory (relay-only).
- All browser actions must run in relay-attached Chrome context (`profile=\"chrome\"`).
- Do not launch standalone Chrome/CDP debug sessions.
- Do not fallback to generic browser automation or non-relay paths.
- If relay check fails, stop and report the exact blocker.

## Minimal Executable Entry

Always start from the bundled wrapper:

```bash
node {baseDir}/scripts/run.js relay-check
node {baseDir}/scripts/run.js prepare "yoga pants"
node {baseDir}/scripts/run.js open "yoga pants"
node {baseDir}/scripts/run.js collect "yoga pants" --limit 20
```

What these commands do:

- `relay-check`: verify relay endpoint, token auth, and current tab inventory.
- `prepare`: return deterministic Amazon search URL + next command.
- `open`: create a relay-attached Amazon tab directly (no user manual attach needed).
- `collect`: extract result cards in the relay tab and save JSON + CSV artifacts.

## Purpose

Scrape Amazon product and supplier-facing listing data for source research and output JSON + CSV ready for decision-making.

## Standard Workflow (Relay-Only)

1. Run `relay-check`.
2. Run `prepare "<keyword>"` and confirm target search URL.
3. Run `open "<keyword>"` to create/attach an Amazon tab via relay.
4. Run `collect "<keyword>" --limit <n>` in the same relay session.
5. Save outputs:
   - `data/amazon/{keyword}_{timestamp}/products.json`
   - `data/amazon/{keyword}_{timestamp}/products.csv`
6. Return concise summary + output paths + risk notes.

## Hard Gates

Execution is considered complete only if all gates pass:

1. Target website accessible in relay-attached tab.
2. Listing extraction returns at least one valid row.
3. Required fields complete:
   - asin, title, product_url, price (if visible), rating/reviews (if visible).
4. JSON + CSV both saved to local output directory.

If any gate fails, stop and report exact reason.

## Guardrails

- Use real live data only; no mock/placeholder output.
- Do not fabricate missing fields (price/rating/reviews may be empty if hidden in page).
- If anti-bot/login challenge appears, ask user to complete it in the same relay tab, then continue.
- Re-run the wrapper for each new request; do not rely on stale cache files.
- Keep user-facing output concise (results + saved paths + next action).

## Output Contract

- 1-3 bullet executive summary.
- Compact product table.
- Saved artifact paths (`products.json`, `products.csv`).
- Risks + recommended next step.
