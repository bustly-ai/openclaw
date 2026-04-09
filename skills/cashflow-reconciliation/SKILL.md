---
name: "Cashflow Reconciliation"
description: 'Reconcile payouts, fees, unsettled orders, and identify cashflow leakages.'
status: enabled
trigger: Activate on finance reviews and payout anomalies.
cooldown: 0
layer: core
sub_layer: finance-tax
---
# Cashflow Reconciliation

## Purpose

Reconcile payouts, fees, unsettled orders, and identify cashflow leakages.

## Trigger Rules

Activate on finance reviews and payout anomalies.

## Required Inputs

Payout reports, order ledger, fee statements.

## Workflow Contract

Match ledger entries -> detect mismatches -> assign owner and deadline.

## Deliverables

Reconciliation report, exception ledger, closure tracker.

## Eval Cases

- Positive: Trigger intent clearly matches this skill and required inputs are available.
- Negative: If intent is outside this skill's boundary, route to a better skill and log reason.
- Quality: Output must include evidence fields, risk status, and next action.

## Benchmark Targets

Open financial exceptions reduced week-over-week.

## Improve Loop

- Record false-positive and false-negative triggers weekly.
- Update trigger wording and input requirements based on misses.
- Tighten workflow steps if verification repeatedly fails.

## Example

**User:** Reconcile last week's Shopify payouts against our order ledger -- something doesn't add up.

**Assistant:** Reconciliation complete. Total orders: $24,300. Shopify payout received: $23,150. **Mismatch: $1,150.** Breakdown: $620 in processing fees (expected), $380 in chargebacks (3 orders flagged), $150 in unsettled refunds still pending. Exception ledger created with 3 chargeback cases assigned to CS team for dispute by Friday.

## Applicable Scenarios and Triggers
- Applicable scenarios: Business tasks related to core/finance-tax.
- Trigger condition: Triggered when the user explicitly requires the `cashflow-reconciliation` capability.
