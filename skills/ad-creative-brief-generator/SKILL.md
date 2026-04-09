---
name: "Creative Brief Generator"
description: >-
  Turn campaign goals, product facts, audience context, and channel constraints
  into clearer ad creative briefs that teams or creators can actually execute.
  Use when performance teams need faster, less-chaotic creative direction.
status: enabled
layer: ecommerce
sub_layer: content
---
# Creative Brief Generator

Turn scattered campaign context into a clear ad creative brief that is easier to execute, review, and test.

## Solves

Creative teams often lose time because:
- campaign goals are vague;
- product facts and proof are not organized;
- messaging priorities are unclear;
- forbidden claims are missing;
- creators or designers receive direction that is too broad to execute.

Goal:
**Produce a brief that makes the ad direction clearer, tighter, and more testable.**

## Use when

- A performance team needs a cleaner brief for new ad creatives
- A creator or UGC team needs direction before production
- A product has multiple selling points and the brief feels messy
- Teams want stronger alignment between growth, creative, and compliance

## Inputs

- Product facts
- Target audience
- Campaign goal
- Offer angle
- Channel or format constraints
- Proof points
- Forbidden claims or compliance boundaries

## Workflow

1. Confirm the audience, channel, proof, and format guardrails before drafting anything.
2. Distill the raw inputs into the exact angles, must-say points, and do-not-say constraints.
3. Build the output in the target structure first, then fill the details instead of free-writing.
4. Add the final draft plus a short QA pass for claims, formatting, and missing proof.
5. End with what still needs verification, who should review it, and what to ship next.
6. Keep traffic quality, tracking integrity, and budget efficiency separate instead of collapsing them into one verdict.

1. Confirm the audience, channel, proof, and format guardrails before drafting anything.
2. Distill the raw inputs into the exact angles, must-say points, and do-not-say constraints.
3. Build the output in the target structure first, then fill the details instead of free-writing.
4. Add the final draft plus a short QA pass for claims, formatting, and missing proof.
5. End with what still needs verification, who should review it, and what to ship next.
6. Keep traffic quality, tracking integrity, and budget efficiency separate instead of collapsing them into one verdict.

1. Clarify the campaign objective and audience.
2. Distill the strongest angle and message hierarchy.
3. Define hooks, proof direction, and CTA logic.
4. Add execution guardrails and risk notes.
5. Format the result as a usable creative brief.

## Output

1. Campaign objective summary
2. Core angle and message hierarchy
3. Hook / scene / proof guidance
4. CTA and offer note
5. Guardrails and risk notes

## Quality bar

- The brief should be specific enough to execute.
- The angle should be commercially clear, not generic.
- The output should reduce creative ambiguity, not add more words.
- Risk boundaries should be explicit when claims are sensitive.

## Resource

See `references/output-template.md`.

## Example

**User:** I need a creative brief for a TikTok UGC campaign promoting our new collagen powder. Target is women 25-40, budget is $5K, and we can't claim it "reverses aging."

**Assistant:** Here's your brief: **Objective:** Drive trial purchases via TikTok creator content. **Core angle:** "Glow-up routine" -- position collagen as a daily wellness habit, not a cure. **Hook direction:** Before/after morning routine format. **CTA:** "Try my morning glow stack -- link in bio." **Guardrails:** No anti-aging cure claims; stick to "supports skin hydration" language per FTC guidelines.

## When to Use

- The request is fundamentally about paid media, attribution, creative, or budget efficiency, and the operator needs a copy-ready draft, reusable brief, or structured handoff output.
- The team could take action immediately if Ad Creative Brief Generator returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about paid media, attribution, creative, or budget efficiency, and the operator needs a copy-ready draft, reusable brief, or structured handoff output.
- The team could take action immediately if Ad Creative Brief Generator returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

## Do Not Use When

- Do not pretend a system mutation happened if the skill only has analysis or drafting context.
- Do not keep this skill active when the request clearly belongs to a narrower adjacent skill.
- Do not use this skill to invent product facts, legal claims, or performance data just to make the draft sound polished.
- Do not return vague brainstorm lists when a concrete output is required.

- Do not pretend a system mutation happened if the skill only has analysis or drafting context.
- Do not keep this skill active when the request clearly belongs to a narrower adjacent skill.
- Do not use this skill to invent product facts, legal claims, or performance data just to make the draft sound polished.
- Do not return vague brainstorm lists when a concrete output is required.

## Required Inputs

- platform and campaign scope
- time window + budget or spend context
- key performance metrics or screenshots
- known recent changes
- brand guardrails or forbidden claims
- any examples of acceptable output tone or format

- platform and campaign scope
- time window + budget or spend context
- key performance metrics or screenshots
- known recent changes
- brand guardrails or forbidden claims
- any examples of acceptable output tone or format

## Deliverables

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- copy-ready or operator-ready output
- QA checklist for claims / format
- handoff note for the next owner
- metric guardrails or spend thresholds

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- copy-ready or operator-ready output
- QA checklist for claims / format
- handoff note for the next owner
- metric guardrails or spend thresholds

## Output Format

1. Conclusion / verdict
2. Key evidence or context table
3. Priority actions or draft output
4. Risks / caveats / missing data
5. Recommended next steps

- Return the usable draft first, then a short QA checklist and any missing fact requests.

1. Conclusion / verdict
2. Key evidence or context table
3. Priority actions or draft output
4. Risks / caveats / missing data
5. Recommended next steps

- Return the usable draft first, then a short QA checklist and any missing fact requests.

## Boundary and Routing

- Keep this skill focused on draft output quality; route strategic diagnosis or system mutation to a narrower skill when needed.
- If the draft depends on missing proof, keep the claim conservative and ask for verification before publish.

- Keep this skill focused on draft output quality; route strategic diagnosis or system mutation to a narrower skill when needed.
- If the draft depends on missing proof, keep the claim conservative and ask for verification before publish.

## Quality Rules

- Separate observed facts, user-provided facts, and assumptions.
- Do not invent exact numbers, specs, claims, certifications, or outcomes that were not provided or verified.
- Prefer the shortest useful answer shape that an operator can actually hand off.
- Make the draft copy-ready or handoff-ready; do not stop at abstract principles.
- If proof is missing, downgrade the claim instead of fabricating supporting language.

- Separate observed facts, user-provided facts, and assumptions.
- Do not invent exact numbers, specs, claims, certifications, or outcomes that were not provided or verified.
- Prefer the shortest useful answer shape that an operator can actually hand off.
- Make the draft copy-ready or handoff-ready; do not stop at abstract principles.
- If proof is missing, downgrade the claim instead of fabricating supporting language.

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
- Review window: after review, publish, or first usage in production.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Recheck: CTR / CVR / CPA / ROAS or attribution integrity.
- Review window: after review, publish, or first usage in production.
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
