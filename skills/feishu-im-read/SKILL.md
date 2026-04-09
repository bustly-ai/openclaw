---
name: feishu-im-read
description: |
  Read Feishu IM messages, thread replies, and search across conversations.
  Supports image/file/media resource download from message payloads.
---

# Feishu IM Read

## When To Use

Use this skill for:
- Chat history retrieval (group or DM)
- Thread reply retrieval
- Cross-chat message search
- Downloading media/files from messages

## Critical Constraints

- `open_id` and `chat_id` are mutually exclusive in message list requests.
- Respect user authorization scope (read only chats user can access).
- Expand `thread_id` when context completeness matters.
- Use pagination when user requests full history.

## Fast Mapping

- Message list: `feishu_im_user_get_messages`
- Thread replies: `feishu_im_user_get_thread_messages`
- Cross-chat search: `feishu_im_user_search_messages`
- Resource download: `feishu_im_user_fetch_resource`

## Execution Pattern

1. Resolve target chat/user and time window.
2. Fetch recent messages.
3. Expand threads if relevant.
4. Download referenced media when requested.
5. Return structured findings with evidence pointers.
