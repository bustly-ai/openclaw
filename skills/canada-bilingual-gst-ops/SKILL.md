---
name: "Canada Bilingual GST Ops"
description: Support Canadian bilingual content and GST/HST/PST operational checks.
status: enabled
trigger: Activate for Canada market operations.
cooldown: 0
layer: core
sub_layer: finance-tax
---
# Canada Bilingual GST Ops

## Purpose

Support Canadian bilingual content and GST/HST/PST operational checks.

## Trigger Rules

Activate for Canada market operations.

## Required Inputs

Province tax rules, EN/FR content assets.

## Workflow Contract

Validate tax logic and bilingual assets -> patch inconsistencies.

## Deliverables

Canada market readiness report.

## Eval Cases

- Positive: Trigger intent clearly matches this skill and required inputs are available.
- Negative: If intent is outside this skill's boundary, route to a better skill and log reason.
- Quality: Output must include evidence fields, risk status, and next action.

## Benchmark Targets

Province-level tax/content errors trend to zero.

## Improve Loop

- Record false-positive and false-negative triggers weekly.
- Update trigger wording and input requirements based on misses.
- Tighten workflow steps if verification repeatedly fails.

## Example

**User:** We're launching in Quebec and Ontario next month. Check our tax setup and content for bilingual compliance.

**Assistant:** Canada market readiness report: **Tax:** Ontario HST 13% is correctly configured. Quebec GST 5% + QST 9.975% needs to be split -- currently showing combined rate incorrectly. **Bilingual:** Product descriptions are EN-only; Quebec requires French. 12 out of 40 SKUs are missing FR translations. **Action items:** 1) Fix QC tax configuration to show GST+QST separately. 2) Translate remaining 12 product descriptions to French before launch.

## Applicable Scenarios and Triggers
- Applicable scenario: Business tasks related to core/finance-tax.
- Trigger condition: Triggered when the user explicitly requires the `canada-bilingual-gst-ops` capability.
