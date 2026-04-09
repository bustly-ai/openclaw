---
name: "Affiliate Offer Tester"
description: >-
  Test and rank affiliate offer angles before outreach or content production.
  Use when the user needs to compare multiple positioning angles for the same
  product and choose the one most likely to convert without overpromising.
status: enabled
layer: ecommerce
sub_layer: creators
---
# Affiliate Offer Tester

## Skill Card

- **Category:** Affiliate Conversion
- **Core problem:** Teams often choose one weak offer angle and waste creator cycles before finding what actually converts.
- **Best for:** TikTok Shop affiliates, creator operators, and ecommerce teams validating offer messaging before execution.
- **Expected input:** Product facts, audience segment, candidate angles, proof assets, constraints (price/shipping/policy), channel context.
- **Expected output:** Ranked angle shortlist with rationale, risk notes, and recommended next test order.
- **Not for:** Legal review, fabricated claim creation, or media-buying budget optimization.

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

1. Normalize inputs and remove duplicate angles.
2. Score each angle on relevance, clarity, proof strength, differentiation, and execution ease.
3. Flag claim risk and overpromise risk.
4. Rank top angles and assign confidence.
5. Output a compact next-test plan.

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
1. Input quality check
2. Angle score table
3. Top 3 recommended angles with rationale
4. Risk notes and wording cautions
5. Next test sequence

## Quality and safety rules

- Prefer practical conversion decisions over abstract strategy talk.
- Do not invent proof, shipping terms, or guaranteed results.
- If evidence is weak, lower confidence explicitly.
- Avoid manipulative urgency or misleading promises.

## License

Copyright (c) 2026 **Razestar**.

This skill is provided under **CC BY-NC-SA 4.0** for non-commercial use.
You may reuse and adapt it with attribution to Razestar, and share derivatives
under the same license.

Commercial use requires a separate paid commercial license from **Razestar**.
No trademark rights are granted.

## Example

**User:** I have 4 angles for our portable blender on TikTok Shop: "gym smoothie hack", "travel essential", "saves money vs Jamba Juice", and "meal prep shortcut". Which should we lead with?

**Assistant:** After scoring on relevance, proof strength, and differentiation: #1 "saves money vs Jamba Juice" (strongest proof -- easy price comparison, high clarity). #2 "gym smoothie hack" (strong audience fit, good demo potential). #3 "travel essential" (decent but harder to prove uniquely). #4 "meal prep shortcut" (too generic, low differentiation). Risk note: avoid specific savings claims without verified math. Recommended test order: lead with #1, layer in #2 for creator briefs.

## When to Use

- The request is fundamentally about creator selection, briefing, outreach, performance, or deal operations, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Affiliate Offer Angle Tester returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about creator selection, briefing, outreach, performance, or deal operations, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Affiliate Offer Angle Tester returns a clear verdict, deliverable set, and next-step list.
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
