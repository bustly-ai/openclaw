---
name: commerce_core_ops
category: ecommerce
api_type: hybrid
auth_type: jwt
description: Unified commerce runtime for Shopify, BigCommerce, WooCommerce, and Magento. Use this skill when the agent needs workspace-scoped commerce reads (products/orders/customers/inventory) and product write operations with strict auth (JWT + workspace membership + active subscription).
metadata: {"openclaw":{"skillKey":"commerce_core_ops","aliases":["commerce"],"commandNamespace":"bustly","discoveryCommand":"bustly-commerce help","defaultCommand":"bustly-commerce providers","commandExamples":["bustly-commerce providers","bustly-commerce auth","bustly-commerce read --platform shopify --entity orders --limit 50","bustly-commerce write:product --platform shopify --op update --payload '{\"id\":\"gid://shopify/Product/123\",\"title\":\"Bustly Commerce Tee\"}'","bustly commerce providers","bustly ops commerce providers"],"runtimePackage":"@bustly/skill-runtime-commerce-core-ops","runtimeVersion":"^0.1.0","runtimeInstallSpec":"npm:@bustly/skill-runtime-commerce-core-ops@^0.1.0","runtimeExecutable":"bustly-commerce","runtimeNotes":["Preferred execution: `bustly-commerce ...` (direct runtime command).","Compatibility: `bustly commerce ...` and `bustly ops commerce ...` are still supported.","Desktop packaging should bundle runtime + shim commands so end users do not need local Node/npm setup."]}}
---

## What This Skill Solves

- Single commerce entry for 4 platforms:
  - Shopify
  - BigCommerce
  - WooCommerce
  - Magento
- Read path for core entities:
  - `products`, `orders`, `customers`, `inventory`, `variants`, `shop_info`, `order_items`
- Write path for product-centric operations:
  - `create`, `update`, `upsert`, `delete`, `inventory_adjust`, `publish`, `unpublish`, `variants_bulk_update`
- Guardrails:
  - JWT validity
  - `user_id` and JWT subject consistency
  - workspace membership status
  - workspace status and subscription window

## Agent Operating Rules

When user asks for store data or product edits:
- Prefer this skill first, do not fall back to ad-hoc SQL.
- Start with a narrow read (`--limit`, explicit `--entity`), then expand if needed.
- For write operations, echo target platform + operation + payload summary before execution.
- If auth fails, report exactly which check failed (JWT / membership / subscription), and stop.

## Primary Commands (Direct-first)

```bash
# discovery / status
bustly-commerce help
bustly-commerce providers
bustly-commerce connections
bustly-commerce auth

# reads
bustly-commerce read --platform shopify --entity orders --limit 50
bustly-commerce read --platform bigcommerce --entity products --limit 20
bustly-commerce read --platform woocommerce --entity customers --limit 20
bustly-commerce read --platform magento --entity inventory --limit 50

# writes
bustly-commerce write:product --platform shopify --op update --payload '{"id":"gid://shopify/Product/123","title":"Bustly Commerce Tee"}'
bustly-commerce write:product --platform bigcommerce --op create --payload '{"name":"New Product","sku":"SKU123"}'
```

Compatibility aliases (still valid):
- `bustly commerce ...`
- `bustly ops commerce ...`

## Runtime Contract

The runtime package must keep:
- stable JSON output for agent parsing
- platform adapters isolated by provider
- unified auth checks before any provider call
- machine-readable errors with clear failure reason
