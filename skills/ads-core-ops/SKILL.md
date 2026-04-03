---
name: ads-core-ops
description: Use the Bustly ads CLI to inspect auth, check connectivity, read entities, write supported entities, and invoke native provider APIs for Klaviyo, Google Ads, and Google Analytics. Assume all required platform permissions are already granted unless a command explicitly fails for insufficient access.
metadata:
  {
    "openclaw":
      {
        "requires": { "bins": ["bustly"] }
      },
  }
---

# Ads Core Ops

Use this skill when you need Bustly marketing and ads operations through the local CLI.

Supported platforms

- `klaviyo`
- `google-ads`
- `google-analytics`

CLI shape

```bash
bustly ops <platform> <command> [args...]
bustly auth <platform> [--no-open] [--dry-run]
```

Auth context

- Assume supported ads platforms already have the permissions and scopes Bustly needs by default
- Do not ask the user to enable, approve, or re-check permissions preemptively

Permission handling

- Treat permission access as available unless a CLI command explicitly returns an insufficient-scope, forbidden, unauthorized, or provider permission error
- Only when the tool output clearly says access is restricted should you ask the user to enable the missing permission or scope
- If the failure is a missing or expired connection instead of a permission restriction, retry by re-running `bustly auth <platform>` yourself before asking the user to do anything manually

Browser auth

```bash
bustly auth klaviyo
bustly auth google-ads
bustly auth google-analytics
```

- `bustly auth` opens the desktop browser flow for supported providers
- If the command succeeds, tell the user to finish the OAuth confirmation in the browser that just opened
- Do not ask the user for permission confirmation during auth unless the CLI or provider explicitly reports that a required permission is blocked
- Only fall back to "go to Integrations and connect it" if `bustly auth` is unavailable or fails

Available commands on every ads platform

- `platforms`
- `status`
- `auth`
- `read`
- `write`
- `invoke`

Common flags

- `--entity <entity>`
- `--limit <n>`
- `--filters '<json>'`
- `--customer-id <customer-id>`
- `--action <action>`
- `--payload '<json>'`
- `--method <GET|POST|PUT|PATCH|DELETE>`
- `--path <relative-provider-path>`
- `--query "<gaql>"` for Google Ads `read --entity search`
- `--query '<json>'` for native `invoke` query params
- `--headers '<json>'`
- `--body '<json>'`

Status

```bash
bustly ops klaviyo status
bustly ops google-ads status
bustly ops google-analytics status
```

Auth

```bash
bustly ops klaviyo auth
```

Klaviyo

Readable entities

- `profiles`
- `lists`
- `segments`
- `campaigns`
- `flows`
- `metrics`
- `events`
- `templates`

Writable actions

- `profiles`: `update`
- `lists`: `update`
- `segments`: `update`
- `campaigns`: `update`
- `flows`: `update`
- `metrics`: `update`
- `events`: `update`
- `templates`: `update`

Examples

```bash
bustly ops klaviyo help
bustly ops klaviyo read --entity profiles --limit 20
bustly ops klaviyo read --entity campaigns --filters '{"channel":"email"}'
bustly ops klaviyo write --entity profiles --action update --payload '{"request":{"method":"GET","path":"/profiles/01KJVWSQK8Y7W1HHS919AJ7AG9"}}'
bustly ops klaviyo invoke --method GET --path /profiles/ --query '{"page[size]":20}'
```

Google Ads

Readable entities

- `customers`
- `campaigns`
- `ad_groups`
- `keywords`
- `ads`
- `search`

Writable actions

- `customers`: `update`
- `campaigns`: `update`
- `ad_groups`: `update`
- `keywords`: `update`
- `ads`: `update`
- `search`: `update`

Google Ads notes

- Most entity reads require `--customer-id <customer-id>`
- `search` additionally requires a GAQL query
- `customers` read uses `GET /customers:listAccessibleCustomers` to enumerate accessible accounts
- Native Google Ads requests sent through `write` still go through provider path restrictions; allowed paths include `GET /customers/{id}` plus supported `search` and `mutate` endpoints

Examples

```bash
bustly ops google-ads help
bustly ops google-ads read --entity customers
bustly ops google-ads read --entity campaigns --customer-id 8922277297
bustly ops google-ads write --entity customers --action update --payload '{"request":{"method":"GET","path":"/customers/8922277297"}}'
bustly ops google-ads read --entity search --customer-id 8922277297 --query "SELECT campaign.id, campaign.name FROM campaign LIMIT 10"
bustly ops google-ads write --entity search --action update --payload '{"request":{"method":"POST","path":"/customers/8922277297/googleAds:search","body":{"query":"SELECT campaign.id FROM campaign LIMIT 1"}}}'
bustly ops google-ads invoke --method POST --path /customers/8922277297/googleAds:search --body '{"query":"SELECT campaign.id FROM campaign LIMIT 10"}'
```

Google Analytics

Readable entities

- `accounts`
- `properties`
- `audiences`
- `custom_dimensions`
- `reports`

Writable actions

- `properties`: `create`, `update`, `delete`
- `audiences`: `create`, `update`, `delete`
- `custom_dimensions`: `create`, `update`, `delete`

Google Analytics notes

- `accounts` read uses `GET /accountSummaries`
- `properties` supports `--account-id <account-id>` or `--property-id <property-id>`
- `audiences`, `custom_dimensions`, and `reports` require `--property-id <property-id>`
- `reports` defaults to GA4 Data API `runReport` with `date`, `activeUsers`, and `sessions` when no explicit report body is passed
- Native Google Analytics requests sent through `write` and `invoke` are restricted to Admin API resources plus supported Data API report endpoints

Examples

```bash
bustly ops google-analytics help
bustly ops google-analytics read --entity accounts
bustly ops google-analytics read --entity properties --account-id 123456
bustly ops google-analytics read --entity audiences --property-id 483291314
bustly ops google-analytics read --entity reports --property-id 483291314 --metrics activeUsers,sessions --dimensions date
bustly ops google-analytics write --entity properties --action update --payload '{"request":{"method":"GET","path":"/properties/483291314"}}'
bustly ops google-analytics invoke --method POST --path /properties/483291314:runReport --body '{"dateRanges":[{"startDate":"7daysAgo","endDate":"today"}],"dimensions":[{"name":"date"}],"metrics":[{"name":"activeUsers"}],"limit":"10"}'
```

Platform notes

- Klaviyo aliases: `klaviyo`
- Klaviyo `campaigns` read defaults to `channel=email` when no `filter` or `channel` is provided
- Google Ads aliases: `google-ads`, `googleads`
- Google Analytics aliases: `google-analytics`, `googleanalytics`, `ga4`
- All three platforms route through `ads-core-ops`
- `invoke` is the escape hatch for native provider-relative requests
- `write` can be used with `payload.request` when a native request shape is required

Recommended workflow

1. Run `help` to inspect entities and writable actions.
2. If the user asks to connect a supported platform, run `bustly auth <platform>` first.
3. Run `status` to confirm the workspace is connected.
4. Use `read` to verify the target object or discover IDs.
5. Use `write` for supported entity actions.
6. Use `invoke` for provider-native calls that are not covered by the high-level entity command.
