---
name: source-product
description: AliExpress product sourcing skill for product discovery (text/image) and product detail retrieval via workspace-secured edge functions.
metadata: {"openclaw":{"skillKey":"source-product","aliases":["source_product","source","aliexpress-source"],"commandNamespace":"bustly","discoveryCommand":"bustly-source-product help","defaultCommand":"bustly-source-product get:accounts","commandExamples":["bustly-source-product get:accounts","bustly-source-product search:text \"wireless earbuds\"","bustly-source-product search:image \"https://example.com/product.jpg\"","bustly-source-product get:product --product-id \"1005001234567890\""],"runtimePackage":"@bustly/skill-runtime-source-product","runtimeVersion":"^0.1.0","runtimeInstallSpec":"npm:@bustly/skill-runtime-source-product@^0.1.0","runtimeExecutable":"bustly-source-product","runtimeNotes":["Preferred execution: bustly-source-product ...","No repo-local script fallback."]}}
---

## Command Contract

Always use runtime command:

```bash
bustly-source-product <command> [args]
```

Do not call `{baseDir}/scripts/run.js` directly from this skill contract.

## Supported Commands

- `get:accounts`
- `test:token`
- `search:text`
- `search:image`
- `get:product`

## Example

```bash
bustly-source-product search:text "wireless earbuds"
bustly-source-product search:image "https://example.com/iphone-case.jpg"
bustly-source-product get:product --url "https://www.aliexpress.com/item/1005001234567890.html"
```
