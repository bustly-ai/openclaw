---
name: "Discount Impact Calculator"
description: "Calculate how discounts affect revenue, margin, conversion assumptions, and allowable acquisition cost so teams can see whether a promotion is actually worth running."
status: enabled
layer: core
sub_layer: finance-tax
---
# Discount Impact Calculator

See the real commercial effect of a discount before launching it.

## Interact First, Then Calculate

Start by asking:
1. What form does this discount take?
   - Straight percentage off
   - coupon
   - Spend-threshold discount (e.g., "$X off when you spend $Y")
   - second-unit discount
2. How do you usually calculate discount impact?
3. Do you want to factor in a conversion uplift assumption this time?
4. Should we also consider refund rate, AOV changes, and CAC tolerance?
5. Do you want to follow your existing methodology, or should I recommend an analysis framework?

If the user does not have an established methodology, recommend a framework first, then calculate after confirmation.

## Python script guidance

Once the user provides structured numbers:
- Generate a Python script for discount scenario analysis
- Output baseline vs discount scenario
- Return break-even / margin / CAC changes
- Append a reusable script at the end

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

1. Clarify the baseline commercial setup and discount logic.
2. Model the scenario inputs that change order economics.
3. Surface upside, downside, and sensitivity.
4. Identify the biggest weak points or break-even pressure.
5. Recommend whether to test, revise, or avoid the scenario.
6. Return reusable Python script.

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

## Resource

See `references/output-template.md`.

## Example

**User:** We want to run a 20% off sitewide sale. Our average order is $65 with 45% gross margin. Is it worth it?

**Assistant:** Let me first clarify: are you assuming any conversion uplift from the discount, and should I factor in your current refund rate? Baseline: $65 AOV, $29.25 margin. With 20% off: $52 AOV, $16.25 margin -- a 44% margin reduction per order. You would need conversion to increase by at least 80% just to break even on gross profit. I will generate a Python script modeling scenarios with and without conversion uplift so you can see the full picture.
