---
name: "Return Rate Impact Calculator"
description: "Calculate how return rate affects ecommerce profit, CAC tolerance, and operational risk. Use when teams need to see how refunds and reverse logistics change real margin."
status: enabled
layer: core
sub_layer: finance-tax
---
# Return Rate Impact Calculator

Return rate is not just an after-sales metric — it directly eats into profit, budget headroom, and growth decisions.

## Interact First, Then Calculate

Start by asking:
1. The type of return you want to analyze:
   - Refund rate
   - Return rate
   - Combined refund + return
2. What losses does your usual return impact calculation include?
   - Revenue clawback
   - Reverse logistics
   - Packaging materials
   - Resale depreciation
   - Customer service costs
3. Can the product be resold? What is the recovery rate?
4. Do you want to use your existing logic, or should I recommend a framework?

## Python script guidance

Once the user provides structured input:
- Generate a Python script to calculate return impact
- Display revenue loss and extra cost loss
- Output adjusted profit and CAC tolerance
- Return a reusable script

## Problem It Solves

Many teams focus on GMV, ROAS, and AOV, but overlook a key fact:
- When return rates are high, revenue does not equal retainable revenue;
- After-sales, reverse logistics, repackaging, and depreciation continue to erode profit;
- On the surface, ad spend still seems viable, but the actual affordable CAC has already dropped.

The goal of this skill is to:
**Clearly calculate the impact of return rate on profit and operational thresholds, avoiding decisions based on the illusion of "pre-return" numbers.**

## When to Use

- A specific SKU has a noticeably high refund rate;
- You want to know whether a high-return category can still scale;
- Evaluate whether policies, copywriting, sizing guides, and expectation management need adjustment.

## Input Requirements

- Order volume / sales revenue
- Selling price and gross margin
- Current return rate / refund rate
- Reverse logistics, processing fees, and resale depreciation
- Refund policy and whether items can be resold
- Optional: customer acquisition cost, warehousing, and additional customer service costs

## Workflow

1. Clarify the definition and scope of return impact.
2. Calculate baseline profit without considering returns.
3. Calculate revenue clawback and cost drag caused by returns.
4. Estimate adjusted net profit and affordable CAC.
5. Flag risk ranges and prioritized remediation actions.
6. Return a reusable Python script.

## Output Format

1. Core assumptions table
2. Return impact breakdown
3. Adjusted profit / thresholds
4. Risk alerts and recommended actions
5. Python script

## Quality Standards

- Clearly distinguish between revenue loss and additional cost loss.
- Output actionable thresholds for business operations, not just a percentage.
- Clearly state which values are assumptions.
- Prioritize highlighting the areas most worth fixing.
- Do not feign precision before the scope and definitions are confirmed.

## Resources

Refer to `references/output-template.md`.

## Example

**User:** We have a SKU with an 18% return rate, priced at $59, 40% gross margin, and $8 reverse logistics cost per order. We want to know how much profit returns are actually eating into.

**Assistant:** Based on the data you provided: base gross profit is $23.60/order, return-driven revenue clawback is $10.62/order (18% x $59), reverse logistics cost is $1.44/order (18% x $8), plus estimated secondary-sale markdown loss -- the adjusted net profit per order drops from $23.60 to approximately $11.54, and the net margin drops from 40% to 19.4%. Meanwhile, your affordable CAC also decreases from $23.60 to $11.54. I recommend prioritizing an investigation into return reasons -- if sizing issues are the main driver, optimizing the size chart could potentially bring the return rate below 10%. A Python script has been generated and can be used to batch-calculate other SKUs.
