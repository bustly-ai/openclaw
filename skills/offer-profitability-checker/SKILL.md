---
name: "Offer Profitability"
description: "Check whether an ecommerce offer is commercially viable after discounts, costs, refunds, and traffic economics are included. Use when teams need a fast profitability reality check before launch or scale."
status: enabled
layer: core
sub_layer: finance-tax
---
# Offer Profitability

A quick commercial reality check for offers that look good on the surface but may not hold up economically.

## Interact First, Then Analyze

Start by clarifying:
1. What offer do you want to evaluate this time?
   - Direct price cut
   - bundle
   - upsell
   - Spend-threshold discount
   - Free shipping
2. How do you usually determine whether an offer is "worth running"?
   - By net profit?
   - By contribution margin?
   - By CAC tolerance?
3. Do you want to use your existing methodology, or would you like me to provide a recommended e-commerce profitability framework?
4. What matters most this time: profit, volume upside, conversion assumptions, or risk boundaries?

If the user has no defined methodology, provide a recommended analysis framework first, then ask the user to confirm.

## Python script guidance

Once the user provides structured numbers:
- Generate a Python script for modeling
- First present assumptions and formulas
- Then output baseline / scenario / sensitivity
- Finally return a reusable script

If critical data is missing, do not pretend to be precise; continue asking follow-up questions or provide recommended default values and wait for confirmation.

## Solves

Many ecommerce teams make pricing or offer decisions with incomplete economics:
- they see revenue upside but not margin drag;
- they model one variable but ignore knock-on effects;
- they test offers without clear guardrails;
- they scale offers before checking break-even logic.

Goal:
**Turn offer assumptions into a clearer economic view that is easier to evaluate and act on.**

## Use when

- You want to compare offer scenarios before launching
- A discount, bundle, or upsell idea sounds good but needs economic validation
- Growth teams need a faster way to pressure-test merchandising decisions
- Teams want clearer go / watch / no-go logic before scale

## Inputs

- Core commercial assumptions relevant to the scenario
- Price and cost structure
- Margin or refund assumptions
- Traffic / conversion or attach-rate assumptions
- Constraints or guardrails

## Workflow

1. Clarify the baseline commercial setup and evaluation logic.
2. Model the scenario inputs that change order economics.
3. Surface upside, downside, and sensitivity.
4. Identify the biggest weak points or break-even pressure.
5. Recommend whether to test, revise, or avoid the scenario.
6. Return reusable Python script when structured inputs exist.

## Output

1. Baseline view
2. Scenario result
3. Margin / break-even implications
4. Key risks and weak points
5. Recommendation
6. Python script

## Quality bar

- Output should be commercially interpretable, not just a raw formula dump.
- Recommendations should stay grounded in ecommerce economics.
- Weak points should be clearly separated from upside assumptions.
- The result should help a team decide what to test next.
- Do not pretend precision before assumptions are confirmed.

## Resource

See `references/output-template.md`。

## Example

**User:** We want to run a "buy 2 get 1 free" promotion on our $30 candles (COGS $9). Is it profitable?

**Assistant:** Modeling the offer: effective price per unit drops to $20 (3 for $60), COGS stays at $9/unit. Baseline contribution margin: $30 - $9 = $21 (70%). Offer margin: $20 - $9 = $11 (55%). Break-even requires 1.9x the baseline volume to match total contribution. Risk: if conversion lift is below 90%, you lose money vs. no promo. Recommendation: **test with a cap** -- limit to 500 redemptions, monitor actual attach rate, then decide whether to scale. Python script generated for scenario modeling.
