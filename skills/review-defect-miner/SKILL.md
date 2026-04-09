---
name: "Review Defect Miner"
description: >-
  Extract and cluster defect signals from ecommerce reviews and social feedback
  into actionable quality and fix priorities ranked by severity, frequency, and
  conversion impact. Use when the team needs a diagnosis, ranking, or audit
  before changing execution.
status: enabled
layer: ecommerce
sub_layer: customers
---
# Review Defect Miner

## Skill Card

- **Category:** Voice of Customer
- **Core problem:** What product defects and dissatisfaction patterns are hidden in reviews/comments?
- **Best for:** Product and content teams diagnosing quality gaps
- **Expected input:** Low-star reviews, comments, support tickets, return notes
- **Expected output:** Defect clusters by severity, frequency, and fix priority with evidence snippets
- **Creatop handoff:** Convert top defect clusters into product fixes + expectation-setting scripts

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

1. Normalize raw review/comment text and tag source + date + star level.
2. Detect defect themes (quality, packaging, expectation mismatch, delivery, usability).
3. Score each theme by severity, frequency, and conversion impact risk.
4. Output top fix backlog and messaging mitigations.

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
1. Executive summary (max 5 lines)
2. Priority actions (P0/P1/P2)
3. Evidence table (signal, confidence, risk)
4. 7-day execution plan

## Quality and safety rules

- Preserve original evidence snippets for traceability.
- Separate quality defects from logistics/service issues.
- Do not over-generalize from tiny sample sizes.

## License

Copyright (c) 2026 **Razestar**.

This skill is provided under **CC BY-NC-SA 4.0** for non-commercial use.
You may reuse and adapt it with attribution to Razestar, and share derivatives
under the same license.

Commercial use requires a separate paid commercial license from **Razestar**.
No trademark rights are granted.

## Example

**User:** Mine defect signals from our 1-star and 2-star reviews for the wireless earbuds (200 reviews attached).

**Assistant:** Defect clusters identified: (1) P0 -- "Left earbud stops charging" -- 42 mentions, high severity, likely hardware defect in charging pin alignment, fix: escalate to manufacturer; (2) P1 -- "Falls out during exercise" -- 31 mentions, medium severity, ear tip sizing issue, fix: include 3 extra tip sizes and update fit guide; (3) P2 -- "Bluetooth disconnects at 10ft" -- 18 mentions, medium severity, antenna range below spec, fix: add "best within 8ft" to product description to set expectations. 7-day plan: contact manufacturer about charging defect (Day 1-2), ship updated ear tips for next batch (Day 3-5), revise listing copy (Day 6-7).

- Trigger condition: 

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

## Safety Escalation Rules

- Immediately escalate child-safety, food-safety, electrical, skin-reaction, or choking-related signals even if frequency is low.
- Keep safety-critical defects separate from convenience complaints.
- When in doubt, recommend manual QA review before public claim changes or continued scale.

## When to Use

- The request is fundamentally about reviews, refunds, retention, subscriptions, or public reply workflows, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Review Defect Miner returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about reviews, refunds, retention, subscriptions, or public reply workflows, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Review Defect Miner returns a clear verdict, deliverable set, and next-step list.
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

## Success Metrics

- the targeted complaint or refund theme declines
- public-facing replies become reusable and lower confusion
- positive themes are preserved in messaging

- the targeted complaint or refund theme declines
- public-facing replies become reusable and lower confusion
- positive themes are preserved in messaging

- the targeted complaint or refund theme declines
- public-facing replies become reusable and lower confusion
- positive themes are preserved in messaging

- the targeted complaint or refund theme declines
- public-facing replies become reusable and lower confusion
- positive themes are preserved in messaging

## Template Use

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.
