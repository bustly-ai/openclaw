# Ads Core Ops

Unified advertising operations for Klaviyo, Google Ads, and Meta Ads. Direct API calls without any intermediate proxy.

## Installation

```bash
cd skills/ads_core_ops
```

No npm install needed - pure JavaScript with no dependencies.

## Quick Start

```bash
# Configure API Keys
node scripts/run.js config set-klaviyo pk_your_api_key
node scripts/run.js config set-google-ads '{"developerToken":"xxx","clientId":"xxx","clientSecret":"xxx","refreshToken":"xxx"}'
node scripts/run.js config set-meta-ads '{"accessToken":"xxx","adAccountId":"123456789"}'

# Run commands
node scripts/run.js klaviyo profiles
node scripts/run.js google-ads customers
node scripts/run.js meta-ads campaigns
```

## Supported Platforms

| Platform   | Commands                                           | API Endpoint               |
| ---------- | -------------------------------------------------- | -------------------------- |
| Klaviyo    | profiles, lists, campaigns, flows, metrics, events | `a.klaviyo.com/api`        |
| Google Ads | customers, campaigns, ad-groups, keywords, search  | `googleads.googleapis.com` |
| Meta Ads   | account, campaigns, adsets, ads, insights          | `graph.facebook.com`       |

## Authentication

### Klaviyo

- API Key (starts with `pk_`)
- Get it at: https://www.klaviyo.com/create-private-api-key

### Google Ads

- Developer Token
- OAuth2 Client (clientId, clientSecret, refreshToken)
- Get it at: https://developers.google.com/google-ads/api/docs/first-call/overview

### Meta Ads

- Access Token (User Token or System User Token)
- Ad Account ID
- Get it at: https://developers.facebook.com/tools/explorer/

## Architecture

```
Agent → ads_core_ops CLI
        ↓
   Direct API calls to platforms
        ↓
┌──────────┬──────────────┬──────────────┐
│  Klaviyo │ Google Ads   │  Meta Ads    │
│   API    │    API       │    API       │
└──────────┴──────────────┴──────────────┘
```

## Credentials File

All credentials are stored in `~/.bustly/ads_credentials.json`:

```json
{
  "klaviyo": {
    "apiKey": "pk_xxx",
    "revision": "2026-01-15"
  },
  "google-ads": {
    "developerToken": "xxx",
    "clientId": "xxx.apps.googleusercontent.com",
    "clientSecret": "xxx",
    "refreshToken": "xxx",
    "loginCustomerId": "1234567890"
  },
  "meta-ads": {
    "accessToken": "xxx",
    "adAccountId": "123456789"
  }
}
```
