---
name: "Shopify Tracking Audit"
description: >-
  Audit Shopify tracking integrity across UTM, pixel, CAPI, accelerated
  checkout, and post-purchase events to detect attribution leaks and produce a
  prioritized fix plan. Use when Pixel, CAPI, Shop Pay, Apple Pay, or
  attribution accuracy is in question.
status: enabled
layer: ecommerce
sub_layer: store-ops
---
# Shopify Tracking Audit

## Skill Card

- **Category:** Measurement
- **Core problem:** Where is tracking broken across ad click to purchase flow?
- **Best for:** Performance teams debugging attribution leaks
- **Expected input:** Event samples, pixel/CAPI config notes, UTM examples, checkout flow map
- **Expected output:** Tracking gap audit with severity, suspected cause, and fix checklist
- **Creatop handoff:** Apply fixes then rerun attribution review with creator-attribution-lite

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

1. Map funnel events from click -> landing -> add-to-cart -> checkout -> purchase.
2. Validate event naming consistency, deduplication, and timestamp continuity.
3. Identify drop-off points where measurement is missing or unreliable.
4. Produce a fix plan ordered by measurement impact.

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

- Distinguish data collection failures from real performance changes.
- Keep findings tied to concrete event evidence.
- Mark assumptions when full logs are unavailable.

## License

Copyright (c) 2026 **Razestar**.

This skill is provided under **CC BY-NC-SA 4.0** for non-commercial use.
You may reuse and adapt it with attribution to Razestar, and share derivatives
under the same license.

Commercial use requires a separate paid commercial license from **Razestar**.
No trademark rights are granted.

- Trigger condition: 

## Missing Data Protocol

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (spend context, metric baseline, or tracking state), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (spend context, metric baseline, or tracking state), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the minimum missing inputs needed to avoid misleading advice.
- If the user cannot provide them, switch to checklist or hypothesis mode and label assumptions clearly.
- Do not convert rough estimates, benchmarks, or ranges into measured facts.
- End low-confidence outputs with the single most valuable next data request.

## Validation Loop

- Recheck: CTR / CVR / CPA / ROAS or attribution integrity.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Recheck: CTR / CVR / CPA / ROAS or attribution integrity.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Name the 1-3 core metrics or checkpoints to recheck after action.
- Give a review window that matches the cadence of the work.
- Define what improvement, no-change, and failure look like so the operator can close the loop.
- If the user has no analytics access, provide a manual validation checkpoint instead.

## Fixed Shopify Check List

- Check pixel and CAPI deduplication across PDP, cart, checkout, and thank-you page.
- Check accelerated checkout paths such as Apple Pay, Google Pay, and Shop Pay separately.
- Verify UTM persistence through checkout and post-purchase apps.
- Re-run a test purchase after any fix before calling the issue resolved.

## When to Use

- The request is fundamentally about paid media, attribution, creative, or budget efficiency, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Shopify Tracking Auditor returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about paid media, attribution, creative, or budget efficiency, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Shopify Tracking Auditor returns a clear verdict, deliverable set, and next-step list.
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
