---
name: "Fulfillment SLA"
description: >-
  Detect and mitigate fulfillment SLA risks across order queues, shipping
  delays, and exceptions. Trigger on heartbeat checks, before peak sale windows,
  or when late-shipment rates climb. Use when the team needs a diagnosis,
  ranking, or audit before changing execution.
status: enabled
trigger: Activate every heartbeat and before peak windows.
cooldown: 0
layer: ecommerce
sub_layer: orders
---
# Fulfillment SLA

## Purpose

Detect and mitigate SLA risks across order queue, shipping delays, and exception handling.

## Trigger Rules

Activate every heartbeat and before peak windows.

## Required Inputs

- order / queue snapshot
- SLA or timing requirement
- bottleneck notes
- customer or operational impact
- baseline or benchmark expectation
- the evidence source to trust first

- order / queue snapshot
- SLA or timing requirement
- bottleneck notes
- customer or operational impact
- baseline or benchmark expectation
- the evidence source to trust first

Order queue, SLA policy, shipment events.

## Workflow Contract

Identify at-risk orders -> trigger mitigation workflows -> verify status changes.

## Deliverables

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- gap diagnosis or scorecard
- P0 / P1 / P2 action list
- confidence and evidence labels
- recovery or queue triage recommendation

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- gap diagnosis or scorecard
- P0 / P1 / P2 action list
- confidence and evidence labels
- recovery or queue triage recommendation

At-risk order list, mitigation actions, updated SLA exposure.

## Eval Cases

- Positive: Trigger intent clearly matches this skill and required inputs are available.
- Negative: If intent is outside this skill's boundary, route to a better skill and log reason.
- Quality: Output must include evidence fields, risk status, and next action.

## Benchmark Targets

Late-shipment rate down >=20% vs baseline.

## Improve Loop

- Record false-positive and false-negative triggers weekly.
- Update trigger wording and input requirements based on misses.
- Tighten workflow steps if verification repeatedly fails.

## Example

**User:** We have a flash sale tomorrow. Check our current order queue for any SLA risks before the traffic spike.

**Assistant:** Scanning the order queue against your 48-hour SLA policy. Found 23 orders at risk of late shipment -- 15 are stuck in picking, 8 are awaiting carrier pickup. Recommending priority fulfillment for these 23 orders and temporarily routing new orders to your backup warehouse to prevent SLA breaches during the sale.

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
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Recheck: checkout completion / backlog size / SLA breach rate.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Name the 1-3 core metrics or checkpoints to recheck after action.
- Give a review window that matches the cadence of the work.
- Define what improvement, no-change, and failure look like so the operator can close the loop.
- If the user has no analytics access, provide a manual validation checkpoint instead.

## Backlog Response Playbook

- Separate pre-event prevention from post-peak backlog recovery.
- When backlog already exists, sort by SLA deadline, order value, and customer risk.
- If internal capacity is insufficient, explicitly evaluate overflow options such as 3PL or backup warehouse support.

## When to Use

- The request is fundamentally about checkout, shipment, SLA, or fulfillment recovery, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Order Fulfillment SLA Guardian returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about checkout, shipment, SLA, or fulfillment recovery, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Order Fulfillment SLA Guardian returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

## Do Not Use When

- Do not pretend a system mutation happened if the skill only has analysis or drafting context.
- Do not keep this skill active when the request clearly belongs to a narrower adjacent skill.
- Do not use this skill for writing final production assets when the core need is execution or content generation.
- Do not over-claim trend certainty from one snapshot or one anecdote.

- Do not pretend a system mutation happened if the skill only has analysis or drafting context.
- Do not keep this skill active when the request clearly belongs to a narrower adjacent skill.
- Do not use this skill for writing final production assets when the core need is execution or content generation.
- Do not over-claim trend certainty from one snapshot or one anecdote.

## Workflow

1. Define the decision question, review window, and the one KPI or business signal that matters most.
2. Normalize the evidence into a compact table so facts, assumptions, and missing fields are separated.
3. Rank the gaps or options by business impact, reversibility, and confidence.
4. Convert the diagnosis into P0 / P1 / P2 actions tied to evidence, not generic best practices.
5. End with a validation loop so the operator knows exactly how to recheck if the fix worked.
6. Separate immediate recovery actions from structural process fixes.

1. Define the decision question, review window, and the one KPI or business signal that matters most.
2. Normalize the evidence into a compact table so facts, assumptions, and missing fields are separated.
3. Rank the gaps or options by business impact, reversibility, and confidence.
4. Convert the diagnosis into P0 / P1 / P2 actions tied to evidence, not generic best practices.
5. End with a validation loop so the operator knows exactly how to recheck if the fix worked.
6. Separate immediate recovery actions from structural process fixes.

## Output Format

1. Conclusion / verdict
2. Key evidence or context table
3. Priority actions or draft output
4. Risks / caveats / missing data
5. Recommended next steps

- Label each major claim with confidence: high / medium / low.

1. Conclusion / verdict
2. Key evidence or context table
3. Priority actions or draft output
4. Risks / caveats / missing data
5. Recommended next steps

- Label each major claim with confidence: high / medium / low.

## Boundary and Routing

- Keep this skill focused on diagnosis and prioritization; route production copy, design, or API mutation work downstream.
- If the next step becomes commercial negotiation or execution, state the handoff point explicitly.

- Keep this skill focused on diagnosis and prioritization; route production copy, design, or API mutation work downstream.
- If the next step becomes commercial negotiation or execution, state the handoff point explicitly.

## Quality Rules

- Separate observed facts, user-provided facts, and assumptions.
- Do not invent exact numbers, specs, claims, certifications, or outcomes that were not provided or verified.
- Prefer the shortest useful answer shape that an operator can actually hand off.
- Do not over-generalize from one screenshot, one SKU, one creator, or one time window.
- Keep the top 3-5 actions only; backlog items belong in a secondary list.

- Separate observed facts, user-provided facts, and assumptions.
- Do not invent exact numbers, specs, claims, certifications, or outcomes that were not provided or verified.
- Prefer the shortest useful answer shape that an operator can actually hand off.
- Do not over-generalize from one screenshot, one SKU, one creator, or one time window.
- Keep the top 3-5 actions only; backlog items belong in a secondary list.

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
