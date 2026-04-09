---
name: "LTV CAC Calculator"
description: "Compare ecommerce LTV and CAC using realistic order, margin, and retention assumptions. Use when teams need to know whether acquisition is compounding value or buying fragile revenue."
status: enabled
layer: core
sub_layer: finance-tax
---
# LTV CAC Calculator

Growth doesn't end with acquiring users — the key is whether these customers are worth the acquisition cost.

## Interact First, Then Calculate

Before starting, you must ask:
1. What time window do you want for LTV calculation?
   - 30 days?
   - 90 days?
   - 12 months?
   - Full lifecycle?
2. Should LTV be based on revenue, gross profit, or contribution profit?
3. Does CAC include:
   - Ad spend
   - Channel service fees
   - Team/agency costs
   - Discounts and subsidies
4. Do you currently have your own LTV/CAC definitions?
5. Do you want to use your existing definitions, or would you like me to provide a recommended framework?

## Python script guidance

When the user provides structured data:
- Generate a Python script to perform the LTV/CAC calculation
- Display assumptions, lifecycle window, and metric definitions
- Return results along with risk commentary
- Also return a reusable script

If the user's metric definitions are unclear, provide a recommended framework first, then calculate after the user confirms.

## Problems Solved

Many teams claim "this channel is still profitable," but haven't truly figured out:
- Whether users will make repeat purchases;
- Whether gross profit can cover the customer acquisition cost;
- It looks like it's working, but the payback period is actually too slow;
- If retention deteriorates, whether the entire model will instantly break down.

The goal of this skill is:
**To estimate the LTV/CAC relationship in an interpretable way and provide a judgment on whether growth is healthy.**

## When to Use

- Evaluating new channels or new campaigns;
- Reviewing whether a certain customer segment is worth continued budget allocation;
- Comparing acquisition quality across different products and audience segments.

## Input Requirements

- Average order value
- Gross margin structure
- Repeat purchase frequency / lifecycle window
- Current CAC
- Optional: refund rate, customer service cost, fulfillment cost, membership contribution

## Workflow

1. Clarify the user's LTV and CAC definitions.
2. Estimate per-customer lifecycle contribution.
3. Calculate the LTV / CAC ratio.
4. Determine whether the payback period is healthy.
5. Highlight the weakest link: retention, gross margin, pricing, CAC, etc.
6. Output a reusable Python script.

## Output Format

1. Assumptions table
2. LTV / CAC result
3. Risk commentary
4. Recommended actions
5. Python script

## Quality Standards

- Do not feign precision; lifecycle assumptions must be stated explicitly.
- Distinguish between "looks reasonable" and "truly robust."
- Output should serve budget and retention decisions.
- Recommended actions must be specific.
- Do not draw conclusions before the user confirms the definitions.

## Resources

Refer to `references/output-template.md`.

## Example

**User:** Our average order value is 120 yuan, gross margin is 40%, average repeat purchases are 2.3 times/year, and CAC is 85 yuan. Is this customer acquisition cost-effective?

**Assistant:** Calculated on a 12-month window using gross profit basis: LTV = 120 x 40% x 2.3 = 110.4 yuan, CAC = 85 yuan, LTV/CAC = 1.30x. Assessment: marginally healthy but with very thin buffer -- payback is approximately 9.3 months. The weakest link is repeat purchase frequency; if it drops to 2.0 times, LTV/CAC falls below 1.1x. Recommendation: prioritize improving retention rather than scaling ad spend. A reusable Python script has been generated.
