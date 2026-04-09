---
name: "Inventory Turnover"
description: >-
  Balance stock depth, promotion, and replenishment to improve cash velocity.
  Use when the team needs a diagnosis, ranking, or audit before changing
  execution.
status: enabled
trigger: Activate for growth merchants with stock pressure.
cooldown: 0
layer: ecommerce
sub_layer: supply-chain
---
# Inventory Turnover

## Purpose

Balance stock depth, promotion, and replenishment to improve cash velocity.

## Trigger Rules

Activate for growth merchants with stock pressure.

## Required Inputs

- inventory / supplier snapshot
- demand or velocity signal
- lead time / MOQ / shipping constraint
- margin or stockout risk
- baseline or benchmark expectation
- the evidence source to trust first

- inventory / supplier snapshot
- demand or velocity signal
- lead time / MOQ / shipping constraint
- margin or stockout risk
- baseline or benchmark expectation
- the evidence source to trust first

Inventory aging, demand velocity, reorder lead times.

## Workflow Contract

Classify SKU velocity -> push/suppress actions -> sync replenishment priorities.

## Deliverables

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- gap diagnosis or scorecard
- P0 / P1 / P2 action list
- confidence and evidence labels
- inventory / supplier decision table

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- gap diagnosis or scorecard
- P0 / P1 / P2 action list
- confidence and evidence labels
- inventory / supplier decision table

Turnover plan, SKU action list, risk alerts.

## Eval Cases

- Positive: Trigger intent clearly matches this skill and required inputs are available.
- Negative: If intent is outside this skill's boundary, route to a better skill and log reason.
- Quality: Output must include evidence fields, risk status, and next action.

## Benchmark Targets

Slow-moving inventory ratio reduced >=15%.

## Improve Loop

- Record false-positive and false-negative triggers weekly.
- Update trigger wording and input requirements based on misses.
- Tighten workflow steps if verification repeatedly fails.

## Example

**User:** We have 200 SKUs and 35% of inventory value is in slow-moving items older than 90 days. How do we free up cash?

**Assistant:** SKU velocity classification complete: 40 SKUs flagged as slow-moving (>90 days aging). Action plan: (1) Run clearance promos on top 15 slow-movers with highest carrying cost, (2) suppress reorder for 10 SKUs with <2 units/week sell-through, (3) prioritize replenishment for 25 fast-movers at risk of stockout. Expected impact: slow-moving inventory ratio reduced from 35% to ~20% within 6 weeks.

- Trigger condition: 

## Missing Data Protocol

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (velocity, lead time, or current stock depth), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (velocity, lead time, or current stock depth), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the minimum missing inputs needed to avoid misleading advice.
- If the user cannot provide them, switch to checklist or hypothesis mode and label assumptions clearly.
- Do not convert rough estimates, benchmarks, or ranges into measured facts.
- End low-confidence outputs with the single most valuable next data request.

## Validation Loop

- Recheck: stock cover / sell-through / fill rate / aging inventory share.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Recheck: stock cover / sell-through / fill rate / aging inventory share.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Name the 1-3 core metrics or checkpoints to recheck after action.
- Give a review window that matches the cadence of the work.
- Define what improvement, no-change, and failure look like so the operator can close the loop.
- If the user has no analytics access, provide a manual validation checkpoint instead.

## Disposition Matrix

- Use promo when inventory still has healthy gross margin and demand can be stimulated.
- Use bundle or private-channel clearance when brand protection matters.
- Use liquidation or write-off only when carrying cost exceeds likely recovery value.
- Ask for a CSV or simple table when the user has more than 20 SKUs in scope.

## When to Use

- The request is fundamentally about inventory, supplier, shipping-cost, or replenishment decisions, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Inventory Turnover Balancer returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about inventory, supplier, shipping-cost, or replenishment decisions, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Inventory Turnover Balancer returns a clear verdict, deliverable set, and next-step list.
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
6. Separate stockout prevention from inventory cleanup so the recommendation does not solve one problem by creating another.

1. Define the decision question, review window, and the one KPI or business signal that matters most.
2. Normalize the evidence into a compact table so facts, assumptions, and missing fields are separated.
3. Rank the gaps or options by business impact, reversibility, and confidence.
4. Convert the diagnosis into P0 / P1 / P2 actions tied to evidence, not generic best practices.
5. End with a validation loop so the operator knows exactly how to recheck if the fix worked.
6. Separate stockout prevention from inventory cleanup so the recommendation does not solve one problem by creating another.

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

- cash is freed without creating hero-SKU stockouts
- reorder timing becomes explicit
- aging or margin risk is ranked instead of guessed

- cash is freed without creating hero-SKU stockouts
- reorder timing becomes explicit
- aging or margin risk is ranked instead of guessed

- cash is freed without creating hero-SKU stockouts
- reorder timing becomes explicit
- aging or margin risk is ranked instead of guessed

- cash is freed without creating hero-SKU stockouts
- reorder timing becomes explicit
- aging or margin risk is ranked instead of guessed
