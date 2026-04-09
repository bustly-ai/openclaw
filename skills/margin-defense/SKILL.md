---
name: "Margin Defense"
description: Protect gross and net margin when growth pressure rises.
status: enabled
trigger: Activate when margin drops or discount pressure increases.
cooldown: 0
layer: core
sub_layer: finance-tax
---
# Margin Defense

## Purpose

Protect gross and net margin when growth pressure rises.

## Trigger Rules

Activate when margin drops or discount pressure increases.

## Required Inputs

Cost/margin data, promo plans, channel mix.

## Workflow Contract

Detect margin leaks -> block harmful moves -> substitute safer actions.

## Deliverables

Margin defense actions, blocked moves list.

## Eval Cases

- Positive: Trigger intent clearly matches this skill and required inputs are available.
- Negative: If intent is outside this skill's boundary, route to a better skill and log reason.
- Quality: Output must include evidence fields, risk status, and next action.

## Benchmark Targets

Margin floor recovery within target window.

## Improve Loop

- Record false-positive and false-negative triggers weekly.
- Update trigger wording and input requirements based on misses.
- Tighten workflow steps if verification repeatedly fails.

## Example

**User:** Our gross margin dropped from 42% to 35% after last week's promo push. How do we stop the bleed?

**Assistant:** Margin leak detected in 3 areas: (1) 20% site-wide discount ran 2 days longer than planned -- block further extensions. (2) Free shipping threshold was lowered from $50 to $25, adding $3.40/order fulfillment cost. (3) High-cost SKUs were over-indexed in promo traffic. Actions: restore shipping threshold to $50, cap future discounts at 15% for items below 30% margin, and shift ad spend toward higher-margin SKUs. Expected recovery to 40%+ margin within 10 days.

## Applicable Scenarios and Triggers
- Applicable scenarios: Business tasks related to core/finance-tax.
- Trigger condition: Triggered when the user explicitly requires the `margin-defense` capability.
