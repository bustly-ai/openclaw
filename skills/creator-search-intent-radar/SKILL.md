---
name: "Creator Search Radar"
description: >-
  Convert TikTok/YouTube/Instagram search and trend signals into a prioritized
  weekly content backlog with script angles and hook directions. Use when the
  user asks what to post next, wants trend-based topic discovery, needs
  search-intent analysis, or wants a platform-by-platform content idea pipeline.
status: enabled
layer: ecommerce
sub_layer: content
---
# Creator Search Radar

## Skill Card

- **Category:** Market Intelligence
- **Core problem:** What should we post next with real demand signals?
- **Best for:** Weekly planning and topic prioritization
- **Expected input:** TikTok/YouTube/Instagram trend snippets, search hints, comments/DM FAQs
- **Expected output:** Ranked topic backlog + platform fit + hook directions + CTA
- **Creatop handoff:** Send top 3 topics into Creatop script workflow

## Overview

Turn noisy trend inputs into **ranked, publishable decisions**.

Priority order:
1) demand signal quality
2) audience fit
3) monetization fit
4) execution speed

## Workflow

1. Define the decision question, review window, and the one KPI or business signal that matters most.
2. Normalize the evidence into a compact table so facts, assumptions, and missing fields are separated.
3. Rank the gaps or options by business impact, reversibility, and confidence.
4. Convert the diagnosis into P0 / P1 / P2 actions tied to evidence, not generic best practices.
5. End with a validation loop so the operator knows exactly how to recheck if the fix worked.
6. Separate creator fit, creator operations, and creator economics rather than mixing them into one fuzzy score.

1. Define the decision question, review window, and the one KPI or business signal that matters most.
2. Normalize the evidence into a compact table so facts, assumptions, and missing fields are separated.
3. Rank the gaps or options by business impact, reversibility, and confidence.
4. Convert the diagnosis into P0 / P1 / P2 actions tied to evidence, not generic best practices.
5. End with a validation loop so the operator knows exactly how to recheck if the fix worked.
6. Separate creator fit, creator operations, and creator economics rather than mixing them into one fuzzy score.

### 1) Collect demand signals

Gather 10–30 candidate signals from:
- TikTok search/trend surfaces
- YouTube search/autosuggest
- Instagram/Reels momentum
- comments/DM FAQs/community threads

Record provenance for each signal:
- `source_type` (official/community/internal)
- `source_link` (if available)
- `captured_at`
- `confidence` (high/medium/low)

If live endpoints are unavailable, run **fallback mode** using recent internal patterns and clearly label output as `mode: fallback`.

### 2) Normalize and dedupe backlog

For each topic, standardize:
- `topic`
- `platform_fit` (TikTok / YouTube / Instagram)
- `intent_type` (learn / compare / buy / troubleshoot / inspiration)
- `freshness` (hot / warm / evergreen)
- `audience_fit` (1–5)
- `monetization_fit` (1–5)
- `difficulty` (1–5)

Merge near-duplicate topics before scoring.

### 3) Score and rank

Use:

`priority_score = (audience_fit * 0.35) + (freshness_score * 0.25) + (monetization_fit * 0.25) + (execution_speed * 0.15)`

Mapping:
- `freshness_score`: hot=5, warm=3, evergreen=2
- `execution_speed = 6 - difficulty`

### 4) Generate decision output

Return:
1. Top 10 ranked topics
2. Per topic: 1 content angle + 3 hook directions + CTA
3. 7-day lightweight schedule

Include `data_confidence` for each topic (high/medium/low).

## Output Format

1. Conclusion / verdict
2. Key evidence or context table
3. Priority actions or draft output
4. Risks / caveats / missing data
5. Recommended next steps

- Label each major claim with confidence: high / medium / low.

1. Conclusion / verdict
2. Key evidence or context table
3. Priority actions or draft output
4. Risks / caveats / missing data
5. Recommended next steps

- Label each major claim with confidence: high / medium / low.

- Topic:
- Why now:
- Platform:
- Intent:
- Angle:
- Hook directions (3):
- CTA:
- Confidence:

## Quality and safety rules

- Do not present synthetic/internal signals as live external trends.
- Avoid generic topics without clear buyer intent.
- Keep recommendations executable by small creator teams.
## License

