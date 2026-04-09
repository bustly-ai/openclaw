---
name: "Subscription LTV"
description: >-
  Increase subscription retention, reduce involuntary churn, and lift LTV. Use
  when the team needs a diagnosis, ranking, or audit before changing execution.
status: enabled
trigger: Activate for subscription business models.
cooldown: 0
layer: ecommerce
sub_layer: customers
---
# Subscription LTV

## Purpose

Increase subscription retention, reduce involuntary churn, and lift LTV.

## Trigger Rules

Activate for subscription business models.

## Required Inputs

- feedback source
- time window + sample size
- product / SKU scope
- desired decision
- baseline or benchmark expectation
- the evidence source to trust first

- feedback source
- time window + sample size
- product / SKU scope
- desired decision
- baseline or benchmark expectation
- the evidence source to trust first

Cohort retention, payment fail logs, offer cadence.

## Workflow Contract

Optimize renewals and dunning -> test retention offers -> evaluate LTV impact.

## Deliverables

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- gap diagnosis or scorecard
- P0 / P1 / P2 action list
- confidence and evidence labels
- customer-facing or ops-facing response guidance

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- gap diagnosis or scorecard
- P0 / P1 / P2 action list
- confidence and evidence labels
- customer-facing or ops-facing response guidance

Subscription optimization report, retention actions.

## Eval Cases

- Positive: Trigger intent clearly matches this skill and required inputs are available.
- Negative: If intent is outside this skill's boundary, route to a better skill and log reason.
- Quality: Output must include evidence fields, risk status, and next action.

## Benchmark Targets

Involuntary churn declines and LTV rises.

## Improve Loop

- Record false-positive and false-negative triggers weekly.
- Update trigger wording and input requirements based on misses.
- Tighten workflow steps if verification repeatedly fails.

## Example

**User:** Our monthly subscription box has 18% churn after month 3. How do we fix it?

**Assistant:** Based on the month-3 drop pattern, this looks like involuntary churn (payment failures) combined with value fatigue. I recommend: (1) implement a dunning sequence with 3 retry attempts over 7 days, (2) send a personalized "what's coming next month" preview email on day 25, and (3) test a loyalty discount at the month-2 renewal. These actions target the two biggest churn drivers and should reduce month-3 churn by 4-6 points.

- Trigger condition:

## When to Use

- The request is fundamentally about reviews, refunds, retention, subscriptions, or public reply workflows, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Subscription LTV Optimizer returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about reviews, refunds, retention, subscriptions, or public reply workflows, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Subscription LTV Optimizer returns a clear verdict, deliverable set, and next-step list.
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
6. Separate product issue, expectation issue, policy issue, and service issue before recommending a response.

1. Define the decision question, review window, and the one KPI or business signal that matters most.
2. Normalize the evidence into a compact table so facts, assumptions, and missing fields are separated.
3. Rank the gaps or options by business impact, reversibility, and confidence.
4. Convert the diagnosis into P0 / P1 / P2 actions tied to evidence, not generic best practices.
5. End with a validation loop so the operator knows exactly how to recheck if the fix worked.
6. Separate product issue, expectation issue, policy issue, and service issue before recommending a response.

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
- Preserve useful positive signals, not only complaints or failure themes.

- Separate observed facts, user-provided facts, and assumptions.
- Do not invent exact numbers, specs, claims, certifications, or outcomes that were not provided or verified.
- Prefer the shortest useful answer shape that an operator can actually hand off.
- Do not over-generalize from one screenshot, one SKU, one creator, or one time window.
- Keep the top 3-5 actions only; backlog items belong in a secondary list.
- Preserve useful positive signals, not only complaints or failure themes.

## Missing Data Protocol

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (sample size, timeframe, or source of feedback), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (sample size, timeframe, or source of feedback), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

## Validation Loop

- Recheck: reply quality / complaint share / refund rate / rating trend.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Recheck: reply quality / complaint share / refund rate / rating trend.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

## Template Use

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.

## Retention Economics

- Separate involuntary churn, voluntary churn, and offer / education gaps before recommending incentives.
- Show where discounting helps and where it only pulls forward low-quality retention.

- Separate involuntary churn, voluntary churn, and offer / education gaps before recommending incentives.
- Show where discounting helps and where it only pulls forward low-quality retention.
