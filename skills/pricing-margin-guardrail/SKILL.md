---
name: "Pricing Guardrail"
description: >-
  Block margin-destroying pricing and discount actions by enforcing floor
  constraints. Trigger before any price change, promo launch, coupon creation,
  or discount approval workflow.
status: enabled
trigger: Activate before pricing/promo write actions.
cooldown: 0
layer: core
sub_layer: finance-tax
---
# Pricing Guardrail

## Purpose

Prevent margin-destroying price/discount actions and enforce floor constraints.

## Trigger Rules

Activate before pricing/promo write actions.

## Required Inputs

Cost data, fee model, margin floor, promo calendar.

## Workflow Contract

Simulate margin impact -> block violating actions -> suggest safe alternatives.

## Deliverables

Approved action set, blocked list, reason codes.

## Eval Cases

- Positive: Trigger intent clearly matches this skill and required inputs are available.
- Negative: If intent is outside this skill's boundary, route to a better skill and log reason.
- Quality: Output must include evidence fields, risk status, and next action.

## Benchmark Targets

Margin floor violations trend to zero.

## Improve Loop

- Record false-positive and false-negative triggers weekly.
- Update trigger wording and input requirements based on misses.
- Tighten workflow steps if verification repeatedly fails.

## Example

**User:** We want to run a 30% off sitewide coupon for Memorial Day. Can we do that without killing margins?

**Assistant:** Simulating a 30% discount against your cost data and fee model. Result: 12 of your 45 active SKUs would fall below the 15% margin floor. I am blocking those 12 from the coupon and suggesting a tiered approach -- 30% on high-margin SKUs, 20% on mid-tier, and 15% on the rest. Here is the approved and blocked list with reason codes.

## Applicable Scenarios and Triggers
- Applicable scenarios: Business tasks related to core/finance-tax.
- Trigger condition: Triggered when the user explicitly requires the `pricing-margin-guardrail` capability.
