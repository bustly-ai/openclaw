---
name: "Profit Margin Calculator"
description: "Calculate true ecommerce profit margin after product cost, shipping, platform fees, discounts, and refund drag. Use when teams need a fast profitability reality check."
status: enabled
layer: core
sub_layer: finance-tax
---
# Profit Margin Calculator

Don't just look at gross profit — look at how much is actually left at the end.

## Interact First, Then Calculate

Before starting, confirm:
1. Do you want to look at gross margin, contribution margin, or net margin?
2. Does your usual profit margin calculation include:
   - Shipping / packaging
   - Platform fees / payment fees
   - Discounts / subsidies
   - Refunds / after-sales losses
   - Fixed cost allocation
3. Do you want to use your existing formula, or would you like me to recommend an e-commerce profit breakdown approach?

If the user does not have a unified calculation standard, recommend a framework first, then ask the user to confirm.

## Python script guidance

When the user provides structured numbers:
- Generate a Python script to complete the profit breakdown
- List formulas and assumptions first
- Then return gross profit / net profit results
- Also return a reusable script

If the input is incomplete, ask follow-up questions first — do not directly output seemingly precise results.

## Problem It Solves

Many teams say "this product has good margins," but they only calculated selling price minus purchase price, without factoring in:
- Shipping and packaging;
- Platform transaction fees;
- Discounts, coupons, and promotional subsidies;
- Refunds and after-sales losses;
- When necessary, allocation of basic operating costs.

The goal of this skill is:
**Turn profit margin from a rough number into a real margin breakdown that can be used for business decisions.**

## When to Use

- Comparing profit health across multiple SKUs;
- Confirming whether there is still room before setting prices;
- Investigate when revenue grows but profit does not.

## Input Requirements

- Selling price
- Cost of goods
- Fulfillment costs: shipping / packaging / warehousing, etc.
- Platform fees / payment fees / channel fees
- Discounts or promotions
- Refund rate / after-sales losses
- Optional: fixed cost allocation

## Workflow

1. Clarify the user's margin definition.
2. Calculate gross profit and gross margin.
3. Deduct fulfillment, channel, discount, and refund impacts.
4. Output net profit and net margin.
5. Flag the areas where profit erosion is most severe.
6. Return a reusable Python script.

## Output Format

1. Cost breakdown table
2. Gross profit / net profit results
3. Margin risk points
4. Optimization suggestions
5. Python script

## Quality Standards

- Do not confuse gross margin and net margin.
- Clearly identify where profit is being consumed.
- Results should be usable for SKU comparison or business review.
- Clearly indicate which figures are estimates.
- Do not feign precision before the margin definition is confirmed.

## Resources

Refer to `references/output-template.md`.

## Example

**User:** Help me calculate the real profit margin for this product: selling price $39.99, purchase cost $12, shipping $5.50, platform fee 15%, refund rate 8%.

**Assistant:** Let me first confirm the scope: are you looking at the contribution margin (profit after fulfillment and channel costs), or the net margin (further deducting fixed costs)? Based on the numbers you provided, I'll first calculate the contribution margin: selling price $39.99, platform fee $6.00, COGS $12, shipping $5.50, refund loss approximately $3.20 -- per-unit contribution profit $13.29, contribution margin 33.2%. The biggest margin eaters are the platform fee (15%) and refunds (8%). I'll generate a reusable Python script for you to batch-calculate other SKUs.
