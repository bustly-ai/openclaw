---
name: "Creator Market Digest"
description: >-
  Creator Market Digest supports ecommerce and DTC teams in creator,
  partnership, and outreach work. Use when a decision depends on diagnosing
  gaps, ranking evidence, or choosing the highest-impact fix.
status: enabled
layer: ecommerce
sub_layer: creators
---
# Creator Market Digest

## Overview

Creator Market Digest turns messy creator, partnership, and outreach inputs into a ranked diagnosis with evidence, confidence, and next actions.

## When to Use

- The request is fundamentally about creator, partnership, and outreach work, and the operator needs a clear diagnosis.
- The team could act immediately if Creator Market Digest returns a crisp verdict, deliverable set, and next-step list.

## Do Not Use When

- Do not pretend a mutation, publish, render, or API call already happened when the skill only provides planning or analysis.
- Do not keep this skill active once the task clearly belongs to a narrower adjacent skill.
- Do not use this skill for final production copy or final asset generation when the real need is execution.
- Do not hide low-confidence reasoning behind generic best-practice language.

## Required Inputs

- creator handle(s) or sample content
- product / offer + target buyer
- budget or commercial constraint
- desired decision
- the one business question that matters most
- what counts as success after the next review window
- market shifts, creator trend signals, or platform changes from the current period

## Deliverables

- one-line verdict or executive summary
- evidence or rationale table
- priority-ranked actions or decisions
- risks and recommended next steps
- diagnosis or scorecard
- confidence labels
- P0 / P1 / P2 action list
- partner-fit, sequence, or collaboration guidance

## Workflow

1. Summarize the top market shifts, creator behavior changes, and platform moves from the current period.
2. Separate durable changes from one-off noise or anecdotal chatter.
3. Translate the shift into concrete brand implications, who should react, and what to watch next week.
4. End with a watchlist and the next checkpoint for refreshing the digest.

## Output Format

1. Conclusion / verdict
2. Key evidence or context table
3. Top findings or ranked diagnosis
4. Priority actions
5. Risks / caveats / missing data
6. Recommended next steps

## Boundary and Routing

- Use this for period summaries and implications, not for single-creator approval decisions.

## Quality Rules

- Separate observed facts, user-provided facts, and assumptions.
- Do not invent claims, metrics, specs, or proof that were not provided or verified.
- Prefer the shortest useful answer that an operator can actually use.
- Do not over-generalize from one screenshot, one SKU, one creator, or one short time window.
- Keep the top 3-5 actions only; backlog items belong in a secondary list.

## Digest Structure

- Return five blocks: what changed, why it matters, who should care, what to do now, and what to watch next.
- Do not reuse outreach or acceptance-rate metrics in this digest; the output is a market summary, not a pipeline KPI review.

## Missing Data Protocol

- Ask for the smallest missing set that would materially change the answer.
- If the core blocker is missing, stop short of a hard verdict and say exactly what is needed.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

## Validation Loop

- Recheck: reply rate / acceptance / go-live quality / attributed GMV proxy.
- Review window: after the next review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If direct analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

## Bundled Resources

| Resource | When to Read |
| --- | --- |
| `references/output-template.md` | Use when the task is recurring, handoff-heavy, or needs a stable answer shape. |

## Example

**Scenario:** TikTok Shop美妆类目运营团队，需每周达人市场快报：本周佣金率变化、头部达人品类偏移信号、平台政策调整影响。时间窗口：过去7天。

**Expected response shape:**
- Start with the conclusion or verdict.
- Show the evidence or assumptions used.
- Give the operator-ready actions or draft output.
- End with risks and next steps.
