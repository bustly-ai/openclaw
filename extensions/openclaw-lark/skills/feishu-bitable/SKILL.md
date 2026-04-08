---
name: feishu-bitable
description: |
  Manage Feishu Bitable apps, tables, fields, views, and records.
  Use this skill when the user needs to create/query/update/delete Bitable data,
  batch-import rows, or configure table schema.
---

# Feishu Bitable

## When To Use

Use this skill when the user asks for:
- Bitable app or table creation
- Record CRUD (single or batch)
- Field or view management
- Data import/cleanup operations

## Critical Constraints

- Always list fields before writing records.
- Field value shape must match field type exactly.
- Person fields require `[{"id":"ou_xxx"}]` (open_id).
- Datetime fields require **millisecond** timestamps.
- Batch operations are atomic and should stay <= 500 rows per call.
- Writes to the same table should be serialized (avoid concurrent writes).

## Fast Mapping

- List fields: `feishu_bitable_app_table_field` / `list`
- List records: `feishu_bitable_app_table_record` / `list`
- Create record: `feishu_bitable_app_table_record` / `create`
- Batch create: `feishu_bitable_app_table_record` / `batch_create`
- Update record: `feishu_bitable_app_table_record` / `update`
- Batch update: `feishu_bitable_app_table_record` / `batch_update`
- Create app: `feishu_bitable_app` / `create`
- Create table: `feishu_bitable_app_table` / `create`
- Create field: `feishu_bitable_app_table_field` / `create`
- Create view: `feishu_bitable_app_table_view` / `create`

## Execution Pattern

1. Confirm target app/table and business intent.
2. Fetch current schema and validate field types.
3. Build type-safe payloads.
4. Execute writes in bounded batches.
5. Return a concise result report (created/updated/failed counts + next action).
