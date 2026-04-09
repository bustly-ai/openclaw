---
name: "Private Label Brand Moat Builder"
description: >-
  Strengthen private-label moat via assortment discipline and brand assets. Use
  when the team needs a decision-ready plan, path choice, or go / no-go
  recommendation.
status: enabled
trigger: Activate for private-label growth plans.
cooldown: 0
layer: ecommerce
sub_layer: store-ops
---
# Private Label Brand Moat Builder

## Overview

Strengthen private-label moat via assortment discipline and brand assets. Use when the team needs a decision-ready plan, path choice, or go / no-go recommendation.

## When to Use

- The request is fundamentally about listing, pricing, launch, or store-ops decisions, and the next step is unclear and the operator needs sequencing, thresholds, or a rollout plan.
- The team could take action immediately if Private Label Brand Moat Builder returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

## Do Not Use When

- Do not pretend a system mutation happened if the skill only has analysis or drafting context.
- Do not keep this skill active when the request clearly belongs to a narrower adjacent skill.
- Do not use this skill when the user already has a fixed plan and only needs one asset or one mutation executed.
- Do not recommend every path at once just to avoid choosing.

## Required Inputs

- page / listing / store scope
- traffic or business context
- primary KPI or pain signal
- hard constraints
- timeline and owner constraints
- what success should look like after the first review window

## Deliverables

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- sequenced plan with timing
- what to do now / later / not yet
- success metrics and switch conditions
- page / listing / launch decision summary

## Workflow

1. Confirm the objective, timing, and non-negotiable constraints before proposing paths.
2. Normalize the current state into a short evidence table and identify the main constraint that limits speed.
3. Choose the first path, the second path, and the explicit things to delay rather than spraying effort everywhere.
4. Turn the path choice into a short execution plan with owners, timing, and a stop / switch rule.
5. End with measurable success criteria and the earliest point to review / pivot the plan.
6. Separate traffic-quality issues from page / offer / catalog execution issues.

## Output Format

1. Conclusion / verdict
2. Key evidence or context table
3. Priority actions or draft output
4. Risks / caveats / missing data
5. Recommended next steps

- Show what to do now, what to delay, and what signal should trigger a plan change.

## Boundary and Routing

- Keep this skill focused on path choice and sequencing; route narrow asset creation or system mutation work downstream.
- If the user already has a fixed plan and only needs one asset, switch to the narrower generator / execution skill.

## Quality Rules

- Separate observed facts, user-provided facts, and assumptions.
- Do not invent exact numbers, specs, claims, certifications, or outcomes that were not provided or verified.
- Prefer the shortest useful answer shape that an operator can actually hand off.
- Choose a first path; avoid giving five equal-priority options just to stay safe.
- Tie each recommendation to a review window and an operator owner.

## Missing Data Protocol

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (page scope, KPI baseline, or traffic context), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

## Validation Loop

- Recheck: primary conversion KPI / friction signal / launch blocker count.
- Review window: after the first sprint / launch checkpoint.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

## Success Metrics

- the operator knows the top 3-5 fixes
- the output distinguishes now / later / not yet
- one measurable KPI or gate is named for the next review

## Portfolio Logic

- Separate hero-SKU protection, tail cleanup, and brand-building bets instead of treating the assortment as one pool.
- Tie portfolio recommendations to contribution margin, repeat signal, and operational complexity.

## Example

**Scenario:** 某DTC品牌当前35个SKU中20%为自有品牌(复购率38%)、80%代销(复购率12%)，计划6个月内将自有品牌SKU占比从20%提升至50%，需要构建品牌护城河策略和产品路线图

**Expected response shape:**
- Start with the conclusion or verdict.
- Show the evidence or assumptions used.
- Give the operator-ready actions or draft output.
- End with risks and next steps.
