---
name: "Churn Prevention Suite"
description: >-
  Churn Prevention Suite supports ecommerce and DTC teams in review, retention,
  and customer-ops work. Use when the next move is unclear and the team needs
  sequencing, priorities, or go / no-go guidance.
status: enabled
trigger: Activate on churn risk spikes and retention goals.
cooldown: 0
layer: ecommerce
sub_layer: customers
---
# Churn Prevention Suite

## Overview

Churn Prevention Suite helps the operator choose the next move, sequence work, and define stop / switch rules instead of spreading effort everywhere.

## When to Use

- The request is fundamentally about review, retention, and customer-ops work, and the operator needs a decision-ready plan.
- The team could act immediately if Churn Prevention Suite returns a crisp verdict, deliverable set, and next-step list.

## Do Not Use When

- Do not pretend a mutation, publish, render, or API call already happened when the skill only provides planning or analysis.
- Do not keep this skill active once the task clearly belongs to a narrower adjacent skill.
- Do not recommend five paths at once just to avoid making a choice.
- Do not use this skill when the user already has a fixed plan and only needs one concrete asset or one system action.

## Required Inputs

- review / comment / retention source
- time window + sample size
- product or lifecycle scope
- desired decision or output
- timeline and owner constraints
- what to do now versus what can wait

## Deliverables

- one-line verdict or executive summary
- evidence or rationale table
- priority-ranked actions or decisions
- risks and recommended next steps
- what to do now / later / not yet
- owner + review window
- stop / switch rule
- customer-facing or ops-facing response guidance

## Workflow

1. Clarify objective, timing, and the non-negotiable constraints before proposing a path.
2. Choose the first move, the second move, and the things to delay rather than giving equal weight to every option.
3. Turn the decision into a short execution plan with owners, timing, and stop / switch rules.
4. Name the review checkpoint and the metric or signal that would trigger a change in plan.

## Output Format

1. Executive summary
2. Decision table or why-now rationale
3. What to do now / later / not yet
4. Review window + success criteria
5. Risks and next steps

## Boundary and Routing

- Keep the skill focused on its core decision or output and hand off once the task narrows to execution.

## Quality Rules

- Separate observed facts, user-provided facts, and assumptions.
- Do not invent claims, metrics, specs, or proof that were not provided or verified.
- Prefer the shortest useful answer that an operator can actually use.
- Choose a first path; do not hide behind equal-priority recommendations.
- Tie each recommendation to a review window and a decision threshold.

## Retention Segmentation

- Separate involuntary churn, voluntary churn, discount-only buyers, and lapsing loyal customers before choosing an intervention.
- Use the smallest incentive that is likely to recover the segment profitably.
- If CRM data is weak, return a segmentation hypothesis and the minimum data needed to operationalize it.

## Missing Data Protocol

- Ask for the smallest missing set that would materially change the answer.
- If the core blocker is missing, stop short of a hard verdict and say exactly what is needed.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

## Validation Loop

- Recheck: reply quality / review sentiment mix / refund share / repeat rate.
- Review window: after the first sprint or checkpoint in the plan.
- Define what improvement, no-change, and failure look like before closing the task.
- If direct analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

## Bundled Resources

| Resource | When to Read |
| --- | --- |
| `references/output-template.md` | Use when the task is recurring, handoff-heavy, or needs a stable answer shape. |

## Example

**Scenario:** DTC护肤品牌，5000名活跃客户，90天复购率从38%下降至26%，CS工单中「未收到推荐邮件」反馈近30条，平均购买间隔从45天延长至72天。

**Expected response shape:**
- Start with the conclusion or verdict.
- Show the evidence or assumptions used.
- Give the operator-ready actions or draft output.
- End with risks and next steps.
