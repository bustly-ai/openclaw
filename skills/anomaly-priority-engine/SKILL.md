---
name: "Anomaly Prioritizer"
description: 'Prioritize detected issues into stop-loss, efficiency, and growth queues.'
status: enabled
trigger: Activate when multiple anomalies exist.
cooldown: 0
layer: core
sub_layer: analytics
---
# Anomaly Prioritizer

## Purpose

Prioritize detected issues into stop-loss, efficiency, and growth queues.

## Trigger Rules

Activate when multiple anomalies exist.

## Required Inputs

Anomaly list with estimated impact and confidence.

## Workflow Contract

Score anomalies -> rank -> assign queue -> attach recommended action.

## Deliverables

Prioritized queue, action candidates, confidence and risk notes.

## Eval Cases

- Positive: Trigger intent clearly matches this skill and required inputs are available.
- Negative: If intent is outside this skill's boundary, route to a better skill and log reason.
- Quality: Output must include evidence fields, risk status, and next action.

## Benchmark Targets

Top-3 anomaly ranking accepted >=85% by operators.

## Improve Loop

- Record false-positive and false-negative triggers weekly.
- Update trigger wording and input requirements based on misses.
- Tighten workflow steps if verification repeatedly fails.

## Example

**User:** We have 5 anomalies flagged today: ad spend spike, shipping delay increase, refund rate jump, homepage traffic drop, and email open rate decline. Which should I tackle first?

**Assistant:** Prioritized queue: **Stop-loss** -- #1 Refund rate jump (high revenue impact, immediate cash drain). #2 Shipping delay increase (customer trust risk, escalating). **Efficiency** -- #3 Ad spend spike (investigate before more budget burns). **Growth** -- #4 Homepage traffic drop (monitor 48h, likely algorithmic). #5 Email open rate (low urgency, test subject lines next send). Recommended first action: audit refund reasons from last 24h for root cause.

## Applicable Scenarios and Triggers
- Applicable scenarios: Business tasks related to core/analytics.
- Trigger condition: Triggered when the user explicitly requires the `anomaly-priority-engine` capability.
