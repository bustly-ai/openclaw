---
name: "Portfolio Profit"
description: >-
  Optimize category and SKU mix for net contribution at scale. Use when the team
  needs a diagnosis, ranking, or audit before changing execution.
status: enabled
trigger: Activate in mature-stage periodic planning.
cooldown: 0
layer: ecommerce
sub_layer: store-ops
---
# Portfolio Profit

## Purpose

Optimize category and SKU mix for net contribution at scale.

## Trigger Rules

Activate in mature-stage periodic planning.

## Required Inputs

- page / listing / store scope
- traffic or business context
- primary KPI or pain signal
- hard constraints
- baseline or benchmark expectation
- the evidence source to trust first

- page / listing / store scope
- traffic or business context
- primary KPI or pain signal
- hard constraints
- baseline or benchmark expectation
- the evidence source to trust first

Category P&L, SKU margin, overhead allocation.

## Workflow Contract

Rank contribution -> adjust assortment and budget -> verify profit quality.

## Deliverables

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- gap diagnosis or scorecard
- P0 / P1 / P2 action list
- confidence and evidence labels
- page / listing / launch decision summary

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- gap diagnosis or scorecard
- P0 / P1 / P2 action list
- confidence and evidence labels
- page / listing / launch decision summary

Portfolio recommendations, executed changes, profit impact report.

## Eval Cases

- Positive: Trigger intent clearly matches this skill and required inputs are available.
- Negative: If intent is outside this skill's boundary, route to a better skill and log reason.
- Quality: Output must include evidence fields, risk status, and next action.

## Benchmark Targets

Net contribution rate improvement quarter-over-quarter.

## Improve Loop

- Record false-positive and false-negative triggers weekly.
- Update trigger wording and input requirements based on misses.
- Tighten workflow steps if verification repeatedly fails.

## Example

**User:** We have 120 SKUs across 4 categories. Help me figure out which ones to keep, cut, or double down on for next quarter.

**Assistant:** I will rank all 120 SKUs by net contribution margin, factoring in product cost, platform fees, fulfillment, and return drag. Expect a tiered recommendation: top performers to invest in, mid-tier to hold, and bottom SKUs to sunset or renegotiate. I will also flag categories where overhead allocation is eating into apparent profitability.

- Trigger condition:

## When to Use

- The request is fundamentally about listing, pricing, launch, or store-ops decisions, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Portfolio Profit Optimizer returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about listing, pricing, launch, or store-ops decisions, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Portfolio Profit Optimizer returns a clear verdict, deliverable set, and next-step list.
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
6. Separate traffic-quality issues from page / offer / catalog execution issues.

1. Define the decision question, review window, and the one KPI or business signal that matters most.
2. Normalize the evidence into a compact table so facts, assumptions, and missing fields are separated.
3. Rank the gaps or options by business impact, reversibility, and confidence.
4. Convert the diagnosis into P0 / P1 / P2 actions tied to evidence, not generic best practices.
5. End with a validation loop so the operator knows exactly how to recheck if the fix worked.
6. Separate traffic-quality issues from page / offer / catalog execution issues.

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
- If the core blocker is missing (page scope, KPI baseline, or traffic context), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (page scope, KPI baseline, or traffic context), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

## Validation Loop

- Recheck: primary conversion KPI / friction signal / launch blocker count.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Recheck: primary conversion KPI / friction signal / launch blocker count.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

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

## Portfolio Logic

- Separate hero-SKU protection, tail cleanup, and brand-building bets instead of treating the assortment as one pool.
- Tie portfolio recommendations to contribution margin, repeat signal, and operational complexity.

- Separate hero-SKU protection, tail cleanup, and brand-building bets instead of treating the assortment as one pool.
- Tie portfolio recommendations to contribution margin, repeat signal, and operational complexity.
