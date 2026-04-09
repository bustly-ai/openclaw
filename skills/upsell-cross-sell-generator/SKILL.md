---
name: "Upsell Cross Sell Generator"
description: >-
  Generate upsell and cross-sell ideas for ecommerce funnels based on product
  fit, timing, and margin logic. Use when teams want more relevant order
  expansion offers.
status: enabled
layer: ecommerce
sub_layer: store-ops
---
# Upsell Cross Sell Generator

Add-on selling isn't about pushing random products—it's about offering a smoother next step at the right moment.

## Problem Solved

Many upsell / cross-sell modules suffer from these issues:
- Recommendations appear random;
- Users are pushed to add on before they even understand the main product;
- Related products exist but aren't placed at the right stage of the buying journey;
- Average order value goes up, but conversion rate takes a hit.

The goal of this skill is:
**Generate more natural upsell / cross-sell strategies based on product relationships, purchase stage, and profit logic.**

## When to Use

- The request is fundamentally about listing, pricing, launch, or store-ops decisions, and the operator needs a copy-ready draft, reusable brief, or structured handoff output.
- The team could take action immediately if Upsell Cross Sell Generator returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about listing, pricing, launch, or store-ops decisions, and the operator needs a copy-ready draft, reusable brief, or structured handoff output.
- The team could take action immediately if Upsell Cross Sell Generator returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- Want to increase average order value;
- Want to optimize recommendation modules on PDP / cart / checkout / post-purchase;
- Want to reduce the sense of intrusion caused by irrelevant recommendations.

## Input Requirements

- Core product
- List of complementary products
- Price and margin information
- Current user stage (browsing / ordering / post-purchase)
- Optional: inventory, promotion rules, platform constraints

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

1. Determine which products are suitable for upsell and which for cross-sell.
2. Match recommendation placements to different stages.
3. Verify that each recommendation has a clear purchase rationale.
4. Output concise copy and placement suggestions.

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

1. Recommendation item list
2. Placement suggestions
3. Recommendation rationale
4. Risk notes

## Quality Standards

- Recommendations must have a clear relationship with the primary product.
- Placement suggestions should match the user's current stage in the journey.
- Recommendations should not come across as a hard sell.
- Output should be ready to plug directly into product pages or cart modules.

## Resources

Refer to `references/output-template.md`.

## Example

**User:** We sell yoga mats at an average order value of ¥128 and want to increase the add-to-cart rate. Any upsell / cross-sell suggestions?

**Assistant:** Recommended plan: (1) Upsell — Display a thicker yoga mat (¥168, +¥40) on the PDP page with the rationale "upgrade your experience"; (2) Cross-sell — After adding to cart, recommend a yoga block + strap set (¥39) with the copy "works even better when used together"; (3) Post-purchase — Recommend a yoga bag (¥58) on the order confirmation page with the copy "a must-have for practicing on the go." Each recommendation is aligned with the corresponding purchase stage, avoiding hard-sell tactics while the user is still browsing.

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

## Template Use

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.
