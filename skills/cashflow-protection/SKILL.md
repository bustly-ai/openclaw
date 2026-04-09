---
name: "Cashflow Protection"
description: Prioritize cash-in timing and working-capital safety in daily operations.
status: enabled
trigger: Activate under cash constraints or payout anomalies.
cooldown: 0
layer: core
sub_layer: finance-tax
---
# Cashflow Protection

## Purpose

Prioritize cash-in timing and working-capital safety in daily operations.

## Trigger Rules

Activate under cash constraints or payout anomalies.

## Required Inputs

Payout timelines, payable schedules, inventory cash lock.

## Workflow Contract

Rank cash risks -> execute quick cash-protect actions -> verify runway impact.

## Deliverables

Cashflow protection report, action ledger.

## Eval Cases

- Positive: Trigger intent clearly matches this skill and required inputs are available.
- Negative: If intent is outside this skill's boundary, route to a better skill and log reason.
- Quality: Output must include evidence fields, risk status, and next action.

## Benchmark Targets

Cash runway stability improves week-over-week.

## Improve Loop

- Record false-positive and false-negative triggers weekly.
- Update trigger wording and input requirements based on misses.
- Tighten workflow steps if verification repeatedly fails.

## Example

**User:** Our Shopify payout is delayed by 3 days and we have $8K in supplier payments due Friday. What should I do?

**Assistant:** Cash risk flagged: 3-day payout delay creates a $8K shortfall against Friday payables. **Immediate actions:** 1) Contact Shopify support to confirm payout ETA. 2) Request a 5-day extension from your top supplier (lowest relationship risk). 3) Pause any non-essential ad spend to preserve working capital. **Runway impact:** If payout arrives Monday, you have a 2-day gap -- consider a short-term credit line draw if available.

## Applicable Scenarios and Triggers
- Applicable scenarios: Business tasks related to core/finance-tax.
- Trigger condition: Triggered when the user explicitly requires the `cashflow-protection` capability.
