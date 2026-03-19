---
name: ads_core_ops
description: Use when you need to inspect or query advertising systems through the Bustly ops runtime, including Google Ads, Meta Ads, and Klaviyo. Trigger for requests about ad accounts, campaigns, ad groups, ads, audiences, profiles, lists, flows, performance metrics, spend, clicks, conversions, customer/account inspection, or advertising diagnostics. Prefer this skill over generic browser exploration when the task is about reading structured ads or marketing account data.
metadata: {"openclaw":{"skillKey":"ads_core_ops","aliases":["ads"],"commandNamespace":"bustly ops","discoveryCommand":"bustly ops ads help","defaultCommand":"bustly ops ads platforms","commandExamples":["bustly ops ads platforms","bustly ops ads status","bustly ops ads klaviyo campaigns","bustly ops ads google-ads customers","bustly ops ads meta-ads insights --date-preset last_7d"],"runtimePackage":"@bustly/skill-runtime-ads-core-ops","runtimeVersion":"^0.1.0","runtimeInstallSpec":"npm:@bustly/skill-runtime-ads-core-ops@^0.1.0","runtimeExecutable":"bustly-skill-ads","runtimeNotes":["Users and agents should invoke this skill through `bustly ops ads ...`.","OpenClaw should ensure the runtime package is installed on first use, then route through the shared `bustly ops` dispatcher.","This repo intentionally keeps this skill declaration-only; runtime execution lives in the published package."]}}
---

# Ads Core Ops

Use this skill for structured advertising and marketing account reads.

Do not default to browser/manual exploration first when the request is about:
- Google Ads account or customer inspection
- Meta Ads account, campaign, or insight reads
- Klaviyo profiles, lists, campaigns, or flows
- advertising performance diagnosis
- spend / clicks / conversions / impressions / campaign status questions

## Command contract

Primary command surface:

```bash
bustly ops ads <command>
```

Underlying runtime executable:

```text
bustly-skill-ads
```

Runtime package:

```text
@bustly/skill-runtime-ads-core-ops
```

## Typical discovery / read commands

Start here when you need to understand what is connected:

```bash
bustly ops ads help
bustly ops ads platforms
bustly ops ads status
```

Common reads:

```bash
bustly ops ads klaviyo campaigns
bustly ops ads google-ads customers
bustly ops ads meta-ads insights --date-preset last_7d
```

## Platform coverage

- **Google Ads** — customers, campaigns, ad groups, keywords, ads, metrics
- **Meta Ads** — account/campaign/ad insights and diagnostics
- **Klaviyo** — profiles, lists, campaigns, flows, messaging/performance surfaces

## Agent guidance

- Prefer this skill whenever the user asks to "看广告账户数据", inspect ad accounts, check campaign metrics, or diagnose advertising performance.
- Use `bustly ops ads platforms` or `bustly ops ads status` first when you need quick discovery.
- If the runtime is not installed yet, OpenClaw should lazy-install it from the declared runtime package before executing the command.
- Only fall back to browser/manual inspection if this skill is unavailable or the runtime path fails.
