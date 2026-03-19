---
name: ads_core_ops
description: Unified advertising operations for Klaviyo, Google Ads, and Meta Ads. Use when an agent needs to inspect or query advertising data such as profiles, lists, campaigns, flows, metrics, customers, ad groups, keywords, ads, or insights. Supports Klaviyo and Google Ads through the Bustly Gateway, plus Meta Ads through direct local credentials.
---

Use the standalone entrypoint directly:

`node skills/ops/ads_core_ops/scripts/run.js ...`

## Platform Modes

| Platform | Mode | Details |
|----------|------|---------|
| Klaviyo | Gateway | Route requests through the Supabase Edge Function. |
| Google Ads | Gateway | Route requests through the Supabase Edge Function. |
| Meta Ads | Direct | Use local credentials from the current machine. |

## Architecture

### Gateway mode

Use Gateway mode for Klaviyo and Google Ads.

```text
CLI (run.js)
  -> POST /functions/v1/ads-core-ops
  -> JWT + workspace validation
  -> workspace integration lookup
  -> Nango token resolution
  -> provider API relay
```

Require both of the following:

- Bustly client authorization in `~/.bustly/bustlyOauth.json`
- An active provider connection in **Bustly > Integrations**

If the Gateway says a platform is not connected, stop and tell the user to go to **Bustly > Integrations** and authorize that platform first.

### Direct mode

Use direct mode only for Meta Ads.

```text
CLI (run.js)
  -> local credentials in ~/.bustly/ads_credentials.json
  -> Meta Graph API
```

## Security

- Never print provider secrets in chat.
- Keep provider credentials server-side for Gateway platforms.
- Use `raw` / `native` commands only for request passthrough, not for exposing tokens.

## Setup

### Gateway platforms

1. Sign in through the Bustly authorization flow.
2. Connect the provider in **Bustly > Integrations**.
3. Use `node skills/ops/ads_core_ops/scripts/run.js status` to confirm the real gateway connection state.
4. Re-run the command after authorization succeeds.

### Meta Ads

Configure local credentials in `~/.bustly/ads_credentials.json`:

```bash
node skills/ops/ads_core_ops/scripts/run.js config set-meta-ads '{"accessToken":"xxx","adAccountId":"123456789"}'
```

## Commands

### Core

```bash
node skills/ops/ads_core_ops/scripts/run.js platforms
node skills/ops/ads_core_ops/scripts/run.js status
```

### Klaviyo

```bash
node skills/ops/ads_core_ops/scripts/run.js klaviyo profiles
node skills/ops/ads_core_ops/scripts/run.js klaviyo lists
node skills/ops/ads_core_ops/scripts/run.js klaviyo campaigns
node skills/ops/ads_core_ops/scripts/run.js klaviyo raw --path /profiles --query '{"page[size]":20}'
```

### Google Ads

```bash
node skills/ops/ads_core_ops/scripts/run.js google-ads customers
node skills/ops/ads_core_ops/scripts/run.js google-ads campaigns --customer-id 1234567890
node skills/ops/ads_core_ops/scripts/run.js google-ads search --customer-id 1234567890 --query "SELECT campaign.id, campaign.name FROM campaign LIMIT 10"
node skills/ops/ads_core_ops/scripts/run.js google-ads raw --path /customers/1234567890/googleAds:search --body '{"query":"SELECT campaign.id, campaign.name FROM campaign LIMIT 10"}'
```

### Meta Ads

```bash
node skills/ops/ads_core_ops/scripts/run.js meta-ads account
node skills/ops/ads_core_ops/scripts/run.js meta-ads campaigns
node skills/ops/ads_core_ops/scripts/run.js meta-ads insights --date-preset last_7d
```

## Error Handling

- If the workspace is not authorized, tell the user to sign in through Bustly first.
- If a Gateway platform is not connected, tell the user to open **Bustly > Integrations** and authorize it.
- If Meta Ads credentials are missing, ask the user to configure local Meta credentials before retrying.

## References

- Klaviyo API: https://developers.klaviyo.com/
- Google Ads API: https://developers.google.com/google-ads/api/docs/
- Meta Ads API: https://developers.facebook.com/docs/marketing-api/
