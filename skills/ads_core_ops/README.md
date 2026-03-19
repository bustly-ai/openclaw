# Ads Core Ops

Unified advertising operations for Klaviyo, Google Ads, and Meta Ads.

- **Klaviyo** → Gateway Mode
- **Google Ads** → Gateway Mode
- **Meta Ads** → Direct Mode

## Installation

```bash
cd skills/ops/ads_core_ops
```

No npm install needed - pure JavaScript with no dependencies.

## Architecture

### Gateway Mode

Klaviyo and Google Ads go through the Supabase Edge Function:

```text
CLI (run.js)
  -> /functions/v1/ads-core-ops
  -> JWT / workspace validation
  -> provider credential resolution
  -> provider API relay
```

Gateway mode reads Bustly client authorization from:

```text
~/.bustly/bustlyOauth.json
```

Gateway mode also requires an active provider connection in **Bustly > Integrations**. If the Gateway reports that a platform is not connected, the correct next step is to go to **Bustly > Integrations** and authorize that platform.

### Direct Mode

Meta Ads still uses local credentials stored in:

```text
~/.bustly/ads_credentials.json
```

## Quick Start

### Gateway Mode

```bash
# Klaviyo list APIs
node scripts/run.js klaviyo profiles
node scripts/run.js klaviyo campaigns --limit 20

# Klaviyo passthrough
node scripts/run.js klaviyo raw --path /profiles --query '{"page[size]":20}'

# Google Ads preset reads
node scripts/run.js google-ads customers
node scripts/run.js google-ads campaigns --customer-id 1234567890

# Google Ads custom GAQL
node scripts/run.js google-ads search \
  --customer-id 1234567890 \
  --query "SELECT campaign.id, campaign.name FROM campaign LIMIT 10"

# Google Ads passthrough
node scripts/run.js google-ads raw \
  --path /customers/1234567890/googleAds:search \
  --body '{"query":"SELECT campaign.id, campaign.name FROM campaign LIMIT 10"}'
```

### Direct Mode (Meta Ads)

```bash
# Configure credentials
node scripts/run.js config set-meta-ads '{"accessToken":"xxx","adAccountId":"123456789"}'

# Run commands
node scripts/run.js meta-ads campaigns
node scripts/run.js meta-ads insights --date-preset last_7d
```

## Supported Platforms

| Platform | Mode | Commands |
|----------|------|----------|
| Klaviyo | Gateway | profiles, lists, segments, campaigns, flows, metrics, events, templates, raw |
| Google Ads | Gateway | customers, campaigns, ad-groups, keywords, ads, search, raw |
| Meta Ads | Direct | account, campaigns, adsets, ads, insights |

## Gateway Request Model

### 1. Preset read mode

Used by commands like `klaviyo profiles` or `google-ads campaigns`:

```json
{
  "action": "DIRECT_READ",
  "platform": "google-ads",
  "entity": "campaigns",
  "workspace_id": "uuid",
  "user_id": "uuid",
  "limit": 50,
  "filters": {
    "customer_id": "1234567890"
  }
}
```

### 2. Native relay mode

Used by `raw` / `native` commands:

```json
{
  "action": "NATIVE_PROXY",
  "platform": "klaviyo",
  "workspace_id": "uuid",
  "user_id": "uuid",
  "request": {
    "method": "GET",
    "path": "/profiles",
    "query": {
      "page[size]": 20
    },
    "headers": {},
    "body": null
  }
}
```

## Authentication

### Klaviyo
- Managed server-side via gateway
- API key resolved from workspace connection

### Google Ads
- Managed server-side via gateway
- OAuth token resolved via Nango

### Meta Ads
- Access Token + Ad Account ID
- Get token at: <https://developers.facebook.com/tools/explorer/>

## Status Checks

```bash
node scripts/run.js status
```

The `status` command now uses the Gateway for Klaviyo and Google Ads, so it reflects the real workspace integration state instead of only checking the local auth file.

Possible gateway statuses:
- `ready`
- `not_authorized`
- `not_connected`
- `unknown`

If a Gateway platform is not connected, the correct next step is to go to **Bustly > Integrations** and authorize it before retrying.

Possible direct statuses:
- `ready`
- `not_configured`
- `incomplete`

## Notes

- `raw` / `native` commands are for agent-driven passthrough requests.
- Gateway mode does **not** expose provider credentials back to the CLI.
- Meta Ads remains direct for now.
