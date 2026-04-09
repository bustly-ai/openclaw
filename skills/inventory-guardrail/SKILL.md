---
name: "Inventory Guardrail"
description: >-
  Protect inventory health by detecting stockout risk early, sizing urgency, and
  recommending reorder or exposure-control actions. Use when stock falls faster
  than expected, hero SKUs approach stockout, or operators need a defendable
  restock trigger instead of gut feel.
status: enabled
trigger: inventory_change
cooldown: 300
layer: ecommerce
sub_layer: supply-chain
---
# Inventory Guardrail

Treat inventory risk as a decision system: detect, size, act, and verify.

## Skill Card

- **Category:** Inventory risk control
- **Core problem:** Teams notice low stock too late or react without a clear restock threshold.
- **Best for:** Hero SKU protection, promo-period stockout prevention, multi-SKU risk ranking, and reorder escalation.
- **Expected input:** Current on-hand inventory, average daily sales, lead time, inbound inventory, MOQ, and target cover days if available.
- **Expected output:** Risk tier, runway days, reorder trigger, recommended action, and alert-ready operator notes.

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

Ask for these first if missing:

1. SKU or SKU group
2. Current on-hand inventory
3. Average daily sales or weekly sales
4. Supplier lead time
5. Inbound inventory already ordered
6. MOQ or pack multiple
7. Whether the SKU is a hero item, promo item, or normal item

If the user only gives stock percentage, ask for absolute units and sales velocity before giving reorder advice.

## Core Formulas

Use these formulas unless the user provides a different replenishment rule:

- **Runway days** = current on-hand / average daily sales
- **Safety stock** = average daily sales x lead time x safety factor
- **Reorder point** = (average daily sales x lead time) + safety stock - inbound inventory
- **Recommended reorder quantity** = max(MOQ, target cover days x average daily sales - current on-hand - inbound inventory)

Default safety factor:

| Condition | Safety factor |
|---|---|
| Stable demand + reliable supplier | 1.0 |
| Moderate volatility | 1.3 |
| Promo / hero SKU / unstable supply | 1.5-2.0 |

## Risk Tiers

| Tier | Trigger | Meaning | Default action |
|---|---|---|---|
| **P0** | Runway <= lead time or stock <= 10% | Stockout risk is immediate | Reorder now, reduce exposure, notify owners |
| **P1** | Stock <= 20% or demand spike detected | Risk is rising | Prepare PO, confirm supplier ETA, review paid spend |
| **P2** | Cover < target but not critical | Monitor and stage actions | Watch daily, validate assumptions |

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

### Step 1 - Confirm scope
- Single SKU or multi-SKU watchlist?
- Is there a promotion, seasonal spike, or paid spend surge?
- Is the risk operational only or also commercial (hero SKU)?

### Step 2 - Calculate runway and trigger point
- Convert weekly demand to daily if needed.
- Calculate runway days, safety stock, reorder point, and reorder quantity.
- Mark low-confidence inputs when sales or lead time are based on rough estimates.

### Step 3 - Size the business impact
- Estimate days to stockout.
- Estimate lost demand if no action is taken.
- If the SKU is a hero or ad-supported item, flag revenue risk separately from inventory risk.

### Step 4 - Recommend action by tier
- **P0:** reorder now, throttle paid spend, set quantity caps, or swap hero SKU
- **P1:** confirm supplier capacity, stage PO, review forecast daily
- **P2:** keep monitoring and wait for more evidence

### Step 5 - Draft operator-ready alert output
Do not pretend to send notifications unless actual tooling is connected.
Instead, produce:
- alert severity
- owner
- deadline
- suggested WeCom / email text
- reorder note

### Step 6 - Multi-SKU mode
If the user provides multiple SKUs:
- rank top 10 by risk
- highlight hero SKUs separately
- show one watchlist table instead of isolated advice

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

Return in this order:

1. **Executive summary** - risk tier and immediate action
2. **Inventory risk table** - SKU, on-hand, runway, reorder point, risk tier
3. **Recommended actions** - P0 / P1 / P2
4. **Draft alert text** - operator-ready message for internal use
5. **Validation loop** - what to recheck tomorrow / in 3 days / after PO confirmation

## Missing Data Protocol

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (velocity, lead time, or current stock depth), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (velocity, lead time, or current stock depth), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- If average daily sales is missing, ask for the last 7-30 days sales.
- If lead time is unknown, give a range-based recommendation, not a single-point answer.
- If inbound inventory is unknown, clearly mark reorder advice as conservative.

## Validation Loop

- Recheck: stock cover / sell-through / fill rate / aging inventory share.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Recheck: stock cover / sell-through / fill rate / aging inventory share.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

Recheck:

- on-hand inventory daily for P0 / P1 SKUs
- supplier ETA within 24 hours for P0
- ad spend / traffic pressure if the SKU is promoted
- stock coverage after PO confirmation

## Example

**User:** SKU-2048 inventory is down to 8%. We have 40 units left, average sales are 15/day, supplier lead time is 5 days, and no inbound inventory. What should we do?

**Assistant:** Executive summary: **P0 inventory risk.** Runway is 2.7 days, which is below the 5-day lead time. Safety stock at 1.5x = 113 units. Reorder point = 188 units, so the SKU is already below the trigger. Recommended reorder quantity: if target cover is 21 days, order `21 x 15 - 40 = 275` units, rounded up to MOQ. Immediate actions: place PO today, reduce paid exposure on this SKU, and set quantity caps if it is a hero product. Draft alert: "SKU-2048 is below reorder point and will likely stock out in <3 days. Supplier confirmation required today. Reduce demand pressure until inbound ETA is secured." Validation loop: confirm supplier ETA within 24 hours and recheck on-hand tomorrow morning.

## When to Use

- The request is fundamentally about inventory, supplier, shipping-cost, or replenishment decisions, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Inventory Guardrail returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about inventory, supplier, shipping-cost, or replenishment decisions, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Inventory Guardrail returns a clear verdict, deliverable set, and next-step list.
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
