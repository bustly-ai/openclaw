---
name: "Review Analysis"
description: >-
  Analyze customer reviews, complaints, and feedback to find patterns, root
  causes, and action priorities. Use when summarizing reviews for products or
  services, clustering repeat complaints, extracting product
  strengths/weaknesses, identifying refund drivers, or turning messy feedback
  into a concise decision-ready report.
status: enabled
layer: ecommerce
sub_layer: customers
---
# Review Analysis

Turn messy feedback into a short decision memo.

## Workflow

1. Define the decision question, review window, and the one KPI or business signal that matters most.
2. Normalize the evidence into a compact table so facts, assumptions, and missing fields are separated.
3. Rank the gaps or options by business impact, reversibility, and confidence.
4. Convert the diagnosis into P0 / P1 / P2 actions tied to evidence, not generic best practices.
5. End with a validation loop so the operator knows exactly how to recheck if the fix worked.
6. Separate product issue, expectation issue, policy issue, and service issue before recommending a response.

1. Define the decision question, review window, and the one KPI or business signal that matters most.
2. Normalize the evidence into a compact table so facts, assumptions, and missing fields are separated.
3. Rank the gaps or options by business impact, reversibility, and confidence.
4. Convert the diagnosis into P0 / P1 / P2 actions tied to evidence, not generic best practices.
5. End with a validation loop so the operator knows exactly how to recheck if the fix worked.
6. Separate product issue, expectation issue, policy issue, and service issue before recommending a response.

1. Define the review set.
   - marketplace reviews
   - app reviews
   - support complaints
   - refund / return notes

2. Group the feedback.
   - product quality
   - expectation mismatch
   - shipping / service
   - feature gaps
   - trust / claim issues

3. Identify patterns.
   - frequency
   - severity
   - likely root cause
   - whether the issue belongs to product, content, offer, or operations

4. Recommend actions.
   - fix now
   - monitor
   - rewrite messaging
   - escalate to product / ops

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

Return:
- top patterns
- evidence snippets
- likely root cause
- severity / urgency
- recommended actions

## Quality bar

- Separate loud anecdotes from repeat patterns.
- Keep evidence snippets short and representative.
- Distinguish product issues from expectation-setting issues.
- Avoid over-claiming root cause certainty.

## Resources

Read `references/output-template.md` for the standard report layout.

## Example

**User:** Analyze these 150 Amazon reviews for our yoga mat and tell me the top complaints.

**Assistant:** Top patterns from 150 reviews: (1) "Slippery when wet" -- 28 mentions, severity HIGH, root cause: material surface coating, recommend: add "not for hot yoga" to listing or source a different top layer; (2) "Chemical smell on arrival" -- 19 mentions, severity MEDIUM, root cause: off-gassing from packaging, recommend: add 24-hour airing instruction to product insert; (3) "Thinner than expected" -- 14 mentions, severity MEDIUM, root cause: listing says "thick" but no mm spec, recommend: add exact thickness to title and bullet points.

## Missing Data Protocol

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (sample size, timeframe, or source of feedback), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (sample size, timeframe, or source of feedback), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the minimum missing inputs needed to avoid misleading advice.
- If the user cannot provide them, switch to checklist or hypothesis mode and label assumptions clearly.
- Do not convert rough estimates, benchmarks, or ranges into measured facts.
- End low-confidence outputs with the single most valuable next data request.

## Validation Loop

- Recheck: reply quality / complaint share / refund rate / rating trend.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Recheck: reply quality / complaint share / refund rate / rating trend.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Name the 1-3 core metrics or checkpoints to recheck after action.
- Give a review window that matches the cadence of the work.
- Define what improvement, no-change, and failure look like so the operator can close the loop.
- If the user has no analytics access, provide a manual validation checkpoint instead.

## Confidence Thresholds

- Fewer than 20 reviews: treat as directional only.
- 20-99 reviews: identify patterns but avoid major product-change claims without corroboration.
- 100+ reviews or multiple sources: safe to recommend prioritized action if themes repeat clearly.

## When to Use

- The request is fundamentally about reviews, refunds, retention, subscriptions, or public reply workflows, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Review Analysis returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about reviews, refunds, retention, subscriptions, or public reply workflows, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Review Analysis returns a clear verdict, deliverable set, and next-step list.
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

- feedback source
- time window + sample size
- product / SKU scope
- desired decision
- baseline or benchmark expectation
- the evidence source to trust first

- feedback source
- time window + sample size
- product / SKU scope
- desired decision
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
- customer-facing or ops-facing response guidance

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- gap diagnosis or scorecard
- P0 / P1 / P2 action list
- confidence and evidence labels
- customer-facing or ops-facing response guidance

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
- Preserve useful positive signals, not only complaints or failure themes.

- Separate observed facts, user-provided facts, and assumptions.
- Do not invent exact numbers, specs, claims, certifications, or outcomes that were not provided or verified.
- Prefer the shortest useful answer shape that an operator can actually hand off.
- Do not over-generalize from one screenshot, one SKU, one creator, or one time window.
- Keep the top 3-5 actions only; backlog items belong in a secondary list.
- Preserve useful positive signals, not only complaints or failure themes.

## Template Use

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.
