---
name: "First 100 Orders"
description: >-
  Run the first-100-orders playbook to acquire early customers with controlled
  CAC and low refund risk. Trigger for new merchants with fewer than 100 orders
  or cold-start growth questions. Use when the team needs a diagnosis, ranking,
  or audit before changing execution.
status: enabled
trigger: Activate when merchant has <100 historical real orders.
cooldown: 0
layer: ecommerce
sub_layer: store-ops
---
# First 100 Orders

## Purpose

Operational playbook to get first 100 real orders with controlled CAC and low refund risk.

## Trigger Rules

Activate when merchant has <100 historical real orders.

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

Offer set, channel mix, budget cap, creative assets.

## Workflow Contract

Prioritize fast channels -> launch simple offers -> monitor CAC/refund -> iterate weekly.

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

First-100 plan, weekly action sheet, KPI trend.

## Eval Cases

- Positive: Trigger intent clearly matches this skill and required inputs are available.
- Negative: If intent is outside this skill's boundary, route to a better skill and log reason.
- Quality: Output must include evidence fields, risk status, and next action.

## Benchmark Targets

Reach 100 orders within target period and CAC guardrail.

## Improve Loop

- Record false-positive and false-negative triggers weekly.
- Update trigger wording and input requirements based on misses.
- Tighten workflow steps if verification repeatedly fails.

## Example

**User:** We just launched our Shopify store selling eco-friendly water bottles. We have 0 orders and a $2,000 ad budget. Help us get to 100 orders.

**Assistant:** First-100 plan: Week 1-2 -- launch 3 Meta ad sets targeting eco-conscious audiences with a 15% first-order discount, budget cap $80/day. Simultaneously seed product to 5 micro-creators for UGC content. Week 3-4 -- iterate on top-performing ad creative, add TikTok Shop listing. KPI guardrails: CPA under $18, refund rate under 5%. Weekly action sheet and trend tracker provided. Target: 100 orders in 28 days.

- Trigger condition:

## When to Use

- The request is fundamentally about checkout, shipment, SLA, or fulfillment recovery, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if First 100 Orders Engine returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about checkout, shipment, SLA, or fulfillment recovery, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if First 100 Orders Engine returns a clear verdict, deliverable set, and next-step list.
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

## Missing Data Protocol

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (SLA / backlog / cutoff context), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (SLA / backlog / cutoff context), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

## Validation Loop

- Recheck: checkout completion / backlog size / SLA breach rate.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Recheck: checkout completion / backlog size / SLA breach rate.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

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
