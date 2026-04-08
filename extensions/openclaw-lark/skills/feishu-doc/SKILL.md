---
name: feishu-doc
description: |
  Read, create, and update Feishu cloud docs from markdown.
  Supports wiki/folder destination control and safe partial-update modes.
---

# Feishu Doc

## When To Use

Use this skill for all Feishu document lifecycle work:

- Create a new Feishu doc from markdown.
- Update an existing Feishu doc with scoped edits.
- Fetch and inspect an existing Feishu doc before editing.

## Supported Operations

- `fetch`: Read markdown content from a document or wiki URL/token.
- `create`: Create a new document from markdown.
- `update`: Apply targeted edits to an existing document.

## Update Modes

- `append`
- `overwrite` (use only when full replacement is intended)
- `replace_range`
- `replace_all`
- `insert_before`
- `insert_after`
- `delete_range`

## Critical Constraints

- Do not duplicate the title as the first H1 in markdown body.
- For create destination, priority is: `wiki_node` > `wiki_space` > `folder_token`.
- Prefer scoped updates over full overwrite.
- Range selectors must be unique and stable.
- For wiki links, resolve node/object type first before fetch/update.
- For large content, perform incremental append/update in chunks.

## Required/Optional Parameters

Create:

- Required: `markdown`
- Optional: `title`, `folder_token`, `wiki_node`, `wiki_space`

Update:

- Required: `doc_id`
- Optional: `mode`, `selection_with_ellipsis`, `new_str`, `new_title`

Fetch:

- Required: `doc_id` (URL or token)

## Output Expectations

Always return a structured summary:

- operation (`fetch` / `create` / `update`)
- success/failure
- `doc_id`
- `doc_url` when available
- mode used for updates
- warnings and follow-up suggestions
- async `task_id` if produced by the API

## Execution Pattern

1. Normalize input URL/token and resolve wiki node when needed.
2. If editing, fetch current content first and confirm scope.
3. Choose the safest operation/mode.
4. Execute create/update/fetch call.
5. Re-fetch when needed to verify changes.
6. Return result with explicit next action.
