---
name: "Break-even Calculator Ecommerce"
description: "Calculate ecommerce break-even thresholds using price, cost, shipping, ad spend, and overhead assumptions. Use when operators need a simple no-loss baseline before scaling."
status: enabled
layer: core
sub_layer: finance-tax
---
# Break-even Calculator Ecommerce

First calculate the "break-even" line, then talk about scaling.

## Interact First, Then Calculate

Start by asking:
1. Which type of break-even do you want to calculate?
   - Per order
   - Per campaign
   - Monthly overall
2. What costs do you typically include in your break-even calculation?
3. How do you distinguish between fixed costs and variable costs?
4. Do you also want to back-calculate break-even CPA / ROAS / conversion threshold?
5. Do you want to use your existing logic, or should I provide a recommended framework?

## Python script guidance

Once the user provides structured numbers:
- Generate a Python script to complete the break-even calculation
- Display formulas and cost breakdowns
- Output key thresholds
- Return a reusable script

## Problem It Solves

Many e-commerce ad spend or promotional decisions face a problem — it's not that growth is impossible, but rather not knowing:
- At the current price, what's the minimum number of units to sell to break even;
- What CPA is still acceptable;
- After discounts, free shipping, and increased ad spend, how much higher the break-even point has been pushed.

The goal of this skill is:
**Provide a clear break-even calculation so the team knows when revenue is just "looking good on paper" versus when it's truly not losing money.**

## When to Use

- Before launching a new product, to set a baseline;
- Before adjusting pricing, discounts, or free shipping policies;
- When margins on existing products are thinning and you want to identify the key pressure points.

## Input Requirements

- Selling price
- Unit cost
- Shipping / packaging / handling fees
- Advertising costs or target customer acquisition cost
- Fixed costs (e.g., team / tools / monthly amortization)
- Discounts, refund losses, and other additional variables

## Workflow

1. Clarify the user's break-even definition and scope.
2. Calculate per-unit contribution margin.
3. Calculate the sales volume needed to cover fixed costs.
4. Derive break-even CPA / ROAS / conversion thresholds.
5. Highlight the most sensitive cost items.
6. Return a reusable Python script.

## Output Format

1. Core Assumptions Table
2. Break-even Results
3. Key Thresholds
4. Risk Alerts & Recommended Actions
5. Python Script

## Quality Standards

- Formulas are clear and auditable.
- Distinguish between variable costs and fixed costs.
- Do not just provide a single number; provide actionable thresholds.
- Clearly label uncertain assumptions.
- Do not feign precision before the scope is confirmed.

## Resources

Refer to `references/output-template.md`.

## Example

**User:** Our product is priced at $29.99, cost is $8, shipping is $4.50, and the average ad spend per order is $6. Help me calculate the break-even point.

**Assistant:** Per-unit contribution margin: $29.99 - $8 - $4.50 - $6 = $11.49. If monthly fixed costs (team + tools) are $3,000, you need to sell at least 262 units per month to break even. Break-even CPA ceiling is $17.49, and break-even ROAS is 1.72x. The most sensitive cost item is ad spend — for every $1 increase in CPA, the monthly break-even volume increases by approximately 23 units. A Python script has been generated for you to adjust parameters and reuse.
