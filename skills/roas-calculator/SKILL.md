---
name: "ROAS Calculator"
description: "Evaluate ad ROAS against ecommerce margin reality, not just attributed revenue. Use when teams need a fast scale/hold/cut decision on paid traffic."
status: enabled
layer: core
sub_layer: finance-tax
---
# ROAS Calculator

A high ROAS doesn't necessarily mean the ad spend is truly worth scaling.

## Interact First, Then Calculate

This skill should not jump straight to results.

Start by clarifying:
1. What revenue basis do you want to use for ROAS?
   - Platform-attributed revenue?
   - Net revenue after refunds?
   - Effective revenue after discounts?
2. How do you normally calculate break-even ROAS?
3. Do you want to use your existing methodology, or should I provide a recommended e-commerce calculation framework?
4. Should fulfillment, customer service, creative costs, and channel fees be factored in?

If the user doesn't have a mature methodology, provide a recommended framework first, then ask the user to confirm.

## Python script guidance

Once the user provides structured numbers:
- Generate a Python script for the calculation
- First display assumptions and formulas
- Then output results
- Finally return a reusable script

If the numbers are incomplete:
- Do not force a calculation
- Continue asking for missing variables
- Or provide recommended default values and wait for user confirmation

## Problems Solved

Many teams increase budgets as soon as they see ad returns, but overlook:
- Discounts, refunds, logistics, and processing fees erode retainable revenue;
- Platform attribution looks great, but that doesn't mean actual profit looks great;
- Whether an ad's ROAS is sufficient depends not on industry averages, but on your unit economics.

The goal of this skill is:
**Put ROAS back into the context of real e-commerce profitability and provide a scale / hold / cut recommendation.**

## When to Use

- Before scaling budget;
- Ad performance looks good on the surface, but profitability is uncertain;
- The team needs to align on a unified break-even ROAS benchmark.

## Input Requirements

- Ad spend
- Attributed revenue
- Gross margin / cost structure
- Discounts and promotions
- Refund rate / return impact
- Optional: channel fees, creative costs, customer service costs

## Workflow

1. Clarify the ROAS and profit definitions the user is using.
2. Calculate nominal ROAS.
3. Estimate break-even ROAS based on the profit structure.
4. Adjust effective revenue based on refunds and discounts.
5. Provide recommendations on whether to scale spend.
6. Output a reusable Python script.

## Output Format

1. Assumptions table
2. ROAS results
3. Break-even comparison
4. Recommended actions
5. Python script

## Quality Standards

- Don't just report the ROAS number — explain whether it's sufficient.
- Clearly identify the gap between attributed and actual profit.
- Output should directly support budget decisions.
- Clearly label estimated items.
- Do not feign precision before definitions are confirmed.

## Resources

Refer to `references/output-template.md`.

## Example

**User:** We spent $3,000 on TikTok ads with $12,000 in attributed revenue. The 4x ROAS looks good, but I'm not sure whether we can continue scaling.

**Assistant:** Let's first clarify the metrics: Is your $12,000 platform-attributed revenue or net revenue after refunds? Assuming a 10% refund rate, 15% platform fees, and 45% gross margin -- effective revenue is approximately $10,800, after fees it's $9,180, and gross profit is $4,131. Break-even ROAS is approximately 2.7x, and your current actual ROAS is approximately 3.1x (after refunds), so there's headroom but it's not generous. Recommendation: You can scale up modestly by 20% while monitoring changes in the refund rate. A Python script has been generated -- adjust the variables to recalculate.
