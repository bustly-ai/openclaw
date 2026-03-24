---
title: "TOOLS.md Template"
summary: "Workspace template for TOOLS.md"
read_when:
  - Bootstrapping a workspace manually
---

# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Which Bustly skill to use for which kind of task
- Platform-specific gotchas you keep forgetting
- Naming conventions used in ad accounts or stores
- Workspace-specific thresholds or filters
- Safe defaults for repeated tool calls
- Anything environment-specific

## Examples

```markdown
### source-product

- Use `source-product` first for supplier discovery, product search, and AliExpress detail lookup
- If the user shows a product image but there is no usable file path, ask for an image URL before using image search
- Prefer `get:product` when you already have an AliExpress URL or product ID
- Treat sourcing results as candidate supply, not final merchandising decisions

### ads-core-ops

- Use `ads-core-ops` for campaign reads, account inspection, and performance diagnosis
- Google Ads queries require the correct `customer-id`; do not guess
- Klaviyo is usually CRM / lifecycle marketing, not paid media
- Meta Ads credentials are local to this machine; if they are missing, report a setup gap directly

### commerce-core-ops

- Use `commerce-core-ops` for unified store reads and operational actions across Shopify / BigCommerce / WooCommerce / Magento
- Before claiming "no store connected", consider auth, membership, and billing blockers first
- Prefer read operations first; ask before live writes
- For product updates, switch to platform-native payloads when schema mismatch appears

### Naming Conventions

- "NC" = new customer
- "Ret" = retargeting
- "Hero SKU" = top-priority product to watch closely

### Alert Heuristics

- Refund spike = abnormal vs recent baseline, not just one bad day
- ROAS drop should be checked with spend and conversion together
- Inventory risk should consider days of cover, not only raw stock count
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.
