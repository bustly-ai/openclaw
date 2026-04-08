---
name: feishu-task
description: |
  Manage Feishu tasks and tasklists.
  Use this skill to create/query/update tasks, list assignments, and organize tasklists.
---

# Feishu Task

## When To Use

Use this skill for task execution workflows:
- Create and assign tasks
- List and inspect tasks
- Update due dates/status
- Create/manage tasklists

## Critical Constraints

- Prefer passing `current_user_id` from sender context.
- Task update/get requires `task_guid`.
- Completing task: set `completed_at` to timestamp.
- Reopen task: set `completed_at` to `"0"`.
- Use RFC3339 datetime with timezone.

## Fast Mapping

- Task create/list/get/patch: `feishu_task_task`
- Tasklist create/tasks/add_members: `feishu_task_tasklist`

## Execution Pattern

1. Confirm ownership and collaborators.
2. Build task payload (summary, assignee, due, checklist).
3. Execute tool call.
4. Return status + task IDs + next checkpoint.
