---
name: "GMV Max Check"
description: >-
  Check whether a GMV Max setup is usable, risky, or ineligible based on
  configuration choices, order volume, ROI handling, and conflicting modes. Use
  when the user wants to avoid setup mistakes, understand why performance is
  unstable, or verify whether compensation eligibility is likely preserved.
status: enabled
layer: ecommerce
sub_layer: ads
---
# GMV Max Check

Check the setup before the account burns money or loses eligibility.

## Skill Card

- **Category:** Ads Operations
- **Core problem:** Is this GMV Max setup safe and usable?
- **Best for:** New launches, troubleshooting, and compensation-risk checks
- **Expected input:** GMV Max settings + order volume + recent handling notes
- **Expected output:** Configuration verdict + risks + next-fix actions
- **Creatop handoff:** Pass output into ad setup and troubleshooting workflows

## Before you run

Ask the user to clarify:
- current GMV Max objective / target
- whether ROI target was manually changed
- whether max delivery, promo mode, or creative boost is enabled
- daily order volume
- whether this is a new or mature item
- whether recent instability is the main issue

If the user does not know the settings, ask for screenshots or exported setup fields first.

## Optional tools / APIs

Useful but not required:
- ad account export
- campaign settings screenshots
- daily orders sheet
- ROI / spend export

If no API is connected, use screenshot or manual-input mode.

## Workflow

1. Define the decision question, review window, and the one KPI or business signal that matters most.
2. Normalize the evidence into a compact table so facts, assumptions, and missing fields are separated.
3. Rank the gaps or options by business impact, reversibility, and confidence.
4. Convert the diagnosis into P0 / P1 / P2 actions tied to evidence, not generic best practices.
5. End with a validation loop so the operator knows exactly how to recheck if the fix worked.
6. Keep traffic quality, tracking integrity, and budget efficiency separate instead of collapsing them into one verdict.

1. Define the decision question, review window, and the one KPI or business signal that matters most.
2. Normalize the evidence into a compact table so facts, assumptions, and missing fields are separated.
3. Rank the gaps or options by business impact, reversibility, and confidence.
4. Convert the diagnosis into P0 / P1 / P2 actions tied to evidence, not generic best practices.
5. End with a validation loop so the operator knows exactly how to recheck if the fix worked.
6. Keep traffic quality, tracking integrity, and budget efficiency separate instead of collapsing them into one verdict.

1. Confirm the setup context.
2. Review the configuration against known risk checks.
3. Identify conflicting settings or compensation-risk conditions.
4. Decide whether the setup is:
   - usable
   - usable with risk
   - misconfigured
5. List the next fixes in priority order.

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

Return in this order:
1. Setup verdict
2. Main risk flags
3. Compensation-risk note
4. Priority fixes
5. What to monitor next

## Fallback mode

If the user only provides screenshots or rough settings:
- infer configuration as carefully as possible
- list assumptions explicitly
- avoid false certainty on compensation eligibility

## Quality Rules

- Separate observed facts, user-provided facts, and assumptions.
- Do not invent exact numbers, specs, claims, certifications, or outcomes that were not provided or verified.
- Prefer the shortest useful answer shape that an operator can actually hand off.
- Do not over-generalize from one screenshot, one SKU, one creator, or one time window.
- Keep the top 3-5 actions only; backlog items belong in a secondary list.

- Separate observed facts, user-provided facts, and assumptions.
- Do not invent exact numbers, specs, claims, certifications, or outcomes that were not provided or verified.
- Prefer the shortest useful answer shape that an operator can actually hand off.
- Do not over-generalize from one screenshot, one SKU, one creator, or one time window.
- Keep the top 3-5 actions only; backlog items belong in a secondary list.

- Do not invent platform guarantees.
- Separate performance problems from setup problems.
- Flag uncertainty when settings are incomplete.
- Prioritize configuration conflicts before creative advice.

## License

Copyright (c) 2026 **Razestar**.

This skill is provided under **CC BY-NC-SA 4.0** for non-commercial use.
You may reuse and adapt it with attribution to Razestar, and share derivatives
under the same license.

Commercial use requires a separate paid commercial license from **Razestar**.
No trademark rights are granted.

## Example

**User:** I just turned on GMV Max with max delivery mode and manually set ROI to 3.0. Daily orders are about 15. Is this setup safe?

**Assistant:** Setup verdict: **Usable with risk**. Risk flags: (1) Max delivery + manual ROI target conflict -- the system may overspend trying to hit volume while respecting your ROI floor. (2) 15 orders/day is below the stability threshold for GMV Max learning. Priority fix: remove max delivery mode and let the system auto-optimize. Monitor spend-to-order ratio daily for the next 7 days.

## When to Use

- The request is fundamentally about paid media, attribution, creative, or budget efficiency, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if GMV Max Check returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about paid media, attribution, creative, or budget efficiency, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if GMV Max Check returns a clear verdict, deliverable set, and next-step list.
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

- platform and campaign scope
- time window + budget or spend context
- key performance metrics or screenshots
- known recent changes
- baseline or benchmark expectation
- the evidence source to trust first

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

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- gap diagnosis or scorecard
- P0 / P1 / P2 action list
- confidence and evidence labels
- metric guardrails or spend thresholds

## Boundary and Routing

- Keep this skill focused on diagnosis and prioritization; route production copy, design, or API mutation work downstream.
- If the next step becomes commercial negotiation or execution, state the handoff point explicitly.

- Keep this skill focused on diagnosis and prioritization; route production copy, design, or API mutation work downstream.
- If the next step becomes commercial negotiation or execution, state the handoff point explicitly.

## Missing Data Protocol

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (spend context, metric baseline, or tracking state), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (spend context, metric baseline, or tracking state), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

## Validation Loop

- Recheck: CTR / CVR / CPA / ROAS or attribution integrity.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Recheck: CTR / CVR / CPA / ROAS or attribution integrity.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

## Success Metrics

- primary efficiency metric improves without spend quality collapsing
- tracking / attribution variance narrows
- one losing action is paused or fixed within the review window

- primary efficiency metric improves without spend quality collapsing
- tracking / attribution variance narrows
- one losing action is paused or fixed within the review window

- primary efficiency metric improves without spend quality collapsing
- tracking / attribution variance narrows
- one losing action is paused or fixed within the review window

- primary efficiency metric improves without spend quality collapsing
- tracking / attribution variance narrows
- one losing action is paused or fixed within the review window
