---
name: "Event Readiness"
description: >-
  Check whether a seller is actually ready for a marketplace event, promo spike,
  or campaign window before traffic is pushed. Use when the user wants to know
  if inventory, pricing, creator support, content, service, and fulfillment are
  ready enough to participate without wasting the event.
status: enabled
layer: ecommerce
sub_layer: store-ops
---
# Event Readiness

Check readiness before the team burns an event with weak preparation.

## Skill Card

- **Category:** Operations
- **Core problem:** Are we ready enough to enter this event window?
- **Best for:** Marketplace promos, brand events, seasonal pushes, and campaign spikes
- **Expected input:** Event timing + hero SKUs + inventory + pricing + support readiness
- **Expected output:** Readiness verdict + gap list + must-fix priorities
- **Creatop handoff:** Push critical gaps into launch and campaign prep workflows

## Before you run

Ask the user to clarify:
- event type
- event date range
- hero products
- current inventory situation
- pricing plan
- creator / affiliate support
- content volume readiness
- customer support coverage
- fulfillment readiness

If the event is near and the inputs are incomplete, say so explicitly.

## Optional tools / APIs

Useful but not required:
- inventory export
- SKU list
- promo plan sheet
- creator list
- content calendar
- fulfillment SLA sheet
- Google Sheets / CSV

If the user has no exports, continue with checklist mode and mark blind spots.

## Workflow

1. Define the decision question, review window, and the one KPI or business signal that matters most.
2. Normalize the evidence into a compact table so facts, assumptions, and missing fields are separated.
3. Rank the gaps or options by business impact, reversibility, and confidence.
4. Convert the diagnosis into P0 / P1 / P2 actions tied to evidence, not generic best practices.
5. End with a validation loop so the operator knows exactly how to recheck if the fix worked.
6. Separate traffic-quality issues from page / offer / catalog execution issues.

1. Define the decision question, review window, and the one KPI or business signal that matters most.
2. Normalize the evidence into a compact table so facts, assumptions, and missing fields are separated.
3. Rank the gaps or options by business impact, reversibility, and confidence.
4. Convert the diagnosis into P0 / P1 / P2 actions tied to evidence, not generic best practices.
5. End with a validation loop so the operator knows exactly how to recheck if the fix worked.
6. Separate traffic-quality issues from page / offer / catalog execution issues.

1. Confirm the event scope.
2. Review readiness across six areas:
   - inventory
   - pricing
   - traffic support
   - content support
   - customer support
   - fulfillment
3. Flag critical gaps.
4. Decide:
   - ready
   - ready with fixes
   - not ready
5. Produce a must-fix sequence.

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
1. Readiness verdict
2. Critical gaps
3. Must-fix before launch
4. Nice-to-fix if time allows
5. Final go / no-go note

## Fallback mode

If the user only has partial information:
- run checklist mode
- call out unknowns as risk
- do not mark the event “ready” unless the critical path is reasonably covered

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

- Focus on launch failure points first.
- Distinguish critical gaps from nice-to-have polish.
- Do not confuse “some assets exist” with true event readiness.
- Keep the verdict decision-oriented.

## License

Copyright (c) 2026 **Razestar**.

This skill is provided under **CC BY-NC-SA 4.0** for non-commercial use.
You may reuse and adapt it with attribution to Razestar, and share derivatives
under the same license.

Commercial use requires a separate paid commercial license from **Razestar**.
No trademark rights are granted.

## Example

**User:** TikTok Shop is running a mega sale event in 5 days. Are we ready?

**Assistant:** Verdict: Ready with fixes. Critical gaps: (1) Hero SKU inventory covers only 3 days of projected demand -- restock or set quantity limits. (2) No creator content scheduled for the event window -- contact 2-3 creators for same-week posting. (3) Customer support coverage not extended for weekend surge. Must-fix before launch: inventory buffer and CS scheduling. Nice-to-fix: refresh PDP images for hero products. Go/no-go: proceed if inventory is secured within 48 hours.

## Missing Data Protocol

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (page scope, KPI baseline, or traffic context), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (page scope, KPI baseline, or traffic context), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the minimum missing inputs needed to avoid misleading advice.
- If the user cannot provide them, switch to checklist or hypothesis mode and label assumptions clearly.
- Do not convert rough estimates, benchmarks, or ranges into measured facts.
- End low-confidence outputs with the single most valuable next data request.

## Validation Loop

- Recheck: primary conversion KPI / friction signal / launch blocker count.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Recheck: primary conversion KPI / friction signal / launch blocker count.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Name the 1-3 core metrics or checkpoints to recheck after action.
- Give a review window that matches the cadence of the work.
- Define what improvement, no-change, and failure look like so the operator can close the loop.
- If the user has no analytics access, provide a manual validation checkpoint instead.

## Standard Event Checklist

- Blocker: hero SKU inventory, pricing accuracy, checkout health, fulfillment capacity.
- Warning: creator support, content calendar, support staffing, returns policy clarity.
- Advisory: live plan, event registration status, bonus merchandising, post-event retargeting plan.
- For TikTok Shop or marketplace events, check campaign enrollment and approval status explicitly.

## When to Use

- The request is fundamentally about listing, pricing, launch, or store-ops decisions, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Event Readiness returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about listing, pricing, launch, or store-ops decisions, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Event Readiness returns a clear verdict, deliverable set, and next-step list.
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

- page / listing / store scope
- traffic or business context
- primary KPI or pain signal
- hard constraints
- baseline or benchmark expectation
- the evidence source to trust first

- page / listing / store scope
- traffic or business context
- primary KPI or pain signal
- hard constraints
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
- page / listing / launch decision summary

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- gap diagnosis or scorecard
- P0 / P1 / P2 action list
- confidence and evidence labels
- page / listing / launch decision summary

## Boundary and Routing

- Keep this skill focused on diagnosis and prioritization; route production copy, design, or API mutation work downstream.
- If the next step becomes commercial negotiation or execution, state the handoff point explicitly.

- Keep this skill focused on diagnosis and prioritization; route production copy, design, or API mutation work downstream.
- If the next step becomes commercial negotiation or execution, state the handoff point explicitly.

## Success Metrics

- the operator knows the top 3-5 fixes
- the output distinguishes now / later / not yet
- one measurable KPI or gate is named for the next review

- the operator knows the top 3-5 fixes
- the output distinguishes now / later / not yet
- one measurable KPI or gate is named for the next review

- the operator knows the top 3-5 fixes
- the output distinguishes now / later / not yet
- one measurable KPI or gate is named for the next review

- the operator knows the top 3-5 fixes
- the output distinguishes now / later / not yet
- one measurable KPI or gate is named for the next review
