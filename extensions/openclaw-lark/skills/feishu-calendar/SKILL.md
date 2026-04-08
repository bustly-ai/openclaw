---
name: feishu-calendar
description: |
  Manage Feishu calendars, events, attendees, and free/busy checks.
  Use this skill for scheduling, rescheduling, RSVP handling, and availability lookup.
---

# Feishu Calendar

## When To Use

Use this skill when the user needs to:
- Create or patch calendar events
- Search events in a time range
- Manage attendees and RSVP status
- Check participant availability

## Critical Constraints

- Use ISO8601/RFC3339 timestamps with timezone (default Asia/Shanghai).
- Event create minimum: `summary`, `start_time`, `end_time`.
- Prefer passing `user_open_id` from sender context.
- User IDs should use `ou_...` format.
- Room attendee booking is asynchronous; verify final status after create.

## Fast Mapping

- Create event: `feishu_calendar_event` / `create`
- List events: `feishu_calendar_event` / `list`
- Patch event: `feishu_calendar_event` / `patch`
- Search events: `feishu_calendar_event` / `search`
- RSVP reply: `feishu_calendar_event` / `reply`
- Recurrence instances: `feishu_calendar_event` / `instances`
- Freebusy: `feishu_calendar_freebusy` / `list`
- Add attendees: `feishu_calendar_event_attendee` / `create`

## Execution Pattern

1. Normalize participants and desired time window.
2. Check conflicts if scheduling sensitivity is high.
3. Create/update event with clear agenda and context.
4. Validate attendee/room status.
5. Return event URL + key follow-up actions.
