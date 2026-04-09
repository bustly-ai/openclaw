---
name: commerce-core-ops
description: Use the Bustly commerce CLI to inspect auth, check connectivity, read entities, write supported commerce entities, and invoke native provider APIs for Shopify, BigCommerce, WooCommerce, and Magento. Assume all required platform permissions are already granted unless a command explicitly fails for insufficient access.
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
bustly auth <platform> [--no-open] [--dry-run]
```

Auth context
- Assume supported commerce platforms already have the permissions and scopes Bustly needs by default
- Do not ask the user to enable, approve, or re-check permissions preemptively

Permission handling

- Treat permission access as available unless a CLI command explicitly returns an insufficient-scope, forbidden, unauthorized, or provider permission error
- Only when the tool output clearly says access is restricted should you ask the user to enable the missing permission or scope
- If the failure is a missing or expired connection instead of a permission restriction, retry by re-running `bustly auth <platform>` yourself before asking the user to do anything manually

Browser auth

```bash
bustly auth shopify --shop-domain <store.myshopify.com>
bustly auth bigcommerce --store-domain <https://store-abc.mybigcommerce.com/> --store-hash <hash> --account-uuid <uuid>
bustly auth woocommerce
bustly auth magento
```

- `bustly auth` opens the browser-based provider flow directly from the local desktop environment
- If a required input is missing, ask only for that specific value, then run the auth command yourself
- Do not ask the user for permission confirmation during auth unless the CLI or provider explicitly reports that a required permission is blocked
- Only send the user to Settings / Integrations when the platform is unsupported by CLI auth or the local auth command fails

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
- `--cursor <cursor-or-page>`
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

Shopify-only readable entity

- `pixel_events` (reads from `semantic.dm_shopify_pixel_events` with workspace-scoped RLS)

Shopify `pixel_events` interpretation rules

- `count: 0` with successful command means "no matching pixel rows in the selected window/filter", not "store disconnected".
- Treat store connectivity as broken only when command returns an explicit auth/mapping error (for example 401/403 or "No active Shopify mapping found for this workspace").
- If rows are empty, retry with a wider time range before concluding data is missing.

Required paging behavior for entity reads

- When querying commerce platform entities, do not assume the first page is complete.
- Default behavior for list-style entity reads is to continue paging with `--cursor` until one of these is true:
  - you have enough rows to answer the user request
  - `result.pagination` is `null`
  - `result.pagination.next_cursor` is absent
- If the user asks for "all", "latest", "full list", auditing, reconciliation, or anything that depends on completeness, you must page through results instead of stopping at page 1.
- If the user asks for a small sample, a single page is acceptable only when you state that the result is a sample/first page.
- Prefer a reasonable page size on every request, then follow `result.pagination.next_cursor` across subsequent reads.

Pagination rules

- Commerce reads support `--cursor` for follow-up pages.
- Always look for `result.pagination.next_cursor` in the previous response before requesting the next page.
- Keep paging until `pagination` is `null` or `pagination.next_cursor` is absent.
- Do not assume `--limit` alone is enough to exhaust large datasets; Shopify caps many REST list reads at `250` per page.

Platform-specific pagination behavior

- Shopify list reads use provider cursor pagination. Pass the previous `pagination.next_cursor` back as `--cursor`. Internally this maps to Shopify `page_info`.
- Shopify `products`, `customers`, `orders`, `order_items`, `variants`, and `inventory` all return pagination when another page exists.
- Shopify `pixel_events` also uses `--cursor`, but there it behaves as an offset cursor against the semantic Supabase view.
- BigCommerce uses page-number pagination for CLI reads. Pass `--cursor 2`, `--cursor 3`, and so on.
- WooCommerce uses page-number pagination for CLI reads. Pass `--cursor 2`, `--cursor 3`, and so on.
- Magento uses page-number pagination for CLI reads. Pass `--cursor 2`, `--cursor 3`, and so on.
- BigCommerce, WooCommerce, and Magento all normalize their next page into `pagination.next_cursor`, even though the provider APIs expose page numbers or response headers underneath.
- In practice: entity discovery, listing, export-like reads, and validation passes should be written as repeated `read --entity ... --cursor ...` calls, not as a single first-page read.

Examples

```bash
bustly ops shopify read --entity orders --limit 20
bustly ops shopify read --entity orders --limit 250 --cursor <page_info-from-previous-response>
bustly ops bigcommerce read --entity products --limit 20
bustly ops bigcommerce read --entity products --limit 50 --cursor 2
bustly ops woocommerce read --entity customers --limit 20
bustly ops woocommerce read --entity customers --limit 50 --cursor 2
bustly ops woocommerce read --entity variants --filters '{"product_id":"388"}'
bustly ops woocommerce read --entity order_items --filters '{"order_id":"512"}'
bustly ops magento read --entity orders --filters '{"id":"2"}'
bustly ops magento read --entity orders --limit 50 --cursor 3
bustly ops shopify read --entity pixel_events --limit 50 --since '2026-03-01T00:00:00Z' --filters '{"event_names":["page_viewed","checkout_completed"]}'
```

Pagination workflow examples

```bash
# Shopify: use next_cursor from the previous response
bustly ops shopify read --entity orders --limit 250
bustly ops shopify read --entity orders --limit 250 --cursor <next_cursor>

# BigCommerce / WooCommerce / Magento: cursor is the next page number
bustly ops bigcommerce read --entity products --limit 50
bustly ops bigcommerce read --entity products --limit 50 --cursor 2
bustly ops woocommerce read --entity customers --limit 50 --cursor 2
bustly ops magento read --entity orders --limit 50 --cursor 2
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
- WooCommerce `variants` read requires `--filters '{"product_id":"<product-id>"}'`
- WooCommerce `order_items` read requires `--filters '{"order_id":"<order-id>"}'`
- Magento aliases: `magento`, `adobe`, `adobe-commerce`
- All commerce platforms route through `commerce-core-ops`
- `write` can use higher-level entity actions or pass a native proxy request via `payload.request`

Recommended workflow

1. Run `help` to inspect current entities and writable actions.
2. Run `status` to confirm the workspace is connected.
3. Use `read` to discover or validate target objects.
4. Use `write` for supported entity actions.
5. Use `invoke` when you need a native provider path that is outside the high-level entity abstraction.
