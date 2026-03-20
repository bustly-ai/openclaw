---
name: commerce_core_ops
description: Use the Bustly commerce CLI to inspect auth, check connectivity, read entities, write supported commerce entities, and invoke native provider APIs for Shopify, BigCommerce, WooCommerce, and Magento.
metadata:
  {
    "openclaw":
      {
        "requires": { "bins": ["bustly"] }
      },
  }
---

# Commerce Core Ops

Use this skill when you need Bustly commerce operations through the local CLI.

Supported platforms

- `shopify`
- `bigcommerce`
- `woocommerce`
- `magento`

CLI shape

```bash
bustly ops <platform> <command> [args...]
```

Auth context

- Local auth state is loaded from `~/.bustly/bustlyOauth.json`
- Required values include `supabase.url`, `supabase.anonKey`, `user.userAccessToken`, `user.workspaceId`, and `user.userId`

Common commands

```bash
bustly ops shopify help
bustly ops shopify status
bustly ops shopify auth
bustly ops shopify read --entity products --limit 20
bustly ops shopify write --entity products --action update --payload '{"id":"8092752347229","title":"Updated title"}'
bustly ops shopify invoke --method GET --path /admin/api/2025-01/shop.json
```

Available commands on every commerce platform

- `platforms`
- `status`
- `auth`
- `read`
- `write`
- `invoke`

Common flags

- `--entity <entity>`
- `--limit <n>`
- `--since <iso-timestamp>`
- `--filters '<json>'`
- `--action <action>`
- `--payload '<json>'`
- `--method <GET|POST|PUT|PATCH|DELETE>`
- `--path <relative-provider-path>`
- `--query '<json>'` for native `invoke` query params
- `--headers '<json>'`
- `--body '<json>'`

Status

```bash
bustly ops shopify status
bustly ops bigcommerce status
bustly ops woocommerce status
bustly ops magento status
```

Auth

```bash
bustly ops shopify auth
```

Read

Readable commerce entities on every commerce platform

- `products`
- `orders`
- `customers`
- `inventory`
- `variants`
- `shop_info`
- `order_items`

Examples

```bash
bustly ops shopify read --entity orders --limit 20
bustly ops bigcommerce read --entity products --limit 20
bustly ops woocommerce read --entity customers --limit 20
bustly ops magento read --entity orders --filters '{"id":"2"}'
```

Write

Current writable actions by platform

Shopify

- `products`: `create`, `update`, `upsert`, `delete`, `publish`, `unpublish`
- `inventory`: `update`
- `variants`: `update`
- `orders`: `update`
- `customers`: `update`
- `shop_info`: `update`
- `order_items`: `update`

BigCommerce

- `products`: `create`, `update`, `upsert`, `delete`
- `inventory`: `update`
- `orders`: `update`
- `customers`: `update`
- `variants`: `update`
- `shop_info`: `update`
- `order_items`: `update`

WooCommerce

- `products`: `create`, `update`, `upsert`, `delete`
- `inventory`: `update`
- `orders`: `update`
- `customers`: `update`
- `variants`: `update`
- `shop_info`: `update`
- `order_items`: `update`

Magento

- `products`: `create`, `update`, `delete`
- `inventory`: `update`
- `orders`: `update`
- `customers`: `update`
- `variants`: `update`
- `shop_info`: `update`
- `order_items`: `update`

Write examples

```bash
bustly ops shopify write --entity products --action publish --payload '{"publicationId":"gid://shopify/Publication/1","productIds":["gid://shopify/Product/1"]}'
bustly ops bigcommerce write --entity products --action update --payload '{"request":{"method":"PUT","path":"/v3/catalog/products/77","body":{"name":"[Sample] Fog Linen Chambray Towel - Beige Stripe"}}}'
bustly ops woocommerce write --entity products --action update --payload '{"request":{"method":"PUT","path":"/wp-json/wc/v3/products/388","body":{"name":"Monitor Top Storage Shelf"}}}'
bustly ops magento write --entity inventory --action update --payload '{"sku":"bustly-e2e-test-sku","qty":9,"item_id":1}'
```

Invoke

Use `invoke` for provider-relative native API calls.

Examples

```bash
bustly ops shopify invoke --method GET --path /admin/api/2025-01/shop.json
bustly ops bigcommerce invoke --method GET --path /v3/catalog/summary
bustly ops woocommerce invoke --method GET --path /wp-json/wc/v3/system_status
bustly ops magento invoke --method GET --path /V1/store/storeConfigs
```

Platform notes

- Shopify aliases: `shopify`
- BigCommerce aliases: `bigcommerce`, `bc`
- WooCommerce aliases: `woocommerce`, `woo`, `wc`
- Magento aliases: `magento`, `adobe`, `adobe-commerce`
- All commerce platforms route through `commerce-core-ops`
- `write` can use higher-level entity actions or pass a native proxy request via `payload.request`

Recommended workflow

1. Run `help` to inspect current entities and writable actions.
2. Run `status` to confirm the workspace is connected.
3. Use `read` to discover or validate target objects.
4. Use `write` for supported entity actions.
5. Use `invoke` when you need a native provider path that is outside the high-level entity abstraction.
