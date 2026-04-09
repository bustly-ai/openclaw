---
name: "Paid Media Orchestrator"
description: >-
  E Commerce Marketing Orchestrator (Ads Layer) supports ecommerce and DTC teams
  in ads, creative, and attribution work. Use when a decision depends on
  diagnosing gaps, ranking evidence, or choosing the highest-impact fix.
status: enabled
layer: ecommerce
sub_layer: ads
---
# Paid Media Orchestrator

## Overview

E Commerce Marketing Orchestrator (Ads Layer) turns messy ads, creative, and attribution inputs into a ranked diagnosis with evidence, confidence, and next actions. Keep this skill at the performance layer: paid media, attribution, creative diagnosis, and funnel constraints after the strategic objective is already known.

## When to Use

- The request is fundamentally about ads, creative, and attribution work, and the operator needs a clear diagnosis.
- The team could act immediately if E Commerce Marketing Orchestrator (Ads Layer) returns a crisp verdict, deliverable set, and next-step list.
- Use this after the marketing goal is already clear and the blocker is inside ads, attribution, or post-click performance.

## Do Not Use When

- Do not pretend a mutation, publish, render, or API call already happened when the skill only provides planning or analysis.
- Do not keep this skill active once the task clearly belongs to a narrower adjacent skill.
- Do not use this skill for final production copy or final asset generation when the real need is execution.
- Do not hide low-confidence reasoning behind generic best-practice language.

## Required Inputs

- platform and campaign scope
- time window + spend context
- metrics or screenshots
- target KPI or benchmark
- the one business question that matters most
- what counts as success after the next review window

## Deliverables

- one-line verdict or executive summary
- evidence or rationale table
- priority-ranked actions or decisions
- risks and recommended next steps
- diagnosis or scorecard
- confidence labels
- P0 / P1 / P2 action list
- metric guardrails or spend thresholds

## Workflow

1. Start with the performance symptom: spend inefficiency, attribution break, weak creative, or funnel leak.
2. Separate traffic quality, creative performance, tracking integrity, and post-click friction before diagnosing.
3. Rank the highest-leverage fixes and state what should be checked next if the first fix does not move the KPI.
4. Route to narrower ads, tracking, or CRO skills only after the core performance bottleneck is named.

## Output Format

1. Conclusion / verdict
2. Key evidence or context table
3. Top findings or ranked diagnosis
4. Priority actions
5. Risks / caveats / missing data
6. Recommended next steps

## Boundary and Routing

- This is the performance router. Keep it narrower than general marketing strategy.

## Quality Rules

- Separate observed facts, user-provided facts, and assumptions.
- Do not invent claims, metrics, specs, or proof that were not provided or verified.
- Prefer the shortest useful answer that an operator can actually use.
- Do not over-generalize from one screenshot, one SKU, one creator, or one short time window.
- Keep the top 3-5 actions only; backlog items belong in a secondary list.

## Missing Data Protocol

- Ask for the smallest missing set that would materially change the answer.
- If the core blocker is missing, stop short of a hard verdict and say exactly what is needed.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

## Validation Loop

- Recheck: CTR / CVR / CPA / ROAS movement.
- Review window: after the next review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If direct analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

## Example

**Scenario:** 护肤品牌新品上市，需要全渠道营销方案：产品定价$58，目标受众25-40岁城市女性，上线渠道Meta广告+TikTok+Instagram+邮件，首月预算$8K，目标ROI 3x（即$24K GMV）。

**Expected response shape:**
- Start with the conclusion or verdict.
- Show the evidence or assumptions used.
- Give the operator-ready actions or draft output.
- End with risks and next steps.
