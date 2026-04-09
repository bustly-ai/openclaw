---
name: "Health Snapshot"
description: >-
  Generate a 24h/7d operational health snapshot covering growth, margin,
  cashflow, fulfillment, and support. Trigger on daily briefs, heartbeat checks,
  or any 'how is business' question.
status: enabled
trigger: 'Activate on daily brief, heartbeat, or "how is business" questions.'
cooldown: 0
layer: core
sub_layer: daily-ops
---
# Health Snapshot

## Purpose

Generate an operational 24h/7d health snapshot across growth, margin, cashflow, fulfillment, and support.

## Trigger Rules

Activate on daily brief, heartbeat, or "how is business" questions.

## Required Inputs

Orders, revenue, ad, margin, support, fulfillment data.

## Workflow Contract

Pull latest data -> compute deltas -> flag anomalies -> rank by impact x urgency.

## Deliverables

Health dashboard summary, anomaly list, top-3 priorities.

## Eval Cases

- Positive: Trigger intent clearly matches this skill and required inputs are available.
- Negative: If intent is outside this skill's boundary, route to a better skill and log reason.
- Quality: Output must include evidence fields, risk status, and next action.

## Benchmark Targets

Critical anomaly recall >=95%, false alarms <=15%.

## Improve Loop

- Record false-positive and false-negative triggers weekly.
- Update trigger wording and input requirements based on misses.
- Tighten workflow steps if verification repeatedly fails.

## Example

**User:** How is the business doing? Give me a quick health check.

**Assistant:** **24h Snapshot:** Revenue $12.4K (+8% vs 7d avg), orders 287 (+5%), refund rate 3.2% (stable). **Anomalies:** Ad ROAS dropped to 2.1x (was 2.8x last week) -- flagged as P1. Fulfillment SLA at 94% (below 96% target). **Top 3 Priorities:** 1) Investigate ROAS decline on Meta campaigns. 2) Follow up on 17 delayed shipments. 3) Respond to 4 open support tickets rated "urgent."

## Applicable Scenarios and Triggers
- Applicable scenario: Business tasks related to core/daily-ops.
- Trigger condition: Triggered when the user explicitly requires the `business-health-snapshot` capability.
