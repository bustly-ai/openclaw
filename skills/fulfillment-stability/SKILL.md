---
name: "Fulfillment Stability"
description: >-
  Stabilize fulfillment throughput and reduce SLA breaches. Use when the team
  needs a decision-ready plan, path choice, or go / no-go recommendation.
status: enabled
trigger: Activate when backlog or late shipment risk rises.
cooldown: 0
layer: ecommerce
sub_layer: orders
---
# Fulfillment Stability

## Purpose

Stabilize fulfillment throughput and reduce SLA breaches.

## Trigger Rules

Activate when backlog or late shipment risk rises.

## Required Inputs

- order / queue snapshot
- SLA or timing requirement
- bottleneck notes
- customer or operational impact
- timeline and owner constraints
- what success should look like after the first review window

- order / queue snapshot
- SLA or timing requirement
- bottleneck notes
- customer or operational impact
- timeline and owner constraints
- what success should look like after the first review window

Order backlog, carrier performance, warehouse capacity.

## Workflow Contract

Reprioritize queue -> trigger exception playbooks -> monitor hourly recovery.

## Deliverables

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- sequenced plan with timing
- what to do now / later / not yet
- success metrics and switch conditions
- recovery or queue triage recommendation

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- sequenced plan with timing
- what to do now / later / not yet
- success metrics and switch conditions
- recovery or queue triage recommendation

Fulfillment recovery board, SLA status updates.

## Eval Cases

- Positive: Trigger intent clearly matches this skill and required inputs are available.
- Negative: If intent is outside this skill's boundary, route to a better skill and log reason.
- Quality: Output must include evidence fields, risk status, and next action.

## Benchmark Targets

Late order backlog cleared within SLA target.

## Improve Loop

- Record false-positive and false-negative triggers weekly.
- Update trigger wording and input requirements based on misses.
- Tighten workflow steps if verification repeatedly fails.

## Example

**User:** We have a 200-order backlog and our carrier is reporting 48-hour delays. What should we do?

**Assistant:** Reprioritizing the queue: splitting orders into 3 tiers by SLA urgency. Tier 1 (52 orders past SLA) -- route to backup carrier immediately and send proactive delay notification to customers. Tier 2 (89 orders due today) -- hold with primary carrier but escalate to carrier account manager. Tier 3 (59 orders with 2+ days buffer) -- no action needed yet. Recovery target: clear Tier 1 within 12 hours. Monitoring hourly with SLA status updates.

- Trigger condition: 

## Missing Data Protocol

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (SLA / backlog / cutoff context), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (SLA / backlog / cutoff context), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the minimum missing inputs needed to avoid misleading advice.
- If the user cannot provide them, switch to checklist or hypothesis mode and label assumptions clearly.
- Do not convert rough estimates, benchmarks, or ranges into measured facts.
- End low-confidence outputs with the single most valuable next data request.

## Validation Loop

- Recheck: checkout completion / backlog size / SLA breach rate.
- Review window: after the first sprint / launch checkpoint.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Recheck: checkout completion / backlog size / SLA breach rate.
- Review window: after the first sprint / launch checkpoint.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Name the 1-3 core metrics or checkpoints to recheck after action.
- Give a review window that matches the cadence of the work.
- Define what improvement, no-change, and failure look like so the operator can close the loop.
- If the user has no analytics access, provide a manual validation checkpoint instead.

## Structural Capacity Escalation

- Distinguish temporary spikes from structural under-capacity.
- If average demand stays above internal capacity for more than one review window, recommend medium-term capacity change, not only daily firefighting.
- Add one prevention action and one contingency action to every plan.

## When to Use

- The request is fundamentally about checkout, shipment, SLA, or fulfillment recovery, and the next step is unclear and the operator needs sequencing, thresholds, or a rollout plan.
- The team could take action immediately if Fulfillment Stability returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about checkout, shipment, SLA, or fulfillment recovery, and the next step is unclear and the operator needs sequencing, thresholds, or a rollout plan.
- The team could take action immediately if Fulfillment Stability returns a clear verdict, deliverable set, and next-step list.
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
6. Separate immediate recovery actions from structural process fixes.

1. Confirm the objective, timing, and non-negotiable constraints before proposing paths.
2. Normalize the current state into a short evidence table and identify the main constraint that limits speed.
3. Choose the first path, the second path, and the explicit things to delay rather than spraying effort everywhere.
4. Turn the path choice into a short execution plan with owners, timing, and a stop / switch rule.
5. End with measurable success criteria and the earliest point to review / pivot the plan.
6. Separate immediate recovery actions from structural process fixes.

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

## Success Metrics

- SLA risk or queue pressure falls
- checkout or shipment friction is reduced
- same issue can be rechecked on a fixed cadence

- SLA risk or queue pressure falls
- checkout or shipment friction is reduced
- same issue can be rechecked on a fixed cadence

- SLA risk or queue pressure falls
- checkout or shipment friction is reduced
- same issue can be rechecked on a fixed cadence

- SLA risk or queue pressure falls
- checkout or shipment friction is reduced
- same issue can be rechecked on a fixed cadence

## Template Use

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.
