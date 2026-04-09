---
name: "Campaign Planner"
description: >-
  Generate campaign proposals with goals, budgets, and timelines. Trigger when
  user mentions campaign planning, launch strategy, or promotion setup. Use when
  the team needs a decision-ready plan, path choice, or go / no-go
  recommendation.
status: enabled
layer: ecommerce
sub_layer: ads
---
# Campaign Planner

## Overview

Generate campaign proposals with goals, budgets, and timelines. Trigger when user mentions campaign planning, launch strategy, or promotion setup. Use when the team needs a decision-ready plan, path choice, or go / no-go recommendation.

## When to Use

- The request is fundamentally about paid media, attribution, creative, or budget efficiency, and the next step is unclear and the operator needs sequencing, thresholds, or a rollout plan.
- The team could take action immediately if Campaign Planner returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

## Do Not Use When

- Do not pretend a system mutation happened if the skill only has analysis or drafting context.
- Do not keep this skill active when the request clearly belongs to a narrower adjacent skill.
- Do not use this skill when the user already has a fixed plan and only needs one asset or one mutation executed.
- Do not recommend every path at once just to avoid choosing.

## Required Inputs

- platform and campaign scope
- time window + budget or spend context
- key performance metrics or screenshots
- known recent changes
- timeline and owner constraints
- what success should look like after the first review window

## Deliverables

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- sequenced plan with timing
- what to do now / later / not yet
- success metrics and switch conditions
- metric guardrails or spend thresholds

## Workflow

1. Confirm the objective, timing, and non-negotiable constraints before proposing paths.
2. Normalize the current state into a short evidence table and identify the main constraint that limits speed.
3. Choose the first path, the second path, and the explicit things to delay rather than spraying effort everywhere.
4. Turn the path choice into a short execution plan with owners, timing, and a stop / switch rule.
5. End with measurable success criteria and the earliest point to review / pivot the plan.
6. Keep traffic quality, tracking integrity, and budget efficiency separate instead of collapsing them into one verdict.

## Output Format

1. Conclusion / verdict
2. Key evidence or context table
3. Priority actions or draft output
4. Risks / caveats / missing data
5. Recommended next steps

- Show what to do now, what to delay, and what signal should trigger a plan change.

## Boundary and Routing

- Use this skill for campaign structure, budget shape, milestones, and channel sequencing.
- Route to `cold-start-path` when the first question is which path to try first for a new / weak offer.
- Route to `ad-creative-brief-generator` when the strategy is chosen and the remaining job is creative briefing.

## Quality Rules

- Separate observed facts, user-provided facts, and assumptions.
- Do not invent exact numbers, specs, claims, certifications, or outcomes that were not provided or verified.
- Prefer the shortest useful answer shape that an operator can actually hand off.
- Choose a first path; avoid giving five equal-priority options just to stay safe.
- Tie each recommendation to a review window and an operator owner.

## Missing Data Protocol

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (spend context, metric baseline, or tracking state), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

## Validation Loop

- Recheck: CTR / CVR / CPA / ROAS or attribution integrity.
- Review window: after the first sprint / launch checkpoint.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

## Template Use

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.

## Success Metrics

- primary efficiency metric improves without spend quality collapsing
- tracking / attribution variance narrows
- one losing action is paused or fixed within the review window

## Budget and Timeline Logic

- Show the budget split by lane and the reason each lane earns budget now.
- Include milestone dates, owner checkpoints, and what gets cut first if the timeline slips.

## Example

**Scenario:** 男士理容品牌，父亲节大促，预算$5,000，目标600单，上线渠道：Meta广告+TikTok达人+邮件SMS，品牌有10万邮件用户，平均客单价$42，活动周期2周（6月8日-6月22日）。

**Expected response shape:**
- Start with the conclusion or verdict.
- Show the evidence or assumptions used.
- Give the operator-ready actions or draft output.
- End with risks and next steps.
