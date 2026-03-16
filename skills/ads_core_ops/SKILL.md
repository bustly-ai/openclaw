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

#### 1. Developer Token

**URL**: https://ads.google.com/aw/apicenter

Steps:

- Log in to your Google Ads manager account
- Go to **Tools & Settings** → **API Center**
- Apply for a Developer Token (test accounts get it instantly, production accounts require Google approval)

#### 2. OAuth2 Credentials

**URL**: https://console.cloud.google.com/apis/credentials

Steps:

1. Create a project or select an existing one
2. Enable Google Ads API: https://console.cloud.google.com/apis/library/googleads.googleapis.com
3. Create OAuth 2.0 Client ID:
   - **Application type**: Web application or Desktop app
   - Add Authorized redirect URI: `http://localhost` or `urn:ietf:wg:oauth:2.0:oob`
4. Get `client_id` and `client_secret`

#### 3. Refresh Token

**Method A**: Use OAuth Playground (recommended for testing)

**URL**: https://developers.google.com/oauthplayground

Steps:

1. Click ⚙️ settings in the top right, check "Use your own OAuth credentials"
2. Enter your `client_id` and `client_secret`
3. Enter scope on the left: `https://www.googleapis.com/auth/adwords`
4. Click "Authorize APIs"
5. After authorization, click "Exchange authorization code for tokens"
6. Get your `refresh_token`

**Method B**: Manual OAuth flow

```
https://accounts.google.com/o/oauth2/v2/auth?
  client_id=YOUR_CLIENT_ID&
  redirect_uri=urn:ietf:wg:oauth:2.0:oob&
  response_type=code&
  scope=https://www.googleapis.com/auth/adwords&
  access_type=offline
```

#### Credential Configuration Command

```bash
node skills/ads_core_ops/scripts/run.js config set-google-ads '{"developerToken":"xxx","clientId":"xxx","clientSecret":"xxx","refreshToken":"xxx"}'
```

#### Quick Links Summary

| Credential       | URL                                                                    |
| ---------------- | ---------------------------------------------------------------------- |
| Developer Token  | https://ads.google.com/aw/apicenter                                    |
| Client ID/Secret | https://console.cloud.google.com/apis/credentials                      |
| Google Ads API   | https://console.cloud.google.com/apis/library/googleads.googleapis.com |
| Refresh Token    | https://developers.google.com/oauthplayground                          |

#### Common Issues

**Issue**: `USER_PERMISSION_DENIED` error

**Cause**: The OAuth-authorized Google account does not have access to the target Google Ads customer account

**Solution**:

1. Ensure you generate the refresh token with a Google account that has access to the Ads account
2. Or add your Google email as a user in the Google Ads interface (**Tools & Settings** → **Access**)

**Issue**: `SERVICE_DISABLED` error

**Cause**: Google Ads API is not enabled in the project

**Solution**: Visit the API enablement link and click the Enable button, wait a few minutes for it to take effect

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
