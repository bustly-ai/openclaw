---
name: commerce_core_ops
category: ecommerce
api_type: hybrid
auth_type: jwt
description: Unified commerce operations for Shopify, BigCommerce, WooCommerce, and Magento. Prefer the standard CLI contract `bustly ops commerce <command>` so agents can discover commands without depending on internal script paths. Use this skill when an agent needs one workspace-scoped entrypoint for product, order, customer, or inventory reads plus product writes.
metadata:
  {
    "openclaw":
      {
        "skillKey": "commerce_core_ops",
        "aliases": ["commerce"],
        "commandNamespace": "bustly ops",
        "discoveryCommand": "bustly ops commerce help",
        "defaultCommand": "bustly ops commerce providers",
        "fallbackCommand": "node skills/ops/commerce_core_ops/scripts/run.js providers",
        "commandExamples":
          [
            "bustly ops commerce providers",
            "bustly ops commerce connections",
            "bustly ops commerce read --platform shopify --entity orders --limit 50",
            'bustly ops commerce write:product --platform shopify --op update --payload ''{"id":"gid://shopify/Product/123","title":"Bustly Commerce Tee"}''',
          ],
      },
  }
---

This skill is the unified commerce layer inside `bustly-skills`.

## Preferred CLI contract

Use the standardized entrypoint first:

```bash
bustly ops commerce <command>
```

Repo-local fallback when the `bustly` launcher is not on `PATH`:

```bash
node scripts/bustly-ops.js ops commerce <command>
```

Direct script fallback only when debugging the skill implementation itself:

```bash
node skills/ops/commerce_core_ops/scripts/run.js <command>
```

It focuses on two goals only:

1. Data reads (product/order/customer/inventory)
2. Product writes (import/create/update/delete/inventory adjust)

## Architecture

`commerce_core_ops` is intentionally a hybrid skill.

- Most provider skills in this repo follow the GraphQL or REST proxy pattern.
- `commerce_core_ops` sits above them and gives agents one operator-facing entrypoint.
- Reads and writes go to platform APIs (not semantic warehouse tables).
- Internally it uses provider adapters so agent commands stay unified.

### Read Path (all platforms)

- **Shopify / BigCommerce / WooCommerce / Magento**: `/functions/v1/commerce-core-ops` with `action=DIRECT_READ`
- Auth check is unified first (JWT + workspace + member + subscription), then provider adapter executes platform API calls.

### Write Path

- **Shopify / BigCommerce / WooCommerce / Magento**: `/functions/v1/commerce-core-ops` with `action=DIRECT_WRITE`
- Same unified auth gate, then provider-specific write adapter.

## Security Model (Required)

Before every read/write command:

1. Validate JWT (`auth/v1/user`)
2. Verify active `workspace_members` membership
3. Verify workspace record is ACTIVE
4. Verify `workspace_billing_windows` has an ACTIVE non-expired window (`valid_from <= now < valid_to`)
5. Ensure `user_id` matches JWT subject
6. Enforce request-scoped `workspace_id` and `user_id`

The CLI does this automatically (unless explicit debug bypass flags are used).

## Command Map

### Discovery / Core

```bash
bustly ops commerce help
bustly ops commerce providers
bustly ops commerce connections
bustly ops commerce auth
```

### Read

```bash
bustly ops commerce read shopify products --limit 20 --since 2026-01-01
bustly ops commerce read shopify orders --limit 50 --since 2026-03-01
bustly ops commerce read shopify orders --limit 50 --since 2026-03-01 --filter '{"since_field":"updated_at"}'
bustly ops commerce read:entity --platform woocommerce --entity orders --limit 50 --since 2026-01-01
bustly ops commerce read:entity --platform magento --entity order_items --order-id 100001234
```

Shopify order reads default `since` filtering to `processed_at` (for historical import/mock windows).  
If you need the old behavior, pass `filters.since_field=updated_at`.

### Product Write (all platforms)

```bash
bustly ops commerce write:product --platform shopify --op update --payload '{"id":"gid://shopify/Product/123","title":"Bustly Commerce Tee"}' --function commerce-core-ops
bustly ops commerce write:product --platform bigcommerce --op create --payload '{"name":"Sample","sku":"sample-1","price":19.99}' --function commerce-core-ops
bustly ops commerce write:product --platform woocommerce --op update --payload '{"id":"385","name":"New Name"}' --function commerce-core-ops
bustly ops commerce write:product --platform magento --op inventory_adjust --payload '{"sku":"sample-1","delta":5}' --function commerce-core-ops
```

## References

- `README.md` - local usage and environment notes
- `references/contracts.md` - direct product write API contract
- `references/edge-function-commerce-core-ops.ts` - secure direct read/write edge function (JWT + workspace + Nango-backed token)
- `scripts/run.js` - skill implementation entrypoint behind `bustly ops commerce ...`
