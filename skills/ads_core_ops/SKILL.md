---
name: ads_core_ops
description: Unified advertising runtime for Klaviyo, Google Ads, and Meta Ads. Use this skill for campaign/insight reads with strict workspace auth for gateway-backed platforms and local credential handling for Meta Ads.
metadata: {"openclaw":{"skillKey":"ads_core_ops","aliases":["ads"],"commandNamespace":"bustly","discoveryCommand":"bustly-ads help","defaultCommand":"bustly-ads platforms","commandExamples":["bustly-ads platforms","bustly-ads status","bustly-ads auth","bustly-ads klaviyo campaigns --limit 20","bustly-ads google-ads customers","bustly-ads meta-ads insights --date-preset last_7d","bustly ads platforms","bustly ops ads platforms"],"runtimePackage":"@bustly/skill-runtime-ads-core-ops","runtimeVersion":"^0.1.0","runtimeInstallSpec":"npm:@bustly/skill-runtime-ads-core-ops@^0.1.0","runtimeExecutable":"bustly-ads","runtimeNotes":["Preferred execution: `bustly-ads ...` (direct runtime command).","Compatibility: `bustly ads ...` and `bustly ops ads ...` are still supported.","Desktop packaging should bundle runtime + shim commands so end users do not need local Node/npm setup."]}}
---

## What This Skill Solves

- Unified ads entry for:
  - Klaviyo
  - Google Ads
  - Meta Ads
- Gateway-backed auth checks (Klaviyo/Google Ads):
  - JWT validity
  - workspace membership
  - workspace active status
  - workspace subscription active window
- Direct mode for Meta Ads with local credentials.

## Platform Modes

| Platform | Mode | Details |
|----------|------|---------|
| Klaviyo | Gateway | Route requests through the Supabase Edge Function. |
| Google Ads | Gateway | Route requests through the Supabase Edge Function. |
| Meta Ads | Direct | Use local credentials from the current machine. |

## Agent Operating Rules

When user asks ad performance analysis:
- Use `status` + platform-specific reads first.
- Keep first query narrow (`--limit`, explicit fields), then deepen.
- If gateway auth fails, return exact failing check and stop.
- If Meta Ads credentials missing, guide user to `config` command and rerun.

## Primary Commands (Direct-first)

```bash
# discovery / status
bustly-ads help
bustly-ads platforms
bustly-ads status
bustly-ads auth

# gateway reads
bustly-ads klaviyo profiles --limit 20
bustly-ads klaviyo campaigns --limit 20
bustly-ads google-ads customers
bustly-ads google-ads campaigns --customer-id 1234567890 --limit 20

# direct meta ads
bustly-ads config set-meta-ads '{"accessToken":"xxx","adAccountId":"123456789"}'
bustly-ads meta-ads campaigns
bustly-ads meta-ads insights --date-preset last_7d
```

Compatibility aliases (still valid):
- `bustly ads ...`
- `bustly ops ads ...`

## Runtime Contract

The runtime package must keep:
- stable JSON output for agent parsing
- strict gateway auth validation
- provider-specific adapters isolated by platform
- machine-readable errors with actionable hints
