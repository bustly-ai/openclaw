---
name: "Shopify Description Generator"
description: >-
  Generate Shopify-ready product descriptions from raw product facts, audience
  pain points, and proof. Use when teams need faster PDP copy drafting without
  sounding generic.
status: enabled
layer: ecommerce
sub_layer: store-ops
---
# Shopify Description Generator

Turn scattered selling points into Shopify product descriptions that are ready to publish, easy to read, and built to convert.

## Problem It Solves

The problem with many product page copies isn't a lack of words — it's that:
- They pile up specs without explaining why the customer should buy;
- The copy reads like AI-stitched filler — hollow and generic;
- Selling points are in a chaotic order with no clear focus;
- The CTA is too weak — the description ends without driving a purchase.

The goal of this skill is to:
**Transform product facts, user pain points, evidence, and tone requirements into a Shopify-ready product description.**

## When to Use

- The request is fundamentally about scripts, briefs, video/image production, or source-to-content workflows, and the operator needs a copy-ready draft, reusable brief, or structured handoff output.
- The team could take action immediately if Shopify Product Description Generator returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about scripts, briefs, video/image production, or source-to-content workflows, and the operator needs a copy-ready draft, reusable brief, or structured handoff output.
- The team could take action immediately if Shopify Product Description Generator returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- Launching a new product and need to quickly draft a PDP description;
- An existing product has mediocre conversion and needs a rewritten description structure;
- Creating multiple angle versions of the same product for A/B testing.

## Input Requirements

- Product name and core use case
- Target audience / purchase scenario
- Core selling points and differentiators
- Evidence (materials, features, tests, reviews, data)
- Claim boundaries — what must not be exaggerated
- Tone preference (direct, gentle, professional, aspirational, etc.)

## Workflow

1. Confirm the audience, channel, proof, and format guardrails before drafting anything.
2. Distill the raw inputs into the exact angles, must-say points, and do-not-say constraints.
3. Build the output in the target structure first, then fill the details instead of free-writing.
4. Add the final draft plus a short QA pass for claims, formatting, and missing proof.
5. End with what still needs verification, who should review it, and what to ship next.
6. Keep source extraction, creative logic, and output polish in separate passes.

1. Confirm the audience, channel, proof, and format guardrails before drafting anything.
2. Distill the raw inputs into the exact angles, must-say points, and do-not-say constraints.
3. Build the output in the target structure first, then fill the details instead of free-writing.
4. Add the final draft plus a short QA pass for claims, formatting, and missing proof.
5. End with what still needs verification, who should review it, and what to ship next.
6. Keep source extraction, creative logic, and output polish in separate passes.

1. Distill the core reason a customer would buy this product.
2. Rewrite factual selling points into benefit-led expressions.
3. Organize the description structure: opening, selling-point modules, use scenarios, CTA.
4. Flag risky claims that require cautious wording.
5. Output a final version ready to paste directly into Shopify.

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

1. Main product description version
2. Selling point breakdown
3. CTA recommendations
4. Risk Warnings / Items Requiring Manual Review

## Quality Standards

- Lead with user benefits, then product specs.
- Use specific language; avoid vague or boilerplate phrases.
- Do not make unsubstantiated efficacy claims.
- Output should be ready to paste directly into the Shopify editor.

## Resources

Refer to `references/output-template.md`.

## Example

**User:** Write a Shopify product description for a bamboo fiber bath towel. The target audience is eco-conscious young families. Key selling points: super absorbent, antibacterial, and biodegradable.

**Assistant:** Main product description: "Say goodbye to chemical-smelling towels — give your family a truly clean touch. This bamboo fiber bath towel is naturally antibacterial, absorbs 3× more water than ordinary cotton towels, and is fully biodegradable, leaving no burden on the planet. Soft and skin-friendly, it's safe even for babies." Selling point breakdown: (1) Super absorbent → One towel is all you need after a shower; (2) Naturally antibacterial → No worries about mildew from slow drying; (3) Biodegradable → The choice for eco-friendly families. CTA: "Order now and start a cleaner daily routine." Risk warning: "Antibacterial" should be noted as a natural property of the material and must not imply medical-grade sterilization.

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

- source material or product facts
- target channel
- audience + CTA
- format constraints
- brand guardrails or forbidden claims
- any examples of acceptable output tone or format

- source material or product facts
- target channel
- audience + CTA
- format constraints
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
- content-angle or asset-brief structure

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- copy-ready or operator-ready output
- QA checklist for claims / format
- handoff note for the next owner
- content-angle or asset-brief structure

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
- Keep hook, proof, CTA, and format constraints explicit rather than implied.

- Separate observed facts, user-provided facts, and assumptions.
- Do not invent exact numbers, specs, claims, certifications, or outcomes that were not provided or verified.
- Prefer the shortest useful answer shape that an operator can actually hand off.
- Make the draft copy-ready or handoff-ready; do not stop at abstract principles.
- If proof is missing, downgrade the claim instead of fabricating supporting language.
- Keep hook, proof, CTA, and format constraints explicit rather than implied.

## Missing Data Protocol

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (source asset, product facts, or channel format constraints), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (source asset, product facts, or channel format constraints), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

## Validation Loop

- Recheck: publish quality / engagement proxy / CTA completion / reuse readiness.
- Review window: after review, publish, or first usage in production.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Recheck: publish quality / engagement proxy / CTA completion / reuse readiness.
- Review window: after review, publish, or first usage in production.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

## Success Metrics

- the draft is immediately reusable by the next owner
- proof and CTA are explicit
- format risk or compliance risk is flagged before publish

- the draft is immediately reusable by the next owner
- proof and CTA are explicit
- format risk or compliance risk is flagged before publish

- the draft is immediately reusable by the next owner
- proof and CTA are explicit
- format risk or compliance risk is flagged before publish

- the draft is immediately reusable by the next owner
- proof and CTA are explicit
- format risk or compliance risk is flagged before publish

## Template Use

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.
