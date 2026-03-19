# Ads Core Ops

Unified advertising operations for Klaviyo, Google Ads, and Meta Ads.

- **Klaviyo** → Gateway Mode
- **Google Ads** → Gateway Mode
- **Meta Ads** → Direct Mode

## Standard command surface

Preferred command contract:

```bash
bustly ops ads <command>
```

Repo-local fallback:

```bash
node scripts/bustly-ops.js ops ads <command>
```

Direct implementation fallback:

```bash
node skills/ops/ads_core_ops/scripts/run.js <command>
```

## Quick Start

### Discovery

```bash
bustly ops ads help
bustly ops ads platforms
bustly ops ads status
```

### Gateway Mode

```bash
# Klaviyo list APIs
bustly ops ads klaviyo profiles
bustly ops ads klaviyo campaigns --limit 20

# Klaviyo passthrough
bustly ops ads klaviyo raw --path /profiles --query '{"page[size]":20}'

# Google Ads preset reads
bustly ops ads google-ads customers
bustly ops ads google-ads campaigns --customer-id 1234567890

# Google Ads custom GAQL
bustly ops ads google-ads search \
  --customer-id 1234567890 \
  --query "SELECT campaign.id, campaign.name FROM campaign LIMIT 10"

# Google Ads passthrough
bustly ops ads google-ads raw \
  --path /customers/1234567890/googleAds:search \
  --body '{"query":"SELECT campaign.id, campaign.name FROM campaign LIMIT 10"}'
```

### Direct Mode (Meta Ads)

```bash
# Configure credentials
bustly ops ads config set-meta-ads '{"accessToken":"xxx","adAccountId":"123456789"}'

# Run commands
bustly ops ads meta-ads campaigns
bustly ops ads meta-ads insights --date-preset last_7d
```

## Supported Platforms

| Platform   | Mode    | Commands                                                                     |
| ---------- | ------- | ---------------------------------------------------------------------------- |
| Klaviyo    | Gateway | profiles, lists, segments, campaigns, flows, metrics, events, templates, raw |
| Google Ads | Gateway | customers, campaigns, ad-groups, keywords, ads, search, raw                  |
| Meta Ads   | Direct  | account, campaigns, adsets, ads, insights                                    |

## Status Checks

```bash
bustly ops ads status
```

The `status` command now uses the Gateway for Klaviyo and Google Ads, so it reflects the real workspace integration state instead of only checking the local auth file.

Possible gateway statuses:

- `ready`
- `not_authorized`
- `not_connected`
- `unknown`

Possible direct statuses:

- `ready`
- `not_configured`
- `incomplete`

## Notes

- `raw` / `native` commands are for agent-driven passthrough requests.
- Gateway mode does **not** expose provider credentials back to the CLI.
- Meta Ads remains direct for now.
