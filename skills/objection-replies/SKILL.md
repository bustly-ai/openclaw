---
name: "Objection Replies"
description: >-
  Draft public replies for purchase objections and trust blockers in ecommerce comments, reviews, and social replies. Use for conversion-risk objections, not routine customer service questions.
status: enabled
layer: ecommerce
sub_layer: customers
---
# Objection Replies

## Overview

This is the objection layer, not the generic reply layer. Handle price objections, trust doubts, efficacy concerns, comparison pressure, and shipping hesitation with short public replies, backup versions, and escalation rules.

## When to Use

- The public comment contains a buying objection, skepticism, or trust blocker.
- The team needs concise replies that reduce conversion leakage without escalating into refund handling or long-form support.

## Do Not Use When

- Do not use this skill for generic praise or simple clarifications; that belongs to a lighter reply flow.
- Do not argue with customers, shame them, or over-explain in public.
- Do not make performance, safety, or policy claims that are not approved.

## Required Inputs

- Original objection text
- Product facts, approved claims, and must-not-say items
- Platform or character constraints
- Desired action after the reply: continue publicly, move to DM, or hand to support

## Workflow

1. Classify the objection: price, trust, efficacy, shipping, fit, comparison, or policy.
2. Write the primary public reply to reduce friction without sounding defensive.
3. Write a backup version with a different tone or angle.
4. Add a DM handoff or support escalation if the issue is not safe to solve in public.
5. Capture FAQ language if the objection is recurring.

## Deliverables

- Primary public objection reply
- Backup reply variant
- Escalation / DM note
- FAQ reuse note for recurring objections

## Missing Data Protocol

- If product proof is missing, acknowledge the concern and avoid unsupported claims.
- If the objection hides a refund or safety issue, flag the need to move into a support workflow.

## Validation Loop

- Check that the reply reduces friction without drifting into generic customer support language.
- Verify the response length and tone fit the platform context.
