---
name: commerce_core_ops
category: ecommerce
api_type: hybrid
auth_type: jwt
description: Unified commerce operations for Shopify, BigCommerce, WooCommerce, and Magento. This skill is declaration-first: OpenClaw should treat it as a pluggable skill contract and resolve execution through the published runtime package instead of assuming repo-local scripts. Use this skill when an agent needs one workspace-scoped entrypoint for product, order, customer, or inventory reads plus product writes.
metadata: {"openclaw":{"skillKey":"commerce_core_ops","aliases":["commerce"],"commandNamespace":"bustly ops","discoveryCommand":"bustly ops commerce help","defaultCommand":"bustly ops commerce providers","commandExamples":["bustly ops commerce providers","bustly ops commerce connections","bustly ops commerce auth","bustly ops commerce read --platform shopify --entity orders --limit 50","bustly ops commerce write:product --platform shopify --op update --payload '{\"id\":\"gid://shopify/Product/123\",\"title\":\"Bustly Commerce Tee\"}'"],"runtimePackage":"@bustly/skill-runtime-commerce-core-ops","runtimeVersion":"^0.1.0","runtimeInstallSpec":"npm:@bustly/skill-runtime-commerce-core-ops@^0.1.0","runtimeExecutable":"bustly-skill-commerce","runtimeNotes":["Users and agents should invoke this skill through `bustly ops commerce ...`.","OpenClaw should ensure the runtime package is installed on first use, then route through the shared `bustly ops` dispatcher.","This repo intentionally keeps this skill declaration-only; runtime execution lives in the published package."]}}
---

## Role in the architecture

`commerce_core_ops` is a declaration-only skill in this repo.

That means:
- this `SKILL.md` remains the contract OpenClaw reads
- runtime logic is published via the runtime package
- OpenClaw should lazy-install that runtime package on first `bustly ops commerce ...` execution

## Preferred execution contract

Logical command contract exposed to the agent:

```bash
bustly ops commerce <command>
```

Target runtime package:

```text
@bustly/skill-runtime-commerce-core-ops
```

Underlying packaged runtime executable:

```text
bustly-skill-commerce
```

## Scope

This skill focuses on two goals only:

1. Data reads (product/order/customer/inventory)
2. Product writes (import/create/update/delete/inventory adjust)

## Core command surface

```bash
bustly ops commerce help
bustly ops commerce providers
bustly ops commerce connections
bustly ops commerce auth
bustly ops commerce read --platform shopify --entity orders --limit 50
bustly ops commerce write:product --platform shopify --op update --payload '{"id":"gid://shopify/Product/123","title":"Bustly Commerce Tee"}'
```

## Runtime expectations

The runtime package behind this skill should provide:

1. provider routing for Shopify / BigCommerce / WooCommerce / Magento
2. workspace-scoped auth + billing validation
3. stable command parsing for the `bustly ops commerce ...` contract
4. consistent read/write adapters
5. machine-readable error output for OpenClaw consumption

## Migration rule

Treat the package metadata above as canonical. User-facing invocation should stay on `bustly ops commerce ...`, while execution is resolved through the packaged runtime.
