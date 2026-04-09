---
name: "CPA Calculator Ecommerce"
description: "Calculate allowable and break-even CPA for ecommerce offers using margin, refunds, and conversion assumptions. Use when teams need acquisition guardrails before spending harder."
status: enabled
layer: core
sub_layer: finance-tax
---
# CPA Calculator Ecommerce

First know how much customer acquisition cost you can afford, then talk about scaling.

## Problem Solved

Many advertising problems are not about insufficient volume, but rather:
- CPA has long exceeded the profit tolerance range;
- The team only focuses on ROAS without a clear CPA ceiling;
- Different offers / SKUs should have different bid caps, but nobody does the math.

The goal of this skill is:
**Calculate the break-even CPA and acceptable CPA range based on product profit structure and refund impact.**

## When to Use

- Before launching a new campaign;
- Before adjusting bidding strategy;
- When comparing the advertising feasibility of different products / bundles.

## Input Requirements

- Selling price
- Gross margin and fulfillment costs
- Refund / return impact
- Discounts and promotions
- Current conversion rate or target conversion assumptions
- Optional: repeat purchase contribution, additional fees

## Workflow

1. Calculate the profit contribution per customer.
2. Estimate the break-even CPA.
3. Provide a more conservative allowable CPA factoring in risk.
4. Suggest optimization directions such as raising prices, controlling discounts, and improving conversion rates.

## Output Format

1. Assumptions table
2. Break-even CPA
3. Allowable CPA range
4. Recommended actions

## Quality Standards

- Clearly distinguish between theoretical break-even and recommended CPA.
- The results should directly guide ad bidding decisions.
- Refunds and fulfillment costs must not be overlooked.
- Recommended actions should be specific.

## Resources

Refer to `references/output-template.md`.

## Example

**User:** We have a SKU priced at $49, with a cost of $18, fulfillment of $7, and a refund rate of 8%. Help me calculate the break-even CPA and the recommended bid cap.

**Assistant:** Profit contribution per customer: $49 - $18 - $7 = $24. After accounting for the 8% refund impact, approximately $22.08. Break-even CPA = $22.08. Recommended allowable CPA range: $15-$18 (with a 20% safety margin). Optimization direction: reducing the refund rate or increasing AOV can expand the bidding headroom.
