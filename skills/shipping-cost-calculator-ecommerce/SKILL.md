---
name: "Shipping Cost Calculator"
description: >-
  Estimate ecommerce shipping cost per order across weight, zones, carrier
  rules, and free-shipping policies. Use when teams need to understand how
  shipping affects margin and offer design.
status: enabled
layer: ecommerce
sub_layer: orders
---
# Shipping Cost Calculator

Shipping cost is not a fixed value but a whole set of variables that eat into your margins.

## Interact First, Then Calculate

Start by asking:
1. What dimension do you want to calculate shipping by?
   - Per order
   - By region/zone
   - By weight tier
   - Free shipping threshold strategy
2. What components are typically included in your shipping costs?
   - carrier fee
   - Packaging materials
   - Warehouse handling/fulfillment fees
   - Costs related to re-shipments / lost packages / returns
3. Do you also want to simulate free shipping threshold or bundle scenarios?
4. Do you want to keep your existing logic, or should I recommend a framework?

## Python script guidance

When structured input is provided:
- Generate a Python script to calculate shipping costs
- Output per-order / per-zone / policy impact results
- Display key thresholds
- Return a reusable script

## Problems It Solves

Many teams, when setting "free shipping," "free shipping above a threshold," or choosing a logistics provider, only look at the surface-level quotes without fully accounting for:
- Differences across regions / weight tiers;
- Packaging materials and fulfillment fees;
- The impact of free-shipping thresholds on per-order profit;
- Additional costs from returns or re-shipments.

The goal of this skill is to:
**Turn shipping costs from a vague impression into actionable decision inputs for pricing and free-shipping strategies.**

## When to Use

- The request is fundamentally about checkout, shipment, SLA, or fulfillment recovery, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Shipping Cost Calculator Ecommerce returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about checkout, shipment, SLA, or fulfillment recovery, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Shipping Cost Calculator Ecommerce returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- Adjusting free shipping thresholds;
- Switching logistics providers or fulfillment solutions;
- Want to know if certain regions are consistently losing money;
- Before implementing bundle / AOV-boosting strategies.

## Input Requirements

- Shipping zone or country / state
- Package weight, dimensions, and dimensional weight rules
- Carrier quotes / warehouse fulfillment fees
- Packaging materials and handling fees
- Free shipping policy / promotional rules
- Optional: assumptions for returns, re-shipments, and lost package losses

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

1. Define the shipping cost calculation scope.
2. Calculate per-order base shipping cost.
3. Differentiate by zone, weight tier, and policy variations.
4. Assess the profit impact of free shipping / free-shipping-above-threshold policies.
5. Provide threshold and strategy recommendations.
6. Return a reusable Python script.

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

1. Shipping Cost Assumptions Table
2. Per-Order / Per-Zone Cost Results
3. Free Shipping Policy Impact
4. Recommended Actions
5. Python Script

## Quality Standards

- Distinguish between carrier quotes and true total fulfillment costs.
- Clearly identify which zones or weight tiers carry higher risk.
- Output should directly support pricing or threshold decisions.
- Do not use false precision to mask estimates.
- Do not pretend to be precise before the calculation scope is confirmed.

## Resources

Refer to `references/output-template.md`.

## Example

**User:** Our current free-shipping threshold is $49. We'd like to know the profit impact of changing it to $59. The average order weight is 1.2 lbs, and USPS shipping costs are roughly $5-8.

**Assistant:** First, let's clarify the scope: does your shipping cost refer to the pure carrier fee, or does it include packaging materials and warehouse handling fees? Based on the numbers you provided, here's a preliminary calculation: Under the current $49 free-shipping threshold, approximately 60% of orders trigger free shipping, with an average shipping subsidy of $6.50/order. If raised to $59: the estimated free-shipping order ratio drops to 40%, reducing the shipping subsidy by approximately $1,950/month, but this may result in a 5-10% loss in conversion rate. I recommend running an A/B test first and comparing the AOV and conversion changes between the two thresholds after one week. A Python script has been generated — you can adjust the assumptions and re-run the simulation.

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

## Additional Inputs For Threshold Changes

- Ask for current conversion rate, average order value, and order distribution around the free-shipping threshold.
- Distinguish pure carrier fee from packaging, handling, and return-related cost.
- When evaluating a threshold increase, consider a mixed strategy such as tiered shipping or bundle nudges.

## Do Not Use When

- Do not pretend a system mutation happened if the skill only has analysis or drafting context.
- Do not keep this skill active when the request clearly belongs to a narrower adjacent skill.
- Do not use this skill for writing final production assets when the core need is execution or content generation.
- Do not over-claim trend certainty from one snapshot or one anecdote.

- Do not pretend a system mutation happened if the skill only has analysis or drafting context.
- Do not keep this skill active when the request clearly belongs to a narrower adjacent skill.
- Do not use this skill for writing final production assets when the core need is execution or content generation.
- Do not over-claim trend certainty from one snapshot or one anecdote.

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

## Template Use

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.
