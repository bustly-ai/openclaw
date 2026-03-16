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

#### 1. Developer Token（开发者令牌）

**链接**: https://ads.google.com/aw/apicenter

步骤：

- 登录 Google Ads 管理员账户
- 进入 **Tools & Settings** → **API Center**
- 申请 Developer Token（测试账户可即时获得，生产账户需要 Google 审批）

#### 2. OAuth2 凭证

**链接**: https://console.cloud.google.com/apis/credentials

步骤：

1. 创建项目或选择现有项目
2. 启用 Google Ads API：https://console.cloud.google.com/apis/library/googleads.googleapis.com
3. 创建 OAuth 2.0 客户端 ID：
   - **Application type**: Web application 或 Desktop app
   - 添加 Authorized redirect URI: `http://localhost` 或 `urn:ietf:wg:oauth:2.0:oob`
4. 获取 `client_id` 和 `client_secret`

#### 3. Refresh Token

**方法 A**: 使用 OAuth Playground（推荐测试用）

**链接**: https://developers.google.com/oauthplayground

步骤：

1. 点击右上角 ⚙️ 设置，勾选 "Use your own OAuth credentials"
2. 填入你的 `client_id` 和 `client_secret`
3. 左侧输入 scope: `https://www.googleapis.com/auth/adwords`
4. 点击 "Authorize APIs"
5. 授权后点击 "Exchange authorization code for tokens"
6. 获取 `refresh_token`

**方法 B**: 手动 OAuth 流程

```
https://accounts.google.com/o/oauth2/v2/auth?
  client_id=YOUR_CLIENT_ID&
  redirect_uri=urn:ietf:wg:oauth:2.0:oob&
  response_type=code&
  scope=https://www.googleapis.com/auth/adwords&
  access_type=offline
```

#### 凭证配置命令

```bash
node skills/ads_core_ops/scripts/run.js config set-google-ads '{"developerToken":"xxx","clientId":"xxx","clientSecret":"xxx","refreshToken":"xxx"}'
```

#### 快速链接汇总

| 凭证             | 获取链接                                                               |
| ---------------- | ---------------------------------------------------------------------- |
| Developer Token  | https://ads.google.com/aw/apicenter                                    |
| Client ID/Secret | https://console.cloud.google.com/apis/credentials                      |
| Google Ads API   | https://console.cloud.google.com/apis/library/googleads.googleapis.com |
| Refresh Token    | https://developers.google.com/oauthplayground                          |

#### 常见问题

**问题**: `USER_PERMISSION_DENIED` 错误

**原因**: OAuth 授权的 Google 账户无权访问目标 Google Ads 客户账户

**解决方案**:

1. 确保用有权访问 Ads 账户的 Google 账户生成 refresh token
2. 或在 Google Ads 界面中将你的 Google 邮箱添加为账户用户（**工具和设置** → **访问权限**）

**问题**: `SERVICE_DISABLED` 错误

**原因**: Google Ads API 未在项目中启用

**解决方案**: 访问 API 启用链接并点击 Enable 按钮，等待几分钟生效

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
