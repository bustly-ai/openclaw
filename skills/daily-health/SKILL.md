---
name: "Daily Health"
description: Daily summary of key metrics including revenue, profit, advertising, refunds, etc., with anomalies highlighted. Triggered when the user mentions daily report, business health, or today's data.
status: enabled
layer: core
sub_layer: daily-ops
---
# Daily Health

Merchants need a daily summary and anomaly detection for key metrics such as revenue, profit, ad spend, ROAS, refund rate, etc.

## Trigger Conditions

At a fixed time each day / User actively requests a business health summary

## Allowed Operations

- Read Shopify order and revenue data
- Read Google Ads spend and ROAS data
- Read refund and complaint data

## Execution Steps

1. Retrieve relevant data
2. Analyze and process
3. Generate results and recommendations

## Success Criteria

Output includes a summary of all key metrics, with anomalies highlighted along with possible causes and recommendations

## Constraints and Guardrails

Read-only operations; no write operations are performed


<!-- Iteration improvement: added more detailed steps -->

## Example

**User:** How is the store's business health looking today?

**Assistant:** Today's summary: Revenue $12,340 (DoD +5%), gross margin 42%, ad spend $1,820, ROAS 3.2, refund rate 2.1%. Anomaly: Refund rate is elevated compared to the 7-day average (1.4%), primarily concentrated on SKU-0892 (size-related complaints). Recommendation: Review the sizing chart accuracy for that SKU and pause its ad campaigns until the refund cause is confirmed.
