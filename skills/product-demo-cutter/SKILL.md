---
name: "Product Demo Cutter"
description: >-
  Product Demo Cutter supports ecommerce and DTC teams in content production
  work. Use when the next move is unclear and the team needs sequencing,
  priorities, or go / no-go guidance.
status: enabled
layer: ecommerce
sub_layer: content
---
# Product Demo Cutter

## Overview

Product Demo Cutter helps the operator choose the next move, sequence work, and define stop / switch rules instead of spreading effort everywhere. Use this to define the cut plan, timecode priorities, and CTA structure for a shorter edit. It should not pretend the final video has already been rendered.

## When to Use

- The request is fundamentally about content production work, and the operator needs a decision-ready plan.
- The team could act immediately if Product Demo Cutter returns a crisp verdict, deliverable set, and next-step list.

## Do Not Use When

- Do not pretend a mutation, publish, render, or API call already happened when the skill only provides planning or analysis.
- Do not keep this skill active once the task clearly belongs to a narrower adjacent skill.
- Do not recommend five paths at once just to avoid making a choice.
- Do not use this skill when the user already has a fixed plan and only needs one concrete asset or one system action.
- Do not claim the final edit exists if you only produced a cut plan and timecode brief.

## Required Inputs

- source material or transcript
- target channel / format
- audience + CTA
- brand guardrails
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
- asset, script, or brief structure

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

## Cut-Plan Rules

- Return exact keep / cut / compress guidance with approximate timecode ranges when possible.
- Separate the 30-second PDP cut from the 15-second ad hook cut instead of treating them as one edit.

## Missing Data Protocol

- Ask for the smallest missing set that would materially change the answer.
- If the core blocker is missing, stop short of a hard verdict and say exactly what is needed.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

## Validation Loop

- Recheck: publish quality / engagement proxy / reuse readiness.
- Review window: after the first sprint or checkpoint in the plan.
- Define what improvement, no-change, and failure look like before closing the task.
- If direct analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

## Bundled Resources

| Resource | When to Read |
| --- | --- |
| `references/output-template.md` | Use when the task is recurring, handoff-heavy, or needs a stable answer shape. |

## Example

**Scenario:** 智能空气净化器，有5分22秒演示视频，内容包括：0:00-0:15开箱（低价值）、0:15-1:05产品外观360度展示（中等）、1:05-1:45PM2.5净化实测（强）、1:45-2:30滤网更换演示（实用）、2:30-3:20噪音对比测试（强）、3:20-4:10App控制界面（中等）、4:10-5:22重复拆箱+品牌结尾。需要：PDP主图视频(≤30s)、TikTok广告(15s hook)、创作者brief素材。

**Expected response shape:**
- Start with the conclusion or verdict.
- Show the evidence or assumptions used.
- Give the operator-ready actions or draft output.
- End with risks and next steps.
