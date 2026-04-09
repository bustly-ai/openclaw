# Analytical Report Methodology

Use this file whenever the PDF is a business / ops / growth / finance / marketing / customer analysis report.

## Objective

The report must help the reader decide what happened, why it happened, what it means, and what to do next.
It is not a decorative summary.

## Required Workflow

Before writing blocks, force the analysis through this sequence:

1. Define scope
- Time window
- Entity scope (store / campaign / customer segment / product set)
- Comparison baseline
- Missing-data handling

2. Build the metric frame
- Identify 4-8 core metrics
- Define each metric before interpreting it
- Distinguish leading indicators from outcome indicators

3. Diagnose drivers
- Break results by the most relevant dimensions: channel, product, customer, region, time, funnel stage
- Separate magnitude from mix shift
- Distinguish structural change from one-off events

4. Convert evidence into findings
- Each finding must include:
  - Observation: what changed
  - Evidence: the number or comparison that proves it
  - Likely cause: why it changed
  - Business implication: why the reader should care

5. Turn findings into actions
- Every action must tie back to a finding
- Include urgency and expected effect
- Avoid generic “keep monitoring” recommendations unless there is a specific risk trigger

## Mandatory Output Shape

For analysis-heavy PDFs, include all of these sections:

## Executive Summary
- 3-5 bullets only
- Each bullet must contain:
  - headline metric
  - change or delta
  - main driver
  - implication

## Metric Decomposition
- Use a table
- Recommended columns:
  - Metric
  - Current
  - Baseline / Prior period
  - Delta
  - Interpretation

## Key Findings
- At least 3 findings
- Good pattern:
  - “Repeat purchase revenue contributed 52.2% of total revenue, versus 41.0% in the prior window, indicating that growth came from retention rather than top-of-funnel expansion.”

## Driver Analysis
- Use sub-sections by dimension
- Examples:
  - Customer segments
  - Channel performance
  - Product concentration
  - Day-of-week / campaign timing

## Risks & Blind Spots
- Must include:
  - missing data
  - attribution ambiguity
  - outlier sensitivity
  - sample-size / time-window limitations

## Prioritized Actions
- 3-5 actions
- Each action should say:
  - what to do
  - why now
  - expected effect
  - urgency / priority

## Writing Rules

- Prefer quantified language over adjectives.
- Do not say “good”, “bad”, “stable”, or “healthy” without evidence.
- Do not repeat a metric in prose unless the prose adds interpretation.
- If the cause is uncertain, say “likely” and explain the uncertainty.
- If a conclusion depends on missing data, state the missing field explicitly.

## Red Flags

Rewrite the report if you see any of these:

- The summary only repeats numbers without interpretation.
- Findings do not explain causality or implication.
- Actions are generic and not tied to evidence.
- The report has no baseline, comparison period, or definition of success.
- The narrative says “overall stable” or “performing well” without quantification.
