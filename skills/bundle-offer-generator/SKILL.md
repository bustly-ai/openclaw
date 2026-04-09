---
name: "Bundle Offer Generator"
description: >-
  Generate ecommerce bundle ideas using product mix, margin logic, and customer
  intent. Use when teams want stronger offer packaging without random
  discounting.
status: enabled
layer: ecommerce
sub_layer: store-ops
---
# Bundle Offer Generator

A bundle isn't about forcing several products together — it's about combining purchase reasons to make them stronger.

## Problem It Solves

Many bundles fail to gain traction, usually because:
- They only offer a discount without a clearer purchase logic;
- The combo is cheaper, but users don't understand why they should buy them together;
- AOV goes up, but margin drops too much;
- Tier structure is unclear, adding decision burden instead of reducing it.

The goal of this skill is:
**Generate better-selling bundle plans based on product relationships, margin headroom, and user scenarios.**

## When to Use

- The request is fundamentally about listing, pricing, launch, or store-ops decisions, and the operator needs a copy-ready draft, reusable brief, or structured handoff output.
- The team could take action immediately if Bundle Offer Generator returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about listing, pricing, launch, or store-ops decisions, and the operator needs a copy-ready draft, reusable brief, or structured handoff output.
- The team could take action immediately if Bundle Offer Generator returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- Want to increase AOV;
- Have multiple related products but unsure how to combine them;
- Want to launch structured bundle offers during promotions instead of simply cutting prices.

## Input Requirements

- Product list and pricing
- Gross margin headroom
- Product pairing relationships / usage sequence
- Target audience and purchase scenarios
- Optional: discount boundaries, inventory constraints, platform restrictions

## Workflow

1. Confirm the audience, channel, proof, and format guardrails before drafting anything.
2. Distill the raw inputs into the exact angles, must-say points, and do-not-say constraints.
3. Build the output in the target structure first, then fill the details instead of free-writing.
4. Add the final draft plus a short QA pass for claims, formatting, and missing proof.
5. End with what still needs verification, who should review it, and what to ship next.
6. Separate traffic-quality issues from page / offer / catalog execution issues.

1. Confirm the audience, channel, proof, and format guardrails before drafting anything.
2. Distill the raw inputs into the exact angles, must-say points, and do-not-say constraints.
3. Build the output in the target structure first, then fill the details instead of free-writing.
4. Add the final draft plus a short QA pass for claims, formatting, and missing proof.
5. End with what still needs verification, who should review it, and what to ship next.
6. Separate traffic-quality issues from page / offer / catalog execution issues.

1. Identify natural pairing combinations.
2. Design tier levels: basic / advanced / high-value.
3. Check margin and discount headroom.
4. Output sellable naming and positioning recommendations.

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

1. Bundle plan list
2. Pricing logic
3. Margin risk alerts
4. Recommended use scenarios

## Quality Standards

- The bundle must have a clear purchase logic.
- Not just "how much cheaper it is," but also explain why buying together makes sense.
- Must not sacrifice too much margin.
- Output should be ready to use directly on product pages or campaign pages.

## Resources

Refer to `references/output-template.md`.

## Example

**User:** We have three products — shampoo, conditioner, and hair mask — and we want to create bundles to increase average order value. Help me design a bundle plan.

**Assistant:** I recommend three tiers: **Basic** "Daily Hair Care Combo" (Shampoo + Conditioner, save $5) — lowers the first-purchase barrier. **Advanced** "Deep Repair Set" (Shampoo + Conditioner + Hair Mask, save $12) — hero bundle with a natural usage sequence. **High-Value** "Annual Stock-Up Pack" (Advanced x3, save an extra $15) — locks in repeat customers. Pricing logic: Basic tier discount stays within 10% to protect margin; Advanced tier offers 15% off to drive conversion; Stock-Up pack adds a spend-threshold discount on top.

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

- page / listing / store scope
- traffic or business context
- primary KPI or pain signal
- hard constraints
- brand guardrails or forbidden claims
- any examples of acceptable output tone or format

- page / listing / store scope
- traffic or business context
- primary KPI or pain signal
- hard constraints
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
- page / listing / launch decision summary

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- copy-ready or operator-ready output
- QA checklist for claims / format
- handoff note for the next owner
- page / listing / launch decision summary

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
- If the core blocker is missing (page scope, KPI baseline, or traffic context), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (page scope, KPI baseline, or traffic context), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

## Validation Loop

- Recheck: primary conversion KPI / friction signal / launch blocker count.
- Review window: after review, publish, or first usage in production.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Recheck: primary conversion KPI / friction signal / launch blocker count.
- Review window: after review, publish, or first usage in production.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

## Template Use

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.