Copyright (c) 2026 **Razestar**.

This skill is provided under **CC BY-NC-SA 4.0** for non-commercial use.
You may reuse and adapt it with attribution to Razestar, and share derivatives
under the same license.

Commercial use requires a separate paid commercial license from **Razestar**.
No trademark rights are granted.

## Example

**User:** What should we post this week on TikTok for our portable blender brand?

**Assistant:** Top 3 topics from search signals: (1) "protein shake recipes no cleanup" -- intent: learn, freshness: hot, hook: "I stopped washing blenders and here's why." (2) "portable blender vs shaker bottle" -- intent: compare, freshness: warm, hook: "I tested both for 30 days." (3) "gym bag essentials 2026" -- intent: inspiration, freshness: evergreen, hook: "The one thing missing from your gym bag." 7-day schedule and CTA suggestions included.

## When to Use

- The request is fundamentally about creator selection, briefing, outreach, performance, or deal operations, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Creator Search Intent Radar returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about creator selection, briefing, outreach, performance, or deal operations, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Creator Search Intent Radar returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

## Do Not Use When

- Do not pretend a system mutation happened if the skill only has analysis or drafting context.
- Do not keep this skill active when the request clearly belongs to a narrower adjacent skill.
- Do not use this skill for writing final production assets when the core need is execution or content generation.
- Do not over-claim trend certainty from one snapshot or one anecdote.

- Do not pretend a system mutation happened if the skill only has analysis or drafting context.
- Do not keep this skill active when the request clearly belongs to a narrower adjacent skill.
- Do not use this skill for writing final production assets when the core need is execution or content generation.
- Do not over-claim trend certainty from one snapshot or one anecdote.

## Required Inputs

- creator handle(s) or profile links
- product / offer + target buyer
- budget or commercial constraint
- known performance or content samples
- baseline or benchmark expectation
- the evidence source to trust first

- creator handle(s) or profile links
- product / offer + target buyer
- budget or commercial constraint
- known performance or content samples
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
- partner-fit or outreach / delivery guidance

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- gap diagnosis or scorecard
- P0 / P1 / P2 action list
- confidence and evidence labels
- partner-fit or outreach / delivery guidance

## Boundary and Routing

- Keep this skill focused on diagnosis and prioritization; route production copy, design, or API mutation work downstream.
- If the next step becomes commercial negotiation or execution, state the handoff point explicitly.

- Keep this skill focused on diagnosis and prioritization; route production copy, design, or API mutation work downstream.
- If the next step becomes commercial negotiation or execution, state the handoff point explicitly.

## Quality Rules

- Separate observed facts, user-provided facts, and assumptions.
- Do not invent exact numbers, specs, claims, certifications, or outcomes that were not provided or verified.
- Prefer the shortest useful answer shape that an operator can actually hand off.
- Do not over-generalize from one screenshot, one SKU, one creator, or one time window.
- Keep the top 3-5 actions only; backlog items belong in a secondary list.
- Separate audience fit from operational fit and from commercial fit.

- Separate observed facts, user-provided facts, and assumptions.
- Do not invent exact numbers, specs, claims, certifications, or outcomes that were not provided or verified.
- Prefer the shortest useful answer shape that an operator can actually hand off.
- Do not over-generalize from one screenshot, one SKU, one creator, or one time window.
- Keep the top 3-5 actions only; backlog items belong in a secondary list.
- Separate audience fit from operational fit and from commercial fit.

## Missing Data Protocol

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (product / offer context, budget, or creator evidence), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (product / offer context, budget, or creator evidence), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

## Validation Loop

- Recheck: reply rate / acceptance rate / content go-live / GMV proxy.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Recheck: reply rate / acceptance rate / content go-live / GMV proxy.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

## Success Metrics

- fewer low-fit creators are approved
- reply / acceptance / go-live quality improves
- a clear upgrade / hold / stop threshold exists

- fewer low-fit creators are approved
- reply / acceptance / go-live quality improves
- a clear upgrade / hold / stop threshold exists

- fewer low-fit creators are approved
- reply / acceptance / go-live quality improves
- a clear upgrade / hold / stop threshold exists

- fewer low-fit creators are approved
- reply / acceptance / go-live quality improves
- a clear upgrade / hold / stop threshold exists
