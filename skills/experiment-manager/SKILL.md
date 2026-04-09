---
name: "Experiment Manager"
description: Design and track controlled experiments with guardrails and rollback criteria.
status: enabled
trigger: Activate on optimization requests and hypothesis testing.
cooldown: 0
layer: core
sub_layer: analytics
---
# Experiment Manager

## Purpose

Design and track controlled experiments with guardrails and rollback criteria.

## Trigger Rules

Activate on optimization requests and hypothesis testing.

## Required Inputs

Hypothesis, baseline KPI, guardrails, traffic split.

## Workflow Contract

Define experiment -> launch staged test -> evaluate significance -> decide keep/rollback.

## Deliverables

Experiment spec, result summary, action decision.

## Eval Cases

- Positive: Trigger intent clearly matches this skill and required inputs are available.
- Negative: If intent is outside this skill's boundary, route to a better skill and log reason.
- Quality: Output must include evidence fields, risk status, and next action.

## Benchmark Targets

At least 70% of shipped experiments have clear conclusion.

## Improve Loop

- Record false-positive and false-negative triggers weekly.
- Update trigger wording and input requirements based on misses.
- Tighten workflow steps if verification repeatedly fails.

## Example

**User:** I want to test whether adding customer reviews to our product page improves add-to-cart rate. Help me design the experiment.

**Assistant:** Experiment spec: Hypothesis -- adding review snippets below the product image increases add-to-cart rate by 10%+. Baseline: current add-to-cart rate 6.2%. Traffic split: 50/50 A/B test. Guardrail: bounce rate must not increase by more than 5%. Duration: 14 days at current traffic for statistical significance. Rollback criteria: if add-to-cart drops below 5.5% in variant, auto-stop the test. Decision framework: ship if uplift >= 8% with p < 0.05.

## Applicable Scenarios and Triggers
- Applicable scenarios: Business tasks related to core/analytics.
- Trigger condition: Triggered when the user explicitly requires the "experiment-manager" capability.
