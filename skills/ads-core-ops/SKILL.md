---
name: ads-core-ops
description: Use the Bustly ads CLI to inspect auth, check connectivity, read entities, write supported entities, and invoke native provider APIs for Klaviyo and Google Ads.
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

CLI shape

```bash
bustly ops <platform> <command> [args...]
bustly auth <platform> [--no-open] [--dry-run]
```

Auth context

- Local auth state is loaded from `~/.bustly/bustlyOauth.json`
- Required values include `supabase.url`, `supabase.anonKey`, `user.userAccessToken`, `user.workspaceId`, and `user.userId`
- For supported providers, start missing OAuth connections yourself with `bustly auth <platform>` before telling the user to open Integrations manually

Browser auth

```bash
bustly auth klaviyo
bustly auth google-ads
```

- `bustly auth` opens the desktop browser flow for supported providers
- If the command succeeds, tell the user to finish the OAuth confirmation in the browser that just opened
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

Platform notes

- Klaviyo aliases: `klaviyo`
- Klaviyo `campaigns` read defaults to `channel=email` when no `filter` or `channel` is provided
- Google Ads aliases: `google-ads`, `googleads`
- Both platforms route through `ads-core-ops`
- `invoke` is the escape hatch for native provider-relative requests
- `write` can be used with `payload.request` when a native request shape is required

Recommended workflow

1. Run `help` to inspect entities and writable actions.
2. If the user asks to connect a supported platform, run `bustly auth <platform>` first.
3. Run `status` to confirm the workspace is connected.
4. Use `read` to verify the target object or discover IDs.
5. Use `write` for supported entity actions.
6. Use `invoke` for provider-native calls that are not covered by the high-level entity command.
