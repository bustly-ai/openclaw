---
name: "TikTok Affiliate ROI"
description: "Estimate TikTok affiliate ROI before launch using simple revenue, payout, and cost assumptions. Use when teams need a fast go/no-go decision."
status: enabled
layer: core
sub_layer: finance-tax
---
# TikTok Affiliate ROI

## Skill Card

- **Category:** Performance & Measurement
- **Core problem:** Teams launch affiliate deals without a clear profit picture.
- **Best for:** Fast ROI checks before creator or affiliate campaigns go live.
- **Expected input:** Price, costs, payout model, expected volume, extra spend.
- **Expected output:** ROI result + risk notes + go/watch/no-go recommendation.

## Interact First, Then Calculate

Start by asking:
1. What methodology do you want to use for this affiliate ROI calculation?
   - GMV ROI
   - net revenue ROI
   - contribution profit ROI
2. How should commission / CPS / fixed slot fees be accounted for?
3. Do you want to factor in refund rate, creator sampling costs, additional paid traffic, and customer service costs?
4. Do you have a standard methodology for calculating affiliate ROI?
5. Do you want to follow your existing methodology, or should I recommend a framework?

## Python script guidance

When structured data is available:
- Generate a Python script to calculate affiliate ROI
- Display payout / cost / return assumptions
- Output baseline vs scenario result
- Return a reusable script

## Workflow

1. Clarify assumptions and ROI logic.
2. Calculate margin and total cost.
3. Estimate net profit and ROI.
4. Flag sensitive assumptions and give recommendation.
5. Return reusable Python script.

## Output format

1. Assumptions
2. ROI result
3. Risk notes
4. Recommendation
5. Python script

## Quality and safety rules

- Show assumptions clearly.
- Do not fake precision.
- Highlight what most affects downside risk.
- Do not finalize before key assumptions are confirmed.

## License

Copyright (c) 2026 **Razestar**.

This skill is provided under **CC BY-NC-SA 4.0** for non-commercial use.
You may reuse and adapt it with attribution to Razestar, and share derivatives
under the same license.

Commercial use requires a separate paid commercial license from **Razestar**.
No trademark rights are granted.

## Example

**User:** We're paying a creator 20% commission on a $45 product that costs us $18. Is this affiliate deal worth it?

**Assistant:** Let me clarify the ROI basis first -- are we calculating on GMV, net revenue, or contribution profit? Assuming net revenue ROI with your numbers: revenue $45, COGS $18, commission $9 (20%), leaving $18 gross margin before other costs. If you add $3 estimated shipping and $1.50 for returns (est. 5% rate), net profit per unit is ~$13.50 with a 30% net margin. ROI looks healthy at this volume. I'll generate a Python script so you can adjust assumptions and run scenarios.
