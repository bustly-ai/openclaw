---
name: ads_core_ops
description: Unified advertising operations for Klaviyo, Google Ads, and Meta Ads. This skill is declaration-first: OpenClaw should treat it as a pluggable skill contract and resolve execution through the published runtime package instead of assuming repo-local scripts. Use when an agent needs to inspect or query advertising data such as profiles, lists, campaigns, flows, metrics, customers, ad groups, keywords, ads, or insights.
metadata: {"openclaw":{"skillKey":"ads_core_ops","aliases":["ads"],"commandNamespace":"bustly ops","discoveryCommand":"bustly ops ads help","defaultCommand":"bustly ops ads platforms","fallbackCommand":"node scripts/bustly-ops.js ops ads platforms","commandExamples":["bustly ops ads platforms","bustly ops ads status","bustly ops ads klaviyo campaigns","bustly ops ads google-ads customers","bustly ops ads meta-ads insights --date-preset last_7d"],"runtimePackage":"@bustly/skill-runtime-ads-core-ops","runtimeVersion":"^0.1.0","runtimeInstallSpec":"npm:@bustly/skill-runtime-ads-core-ops@^0.1.0","runtimeExecutable":"bustly-skill-ads","runtimeNotes":["Users and agents should invoke this skill through `bustly ops ads ...`.","OpenClaw should ensure the runtime package is installed, then route through the shared `bustly ops` dispatcher.","The bustly-skills repo intentionally keeps the original local implementation for development and fallback."]}}
---

## Role in the architecture

`ads_core_ops` is a declaration + test skill.

That means:
- this `SKILL.md` remains the contract OpenClaw reads
- runtime logic is published via the runtime package
- the bustly-skills repo may still keep the local implementation for development, debugging, and compatibility

## Preferred execution contract

Logical command contract exposed to the agent:

```bash
bustly ops ads <command>
```

Target runtime package:

```text
@bustly/skill-runtime-ads-core-ops
```

Underlying packaged runtime executable:

```text
bustly-skill-ads
```

## Platform Modes

| Platform | Mode | Details |
|----------|------|---------|
| Klaviyo | Gateway | Route requests through the Supabase Edge Function. |
| Google Ads | Gateway | Route requests through the Supabase Edge Function. |
| Meta Ads | Direct | Use local credentials from the current machine. |

## Core command surface

```bash
bustly ops ads help
bustly ops ads platforms
bustly ops ads status
bustly ops ads klaviyo campaigns
bustly ops ads google-ads customers
bustly ops ads meta-ads insights --date-preset last_7d
```

## Runtime expectations

The runtime package behind this skill should provide:

1. provider routing for Klaviyo / Google Ads / Meta Ads
2. auth + workspace checks for gateway-backed platforms
3. local credential handling for Meta Ads
4. stable command parsing for the `bustly ops ads ...` contract
5. machine-readable error output for OpenClaw consumption

## Migration rule

Treat the package metadata above as canonical. User-facing invocation should stay on `bustly ops ads ...`, while execution is resolved through the packaged runtime.
