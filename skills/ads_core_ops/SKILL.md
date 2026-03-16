---
name: ads_core_ops
category: advertising
api_type: multi
auth_type: platform-specific
description: |
  Unified advertising operations for Klaviyo, Google Ads, and Meta Ads. Use this skill when an agent needs to query advertising data like profiles, campaigns, ad groups, ads, or performance metrics. Supports Klaviyo (profiles, lists, campaigns, flows, events, metrics), Google Ads (customers, campaigns, ad groups, keywords), and Meta Ads (campaigns, ad sets, ads, insights).
---

This skill is the unified advertising layer inside `bustly-skills`.

It focuses on advertising operations across multiple platforms:

1. **Klaviyo**: Email marketing automation (profiles, lists, campaigns, flows, metrics)
2. **Google Ads**: Search and display advertising (customers, campaigns, ad groups, keywords)
3. **Meta Ads**: Facebook/Instagram advertising (campaigns, ad sets, ads, insights)

Use the standalone Node entrypoint directly:
`node skills/ads_core_ops/scripts/run.js ...`

## Architecture

`ads_core_ops` directly connects to third-party APIs without any intermediate proxy.

- All requests go directly to platform APIs (Klaviyo, Google Ads, Meta Ads)
- Credentials are stored locally in `~/.bustly/ads_credentials.json`
- No gateway or middleware - direct API calls with API keys

## Security Model

**IMPORTANT**: API Keys must NEVER be exposed in conversations.

- Always use `***hidden***` when displaying credentials
- Never log or print actual API key values
- If credentials are missing, guide users to the correct setup URL

## API Key Setup

### Klaviyo

1. Go to: https://www.klaviyo.com/create-private-api-key
2. Create a new Private API Key
3. Select required scopes (Profiles, Lists, Campaigns, etc.)
4. Copy the key (starts with `pk_`)

### Google Ads

1. Go to: https://developers.google.com/google-ads/api/docs/first-call/overview
2. Get Developer Token from Google Ads API Center
3. Create OAuth2 credentials in Google Cloud Console
4. Generate refresh token via OAuth flow

### Meta Ads

1. Go to: https://developers.facebook.com/tools/explorer/
2. Generate User Access Token with `ads_read` permission
3. Or create System User token in Business Manager (recommended, no expiration)

## Command Map

### Core Commands

```bash
# List all supported platforms
node skills/ads_core_ops/scripts/run.js platforms

# Show credential status for each platform
node skills/ads_core_ops/scripts/run.js status
```

### Configuration

```bash
# Show current config (API keys are hidden)
node skills/ads_core_ops/scripts/run.js config show

# Set Klaviyo API Key
node skills/ads_core_ops/scripts/run.js config set-klaviyo pk_xxx

# Set Google Ads config (JSON format)
node skills/ads_core_ops/scripts/run.js config set-google-ads '{"developerToken":"xxx","clientId":"xxx","clientSecret":"xxx","refreshToken":"xxx"}'

# Set Meta Ads config (JSON format)
node skills/ads_core_ops/scripts/run.js config set-meta-ads '{"accessToken":"xxx","adAccountId":"123456789"}'
```

### Klaviyo

```bash
# List profiles
node skills/ads_core_ops/scripts/run.js klaviyo profiles

# List email lists
node skills/ads_core_ops/scripts/run.js klaviyo lists

# List campaigns
node skills/ads_core_ops/scripts/run.js klaviyo campaigns

# List flows
node skills/ads_core_ops/scripts/run.js klaviyo flows

# List metrics
node skills/ads_core_ops/scripts/run.js klaviyo metrics
```

### Google Ads

```bash
# List accessible customer accounts
node skills/ads_core_ops/scripts/run.js google-ads customers

# List campaigns for a customer
node skills/ads_core_ops/scripts/run.js google-ads campaigns --customer-id 1234567890

# List ad groups
node skills/ads_core_ops/scripts/run.js google-ads ad-groups --customer-id 1234567890

# List keywords
node skills/ads_core_ops/scripts/run.js google-ads keywords --customer-id 1234567890

# Run GAQL query
node skills/ads_core_ops/scripts/run.js google-ads search --customer-id 1234567890 --query "SELECT campaign.id, campaign.name FROM campaign"
```

### Meta Ads

```bash
# Get ad account info
node skills/ads_core_ops/scripts/run.js meta-ads account

# List campaigns
node skills/ads_core_ops/scripts/run.js meta-ads campaigns

# List ad sets
node skills/ads_core_ops/scripts/run.js meta-ads adsets

# Get performance insights
node skills/ads_core_ops/scripts/run.js meta-ads insights --date-preset last_7d
node skills/ads_core_ops/scripts/run.js meta-ads insights --campaign-id 123456
```

## Error Handling

When API keys are missing or invalid, the CLI will:

1. Display a clear error message
2. Show the URL where to get the API key
3. Never expose partial credentials

Example error output:

```
❌ Error: Missing Klaviyo API Key

To get your Klaviyo API Key:
1. Go to: https://www.klaviyo.com/create-private-api-key
2. Create a new Private API Key
3. Copy the key (starts with 'pk_')

Then configure it:
  node dist/scripts/run.js config set-klaviyo pk_your_key_here
```

## Supported Platforms

| Platform   | API Endpoint                   | Auth Method              |
| ---------- | ------------------------------ | ------------------------ |
| Klaviyo    | `a.klaviyo.com/api`            | API Key (pk\_)           |
| Google Ads | `googleads.googleapis.com/v23` | OAuth2 + Developer Token |
| Meta Ads   | `graph.facebook.com/v25.0`     | Access Token             |

## References

- Klaviyo API: https://developers.klaviyo.com/
- Google Ads API: https://developers.google.com/google-ads/api/docs/
- Meta Ads API: https://developers.facebook.com/docs/marketing-api/
