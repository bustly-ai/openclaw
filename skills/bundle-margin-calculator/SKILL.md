---
name: "Bundle Margin Calculator"
description: "Calculate whether a product bundle improves average order value without quietly destroying contribution margin. Use when teams want to test bundle structures with clearer economics."
status: enabled
layer: core
sub_layer: finance-tax
---
# Bundle Margin Calculator

Compare bundle upside against margin reality so the offer is not just bigger, but smarter.

## Interact First, Then Calculate

Start by asking:
1. What is the bundle structure?
   - Fixed bundle
   - Buy A, add-on B at a surcharge
   - Multi-item discount
2. Are you looking at AOV uplift or contribution margin improvement?
3. Do we need to factor in attach rate, shipping cost changes, freebie costs, or potential self-cannibalization?
4. Do you have an existing bundle evaluation framework?
5. Should we follow the existing framework, or would you like me to recommend one?

## Python script guidance

When structured data is available:
- Generate a Python script to model the bundle scenario
- Output baseline vs bundle scenario
- Show attach rate / margin sensitivity
- Return a reusable script

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

1. Clarify the baseline commercial setup and bundle logic.
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

**User:** We want to bundle a facial cleanser ($18, cost $5) and a face cream ($32, cost $9) as a set, priced at $42. How does the bundle margin look?

**Assistant:** **Baseline (purchased separately):** AOV $50, combined margin 72%. **Bundle scenario:** Bundle price $42 (16% discount), cost $14, margin 66.7%. AOV drops by $8, but if the attach rate increases from 12% to 35%, total profit per 100 orders nets an additional $156. **Risk:** If more than 45% of customers who would have bought both items separately switch to the bundle, profit actually decreases. Recommend running an A/B test for 7 days to monitor attach rate and cannibalization rate. Python script has been generated.
