---
name: "GMV Growth Sprint"
description: >-
  Short-cycle growth plan to accelerate qualified top-line revenue. Use when the
  team needs a decision-ready plan, path choice, or go / no-go recommendation.
status: enabled
trigger: Activate when GMV acceleration is the top objective.
cooldown: 0
layer: ecommerce
sub_layer: store-ops
---
# GMV Growth Sprint

## Purpose

Short-cycle growth plan to accelerate qualified top-line revenue.

## Trigger Rules

Activate when GMV acceleration is the top objective.

## Required Inputs

- page / listing / store scope
- traffic or business context
- primary KPI or pain signal
- hard constraints
- timeline and owner constraints
- what success should look like after the first review window

- page / listing / store scope
- traffic or business context
- primary KPI or pain signal
- hard constraints
- timeline and owner constraints
- what success should look like after the first review window

Baseline GMV, budget capacity, offer inventory.

## Workflow Contract

Generate growth levers -> launch sprint -> evaluate quality-adjusted GMV.

## Deliverables

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- sequenced plan with timing
- what to do now / later / not yet
- success metrics and switch conditions
- page / listing / launch decision summary

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- sequenced plan with timing
- what to do now / later / not yet
- success metrics and switch conditions
- page / listing / launch decision summary

Sprint plan, executed lever log, GMV quality report.

## Eval Cases

- Positive: Trigger intent clearly matches this skill and required inputs are available.
- Negative: If intent is outside this skill's boundary, route to a better skill and log reason.
- Quality: Output must include evidence fields, risk status, and next action.

## Benchmark Targets

GMV uplift with stable margin floor.

## Improve Loop

- Record false-positive and false-negative triggers weekly.
- Update trigger wording and input requirements based on misses.
- Tighten workflow steps if verification repeatedly fails.

## Example

**User:** We need to grow GMV by 20% this quarter. Current baseline is $450K/month with a $30K ad budget. What levers can we pull?

**Assistant:** Here is a 4-week sprint plan targeting $540K/month GMV. Top levers: (1) raise AOV via bundle offers on top-10 SKUs, (2) increase paid traffic ROAS by shifting 40% of budget to best-performing ad sets, (3) launch a flash-sale cadence every 2 weeks. Expected quality-adjusted GMV uplift: 18-22% with margin held above 28%.

- Trigger condition:

## When to Use

- The request is fundamentally about listing, pricing, launch, or store-ops decisions, and the next step is unclear and the operator needs sequencing, thresholds, or a rollout plan.
- The team could take action immediately if GMV Growth Sprint returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about listing, pricing, launch, or store-ops decisions, and the next step is unclear and the operator needs sequencing, thresholds, or a rollout plan.
- The team could take action immediately if GMV Growth Sprint returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

## Do Not Use When

- Do not pretend a system mutation happened if the skill only has analysis or drafting context.
- Do not keep this skill active when the request clearly belongs to a narrower adjacent skill.
- Do not use this skill when the user already has a fixed plan and only needs one asset or one mutation executed.
- Do not recommend every path at once just to avoid choosing.

- Do not pretend a system mutation happened if the skill only has analysis or drafting context.
- Do not keep this skill active when the request clearly belongs to a narrower adjacent skill.
- Do not use this skill when the user already has a fixed plan and only needs one asset or one mutation executed.
- Do not recommend every path at once just to avoid choosing.

## Workflow

1. Confirm the objective, timing, and non-negotiable constraints before proposing paths.
2. Normalize the current state into a short evidence table and identify the main constraint that limits speed.
3. Choose the first path, the second path, and the explicit things to delay rather than spraying effort everywhere.
4. Turn the path choice into a short execution plan with owners, timing, and a stop / switch rule.
5. End with measurable success criteria and the earliest point to review / pivot the plan.
6. Separate traffic-quality issues from page / offer / catalog execution issues.

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

1. Conclusion / verdict
2. Key evidence or context table
3. Priority actions or draft output
4. Risks / caveats / missing data
5. Recommended next steps

- Show what to do now, what to delay, and what signal should trigger a plan change.

## Boundary and Routing

- Keep this skill focused on path choice and sequencing; route narrow asset creation or system mutation work downstream.
- If the user already has a fixed plan and only needs one asset, switch to the narrower generator / execution skill.

- Keep this skill focused on path choice and sequencing; route narrow asset creation or system mutation work downstream.
- If the user already has a fixed plan and only needs one asset, switch to the narrower generator / execution skill.

## Quality Rules

- Separate observed facts, user-provided facts, and assumptions.
- Do not invent exact numbers, specs, claims, certifications, or outcomes that were not provided or verified.
- Prefer the shortest useful answer shape that an operator can actually hand off.
- Choose a first path; avoid giving five equal-priority options just to stay safe.
- Tie each recommendation to a review window and an operator owner.

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

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (page scope, KPI baseline, or traffic context), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

## Validation Loop

- Recheck: primary conversion KPI / friction signal / launch blocker count.
- Review window: after the first sprint / launch checkpoint.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Recheck: primary conversion KPI / friction signal / launch blocker count.
- Review window: after the first sprint / launch checkpoint.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

## Execution Safeguards

- Verify auth state, account scope, and object IDs before drafting a final command / mutation plan.
- Show the intended request / command shape and the expected success signal so another operator can audit it.
- Name the most likely failure modes, including permissions, rate limits, invalid paths, invalid payloads, or policy review blocks.
- If rollback is possible, state it. If rollback is not possible, state the irreversible step before it happens.

- Verify auth state, account scope, and object IDs before drafting a final command / mutation plan.
- Show the intended request / command shape and the expected success signal so another operator can audit it.
- Name the most likely failure modes, including permissions, rate limits, invalid paths, invalid payloads, or policy review blocks.
- If rollback is possible, state it. If rollback is not possible, state the irreversible step before it happens.

- Verify auth state, account scope, and object IDs before drafting a final command / mutation plan.
- Show the intended request / command shape and the expected success signal so another operator can audit it.
- Name the most likely failure modes, including permissions, rate limits, invalid paths, invalid payloads, or policy review blocks.
- If rollback is possible, state it. If rollback is not possible, state the irreversible step before it happens.

- Verify auth state, account scope, and object IDs before drafting a final command / mutation plan.
- Show the intended request / command shape and the expected success signal so another operator can audit it.
- Name the most likely failure modes, including permissions, rate limits, invalid paths, invalid payloads, or policy review blocks.
- If rollback is possible, state it. If rollback is not possible, state the irreversible step before it happens.

## Success Metrics

- the operator knows the top 3-5 fixes
- the output distinguishes now / later / not yet
- one measurable KPI or gate is named for the next review

- the operator knows the top 3-5 fixes
- the output distinguishes now / later / not yet
- one measurable KPI or gate is named for the next review

- the operator knows the top 3-5 fixes
- the output distinguishes now / later / not yet
- one measurable KPI or gate is named for the next review

- the operator knows the top 3-5 fixes
- the output distinguishes now / later / not yet
- one measurable KPI or gate is named for the next review

## Template Use

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.
