---
name: "Performance Marketer"
description: >-
  Publish and optimize paid ad campaigns across channels. Use when user mentions
  ad optimization, budget allocation, or performance marketing execution.
status: enabled
layer: ecommerce
sub_layer: ads
---
# Performance Marketer

## Overview

Publish and optimize paid ad campaigns across channels. Use when user mentions ad optimization, budget allocation, or performance marketing execution.

## When to Use

- The request is fundamentally about paid media, attribution, creative, or budget efficiency, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Performance Marketer returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

## Do Not Use When

- Do not pretend a system mutation happened if the skill only has analysis or drafting context.
- Do not keep this skill active when the request clearly belongs to a narrower adjacent skill.
- Do not use this skill for writing final production assets when the core need is execution or content generation.
- Do not over-claim trend certainty from one snapshot or one anecdote.

## Required Inputs

- platform and campaign scope
- time window + budget or spend context
- key performance metrics or screenshots
- known recent changes
- baseline or benchmark expectation
- the evidence source to trust first

## Deliverables

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- gap diagnosis or scorecard
- P0 / P1 / P2 action list
- confidence and evidence labels
- metric guardrails or spend thresholds

## Workflow

1. Define the decision question, review window, and the one KPI or business signal that matters most.
2. Normalize the evidence into a compact table so facts, assumptions, and missing fields are separated.
3. Rank the gaps or options by business impact, reversibility, and confidence.
4. Convert the diagnosis into P0 / P1 / P2 actions tied to evidence, not generic best practices.
5. End with a validation loop so the operator knows exactly how to recheck if the fix worked.
6. Keep traffic quality, tracking integrity, and budget efficiency separate instead of collapsing them into one verdict.

## Output Format

1. Conclusion / verdict
2. Key evidence or context table
3. Priority actions or draft output
4. Risks / caveats / missing data
5. Recommended next steps

- Label each major claim with confidence: high / medium / low.

## Boundary and Routing

- Use this skill for cross-channel paid-execution decisions after the objective and constraints are already clear.
- Route to `ads-analyst` for competitive research, to `ad-creative-analysis` for creative diagnosis, and to `growth-budget-reallocator` when the job is budget shifting only.

## Quality Rules

- Separate observed facts, user-provided facts, and assumptions.
- Do not invent exact numbers, specs, claims, certifications, or outcomes that were not provided or verified.
- Prefer the shortest useful answer shape that an operator can actually hand off.
- Do not over-generalize from one screenshot, one SKU, one creator, or one time window.
- Keep the top 3-5 actions only; backlog items belong in a secondary list.

## Missing Data Protocol

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (spend context, metric baseline, or tracking state), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

## Validation Loop

- Recheck: CTR / CVR / CPA / ROAS or attribution integrity.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

## Template Use

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.

## Success Metrics

- primary efficiency metric improves without spend quality collapsing
- tracking / attribution variance narrows
- one losing action is paused or fixed within the review window

## Budget Guardrails

- Tie every reallocation decision to budget, inventory, and margin guardrails instead of performance data alone.
- State the pause threshold and the scale threshold explicitly before recommending changes.

## Example

**Scenario:** 某美妆DTC品牌Facebook广告账户日耗$800，本周ROAS从3.2x跌至1.9x。共12个广告组，其中3个ROAS>3x、5个1.5-3x、4个<1.5x。需要在7天内将整体ROAS拉回2.5x+

**Expected response shape:**
- Start with the conclusion or verdict.
- Show the evidence or assumptions used.
- Give the operator-ready actions or draft output.
- End with risks and next steps.
