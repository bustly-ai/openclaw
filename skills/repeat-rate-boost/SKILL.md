---
name: "Repeat Rate Boost"
description: >-
  Repeat Rate Boost supports ecommerce and DTC teams in review, retention, and
  customer-ops work. Use when a decision depends on diagnosing gaps, ranking
  evidence, or choosing the highest-impact fix.
status: enabled
trigger: Activate when retention is the primary KPI.
cooldown: 0
layer: ecommerce
sub_layer: customers
---
# Repeat Rate Boost

## Overview

Repeat Rate Boost turns messy review, retention, and customer-ops inputs into a ranked diagnosis with evidence, confidence, and next actions.

## When to Use

- The request is fundamentally about review, retention, and customer-ops work, and the operator needs a clear diagnosis.
- The team could act immediately if Repeat Rate Boost returns a crisp verdict, deliverable set, and next-step list.

## Do Not Use When

- Do not pretend a mutation, publish, render, or API call already happened when the skill only provides planning or analysis.
- Do not keep this skill active once the task clearly belongs to a narrower adjacent skill.
- Do not use this skill for final production copy or final asset generation when the real need is execution.
- Do not hide low-confidence reasoning behind generic best-practice language.

## Required Inputs

- review / comment / retention source
- time window + sample size
- product or lifecycle scope
- desired decision or output
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
- customer-facing or ops-facing response guidance

## Workflow

1. Define the decision question, review window, and the one KPI or business signal that matters most.
2. Normalize the evidence into a compact table that separates facts, assumptions, and missing data.
3. Rank the gaps or options by business impact, reversibility, and confidence.
4. Convert the diagnosis into P0 / P1 / P2 actions tied to evidence, not generic best practices.
5. End with a validation loop that makes the next review window explicit.

## Output Format

1. Conclusion / verdict
2. Key evidence or context table
3. Top findings or ranked diagnosis
4. Priority actions
5. Risks / caveats / missing data
6. Recommended next steps

## Boundary and Routing

- Keep the skill focused on its core decision or output and hand off once the task narrows to execution.

## Quality Rules

- Separate observed facts, user-provided facts, and assumptions.
- Do not invent claims, metrics, specs, or proof that were not provided or verified.
- Prefer the shortest useful answer that an operator can actually use.
- Do not over-generalize from one screenshot, one SKU, one creator, or one short time window.
- Keep the top 3-5 actions only; backlog items belong in a secondary list.

## Retention Metrics

- Tie recommendations to repeat rate, reorder timing, LTV direction, and replenishment-cycle fit rather than generic sentiment metrics.
- Differentiate between win-back, replenishment, and habit-forming interventions.

## Missing Data Protocol

- Ask for the smallest missing set that would materially change the answer.
- If the core blocker is missing, stop short of a hard verdict and say exactly what is needed.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

## Validation Loop

- Recheck: reply quality / review sentiment mix / refund share / repeat rate.
- Review window: after the next review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If direct analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

## Bundled Resources

| Resource | When to Read |
| --- | --- |
| `references/output-template.md` | Use when the task is recurring, handoff-heavy, or needs a stable answer shape. |

## Example

**Scenario:** 护肤DTC品牌，30天消耗型产品，首购客户复购率仅8%，行业均值22%。CRM使用Klaviyo，首购后60天内2,000人队列，无当前lifecycle序列。

**Expected response shape:**
- Start with the conclusion or verdict.
- Show the evidence or assumptions used.
- Give the operator-ready actions or draft output.
- End with risks and next steps.
