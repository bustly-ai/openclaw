---
name: "Checkout Recovery"
description: >-
  Design a recovery program for abandoned checkout in ecommerce and DTC stores. Use when checkout drop-off is high and the team needs a sequence, offer guardrails, and a validation plan.
status: enabled
layer: ecommerce
sub_layer: customers
---
# Checkout Recovery

## Overview

This is a recovery playbook skill, not a system-trigger automation. Diagnose why checkout abandonment is happening, decide which segments deserve rescue, and return a ready-to-run recovery sequence with offer guardrails and success checks.

## When to Use

- Checkout abandonment or cart recovery is materially below target.
- The team needs to decide whether to use reminders, incentives, manual outreach, or checkout fixes first.
- There is enough context on abandonment rate, order value, and lifecycle stage to build a rescue sequence.

## Do Not Use When

- Do not claim emails, SMS, discounts, or workflows were actually launched.
- Do not recommend blanket discounting before checking margin, fraud, and repeat-purchase risk.
- Do not treat checkout abandonment as purely messaging if payment friction or shipping shock is the root cause.

## Required Inputs

- Abandonment rate, benchmark, and time window
- Average order value and key SKUs or segments
- Current checkout flow, payment methods, shipping policy, and existing recovery channels
- Margin guardrails and incentive limits
- Any observed friction signals or customer feedback

## Workflow

1. Separate structural friction from recoverable hesitation: payment, shipping, trust, price, or distraction.
2. Prioritize rescue segments by value, urgency, and recoverability.
3. Design a 3-touch sequence with timing, channel, message goal, and incentive guardrails.
4. Add high-value manual follow-up rules and explicit stop-loss rules for discount leakage.
5. Return a 7-14 day validation plan with recovery rate, AOV, and abuse checks.

## Deliverables

- Root-cause summary with segment priorities
- Three-step recovery sequence
- Offer guardrails and abuse risks
- Validation plan and next test decision

## Missing Data Protocol

- If abandonment data is incomplete, ask for at least rate, AOV, and current recovery setup before drafting the sequence.
- If margin limits are unknown, give a no-discount baseline path and label incentive assumptions explicitly.

## Validation Loop

- Check that the recovery sequence matches the diagnosed cause instead of defaulting to discounts.
- Verify every touch has one purpose, one CTA, and one success metric.
- Call out where checkout UX fixes should precede any recovery messaging.
