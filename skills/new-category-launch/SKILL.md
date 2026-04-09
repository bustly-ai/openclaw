---
name: "New Category Launch"
description: >-
  Structured process to open and stabilize a new category line. Use when the
  team needs a decision-ready plan, path choice, or go / no-go recommendation.
status: enabled
trigger: Activate on category expansion decisions.
cooldown: 0
layer: ecommerce
sub_layer: store-ops
---
# New Category Launch

## Overview

Structured process to open and stabilize a new category line. Use when the team needs a decision-ready plan, path choice, or go / no-go recommendation.

## When to Use

- The request is fundamentally about listing, pricing, launch, or store-ops decisions, and the next step is unclear and the operator needs sequencing, thresholds, or a rollout plan.
- The team could take action immediately if New Category Launch returns a clear verdict, deliverable set, and next-step list.
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

## Template Use

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.

## Success Metrics

- the operator knows the top 3-5 fixes
- the output distinguishes now / later / not yet
- one measurable KPI or gate is named for the next review

## Pilot Gate

- Define a pilot scope, 3-5 go / no-go metrics, and a hard review point before expanding.
- Separate readiness blockers from nice-to-have improvements so the launch decision is auditable.

## Example

**Scenario:** 某宠物用品Shopify店主，月GMV $80,000，考虑从宠物玩具扩展到宠物食品类目。现有两家玩具供应商，考虑引入冻干零食品类，预计新品类启动SKU数15个，初始库存预算$15,000。

**Expected response shape:**
- Start with the conclusion or verdict.
- Show the evidence or assumptions used.
- Give the operator-ready actions or draft output.
- End with risks and next steps.
