---
name: "Reorder Calculator"
description: >-
  Estimate ecommerce reorder timing and quantity using demand, lead time, and
  safety stock assumptions. Use when operators need a practical reorder point
  instead of guesswork.
status: enabled
layer: ecommerce
sub_layer: orders
---
# Reorder Calculator

Replenishment is not about "ordering when stock is almost gone," but about calculating risks and time windows in advance.

## Interact First, Then Calculate

Start by asking:
1. What you want to calculate right now:
   - reorder point
   - reorder quantity
   - stockout risk window
   - Pre-promotion stocking quantity
2. How do you currently set safety stock?
3. Is lead time a fixed value or a fluctuating range?
4. Do you need to factor in MOQ, cash constraints, seasonality, or promotional impacts?
5. Do you want to keep your existing logic, or should I recommend a replenishment framework?

## Python script guidance

When the user provides structured data:
- Generate a Python script to calculate reorder point / reorder quantity
- Display demand, lead time, and safety stock assumptions
- Output risk intervals
- Return a reusable script

## Problems Solved

Many inventory issues are not about inability to sell, but rather:
- Selling too fast, leading to stockouts;
- Ordering too much, tying up cash;
- Lead time fluctuations causing plans to go off track;
- No safety stock, with operations relying on gut feeling for replenishment.

The goal of this skill is:
**Based on sales volume, inventory, lead time, and safety stock, calculate a more reliable reorder point and recommended reorder quantity.**

## When to Use

- The request is fundamentally about checkout, shipment, SLA, or fulfillment recovery, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Inventory Reorder Calculator returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about checkout, shipment, SLA, or fulfillment recovery, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Inventory Reorder Calculator returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- SKU is experiencing rapid growth or ahead of a major promotion;
- Supply chain lead time is unstable;
- Need to find a balance between avoiding stockouts and avoiding overstock.

## Input Requirements

- Current inventory
- Average daily sales / average weekly sales
- Supplier lead time
- MOQ / Pack multiples
- Safety stock target
- Optional: Seasonality, promotions, replenishment cycle constraints

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

1. Clarify replenishment logic and risk objectives.
2. Estimate demand during the replenishment lead time.
3. Add safety stock buffer.
4. Calculate reorder point.
5. Provide recommended reorder quantity and risk alerts.
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

1. Assumptions table
2. Reorder point
3. Recommended reorder quantity
4. Risk range and recommendations
5. Python script

## Quality Standards

- Explicitly state lead time and demand assumptions.
- Distinguish between reorder point and reorder quantity.
- Should support day-to-day operational decisions, not just provide formulas.
- Include alerts for demand volatility risks.
- Do not feign precision before confirming the data scope.

## Resources

Refer to `references/output-template.md`.

## Example

**User:** We have a SKU with an average daily sales volume of 80 units, current inventory of 1200, supplier lead time of 10 days, and MOQ of 500. Help me calculate when we should reorder.

**Assistant:** Assumptions: Average daily sales 80, lead time 10 days, safety stock calculated at 3 days of demand (240 units). Reorder point = 80 x 10 + 240 = 1040 units. Current inventory 1200 > 1040, approximately 2 days until the reorder point is triggered. Recommended reorder quantity: 80 x 14 (replenishment cycle) + 240 - remaining inventory = approximately 500 units (just meets MOQ). A reusable Python script has been generated.

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

## Input Table Template

- SKU | current inventory | average daily sales | lead time | inbound units | MOQ | target cover days
- If demand is volatile, ask for a range or past 4-week average instead of one point estimate.
- Use the template before writing a script so the model assumptions stay explicit.

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
