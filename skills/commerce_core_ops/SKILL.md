---
name: commerce_core_ops
description: Use when you need to inspect or operate commerce systems through the Bustly ops runtime, including Shopify, BigCommerce, WooCommerce, and Magento. Trigger for requests about stores, providers, connections, products, orders, customers, inventory, catalog reads, product updates, inventory adjustments, or commerce diagnostics. Prefer this skill over generic browser exploration when the task is about structured store or commerce account data.
metadata: {"openclaw":{"skillKey":"commerce_core_ops","aliases":["commerce"],"commandNamespace":"bustly ops","discoveryCommand":"bustly ops commerce help","defaultCommand":"bustly ops commerce providers","commandExamples":["bustly ops commerce providers","bustly ops commerce connections","bustly ops commerce auth","bustly ops commerce read --platform shopify --entity orders --limit 50","bustly ops commerce write:product --platform shopify --op update --payload '{\"id\":\"gid://shopify/Product/123\",\"title\":\"Bustly Commerce Tee\"}'"],"runtimePackage":"@bustly/skill-runtime-commerce-core-ops","runtimeVersion":"^0.1.0","runtimeInstallSpec":"npm:@bustly/skill-runtime-commerce-core-ops@^0.1.0","runtimeExecutable":"bustly-skill-commerce","runtimeNotes":["Users and agents should invoke this skill through `bustly ops commerce ...`.","OpenClaw should ensure the runtime package is installed on first use, then route through the shared `bustly ops` dispatcher.","This repo intentionally keeps this skill declaration-only; runtime execution lives in the published package."]}}
---

# Commerce Core Ops

Use this skill for structured commerce/store reads and supported commerce write operations.

Do not default to browser/manual exploration first when the request is about:
- store connections or provider discovery
- Shopify / BigCommerce / WooCommerce / Magento data reads
- orders, products, customers, inventory, or catalog inspection
- product updates or inventory adjustments
- commerce account diagnostics

## Command contract

Primary command surface:

```bash
bustly ops commerce <command>
```

Underlying runtime executable:

```text
bustly-skill-commerce
```

Runtime package:

```text
@bustly/skill-runtime-commerce-core-ops
```

## Typical discovery / read commands

Start here when you need to understand what commerce providers are connected:

```bash
bustly ops commerce help
bustly ops commerce providers
bustly ops commerce connections
bustly ops commerce auth
```

Common reads / writes:

```bash
bustly ops commerce read --platform shopify --entity orders --limit 50
bustly ops commerce write:product --platform shopify --op update --payload '{"id":"gid://shopify/Product/123","title":"Bustly Commerce Tee"}'
```

## Platform coverage

- **Shopify**
- **BigCommerce**
- **WooCommerce**
- **Magento**

## Agent guidance

- Prefer this skill whenever the user asks to inspect stores, orders, products, customers, or inventory in a structured way.
- Use `bustly ops commerce providers` or `bustly ops commerce connections` first when you need quick discovery.
- If the runtime is not installed yet, OpenClaw should lazy-install it from the declared runtime package before executing the command.
- Only fall back to browser/manual inspection if this skill is unavailable or the runtime path fails.
