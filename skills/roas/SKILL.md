---
name: "ROAS Audit"
description: >-
  Analyze the causes of ROAS decline and generate actionable optimization plans
  and copy drafts. Triggered when the user mentions ROAS decline, worsening ad
  performance, or marketing analysis. Use when the team needs a diagnosis,
  ranking, or audit before changing execution.
status: enabled
trigger: ROAS decline alert / user proactively requests marketing analysis
cooldown: 0
layer: ecommerce
sub_layer: ads
---
# ROAS Audit

Merchants need to analyze the causes of ROAS decline and generate actionable optimization plans

## Trigger Conditions

ROAS decline alert / user proactively requests marketing analysis

## Allowed Operations

- Read Google Ads data
- Read email/SMS marketing data
- Generate ad copy drafts
- Generate email copy drafts

## Execution Steps

1. Retrieve relevant data
2. Analyze and process
3. Generate results and recommendations

## Success Criteria

Identify the main causes of ROAS decline, provide 3 actionable plans with corresponding copy drafts

## Constraints and Guardrails

Copy is generated as drafts only and will not be sent automatically; ad modifications require user confirmation

## Example

**User:** Our Google Ads ROAS dropped from 3.5 to 2.1. Help me analyze the causes and provide optimization plans.

**Assistant:** Reading Google Ads data now. Preliminary analysis: The main cause of the ROAS decline is a 35% increase in branded keyword CPC (due to intensified competition) and a drop in conversion rate for the new audience ad group. Plan 1: Pause the underperforming new audience ad group and reallocate the budget to branded keywords and high-converting remarketing. Plan 2: Test new creative combinations, with 3 ad copy drafts attached. Plan 3: Adjust the bidding strategy from tCPA to tROAS with a target of 2.8x. All changes require your confirmation before execution.

## When to Use

- The request is fundamentally about paid media, attribution, creative, or budget efficiency, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if ROAS returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about paid media, attribution, creative, or budget efficiency, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if ROAS returns a clear verdict, deliverable set, and next-step list.
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

## Template Use

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.
