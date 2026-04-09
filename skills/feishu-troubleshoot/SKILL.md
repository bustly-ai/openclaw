---
name: feishu-troubleshoot
description: |
  Diagnose Feishu plugin issues and permission failures.
  Includes FAQ triage and deep doctor command guidance.
---

# Feishu Troubleshoot

## When To Use

Use this skill when Feishu integration behaves abnormally, especially:
- authorization loops
- callback/permission mismatch
- tool calls failing after prior success

## Quick FAQ

- Card click no response often means callback event permission is missing.
- Re-check app callback subscription and publish status in Feishu Open Platform.

## Deep Diagnosis

Run doctor workflow when FAQ does not solve the issue.
Command intent:
- inspect account config
- test API connectivity
- validate app scopes
- validate user authorization state

Return:
- root cause summary
- fix steps
- verification checklist
