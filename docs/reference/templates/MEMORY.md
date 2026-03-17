---
title: "MEMORY.md Template"
summary: "Durable workspace memory template"
read_when:
  - Bootstrapping a workspace manually
---

# MEMORY.md - Durable Workspace Facts

_This file stores stable facts about the workspace. Prefer confirmed facts over guesses._

## Workspace

- **Workspace Name:** {{ WORKSPACE_NAME }}
- **Workspace ID:** {{ WORKSPACE_ID }}
- **Workspace Status:** {{ WORKSPACE_STATUS }}
- **Industry:** {{ WORKSPACE_INDUSTRY }}
- **Primary operator:** {{ OPERATOR_NAME }} ({{ OPERATOR_EMAIL }})
- **Member count:** {{ MEMBER_COUNT }}

## Commerce Facts

{{ COMMERCE_STORES }}

## Sourcing Facts

{{ SOURCING_CONNECTIONS }}

## Marketing Facts

{{ MARKETING_PLATFORMS }}

## Monitoring Facts

- **Timezone:** {{ TIMEZONE }}
- **Billing:** {{ BILLING_SUMMARY }}
- **Pulse:** {{ PULSE_STATUS }}

## Known Gaps

{{ GAPS }}
