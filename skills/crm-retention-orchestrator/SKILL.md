---
name: "CRM Retention Orchestrator"
description: Drive repeat purchase with lifecycle flows and churn-risk interventions.
status: enabled
trigger: Activate on repeat-rate goals or retention checks.
cooldown: 0
layer: core
sub_layer: crm
---
# CRM Retention Orchestrator

## Purpose

Drive repeat purchase with lifecycle flows and churn-risk interventions.

## Trigger Rules

Activate on repeat-rate goals or retention checks.

## Required Inputs

Customer cohorts, purchase history, campaign assets.

## Workflow Contract

Segment cohorts -> trigger lifecycle actions -> monitor conversion lift.

## Deliverables

Retention action plan, triggered campaigns, uplift report.

## Eval Cases

- Positive: Trigger intent clearly matches this skill and required inputs are available.
- Negative: If intent is outside this skill's boundary, route to a better skill and log reason.
- Quality: Output must include evidence fields, risk status, and next action.

## Benchmark Targets

Repeat-rate uplift >=10% over 30-day window.

## Improve Loop

- Record false-positive and false-negative triggers weekly.
- Update trigger wording and input requirements based on misses.
- Tighten workflow steps if verification repeatedly fails.

## Example

**User:** Our 60-day repeat purchase rate dropped from 28% to 19%. What lifecycle flows should we set up to recover it?

**Assistant:** Segmenting your buyer cohorts by first-purchase category and recency. Top actions: (1) Deploy a post-purchase education sequence at day 3 for consumable SKUs. (2) Trigger a win-back offer at day 45 for lapsed buyers. (3) Add a replenishment reminder at day 25 for top repeat products. Expected repeat-rate uplift: +8-12% over 30 days. Monitoring weekly with cohort conversion tracking.

## Applicable Scenarios and Triggers
- Applicable scenarios: core/crm related business tasks.
- Trigger condition: Triggered when the user explicitly requires the `crm-retention-orchestrator` capability.
