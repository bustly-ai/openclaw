---
name: "TikTok Claim Rewriter"
description: >-
  Rewrite risky TikTok product claims into safer and clearer language without
  losing persuasion. Use when scripts may trigger policy risk or overpromise
  concerns.
status: enabled
layer: ecommerce
sub_layer: content
---
# TikTok Claim Rewriter

## Skill Card

- **Category:** Risk & Compliance
- **Core problem:** High-risk claim language can cause policy issues and distribution loss.
- **Best for:** Teams doing pre-publish script checks.
- **Expected input:** Raw script, factual proof boundaries, forbidden phrases, audience.
- **Expected output:** Risk map + safer rewrites + alternative phrases.

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

1. Detect risky lines.
2. Explain risk type and severity.
3. Rewrite into safer but still persuasive lines.
4. Provide reusable alternatives.

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

1. Risky line map
2. Safer rewrites
3. Alternative phrase bank

## Quality and safety rules

- Preserve intent, lower policy risk.
- No fabricated evidence.
- Keep rewrites natural and conversion-aware.

## License

Copyright (c) 2026 **Razestar**.

This skill is provided under **CC BY-NC-SA 4.0** for non-commercial use.
You may reuse and adapt it with attribution to Razestar, and share derivatives
under the same license.

Commercial use requires a separate paid commercial license from **Razestar**.
No trademark rights are granted.

## Example

**User:** My TikTok script says "This serum will cure your acne in 3 days." Can you make it safer?

**Assistant:** That line is high-risk -- "cure" and a specific timeframe will likely trigger TikTok's health claims policy. Safer rewrites: (1) "This serum helped clear my skin in under a week" (personal testimony, softer timeline), (2) "I noticed a real difference after just a few days" (subjective, no medical claim). Both preserve the persuasion without promising a medical outcome.

## When to Use

- The request is fundamentally about scripts, briefs, video/image production, or source-to-content workflows, and the operator needs a copy-ready draft, reusable brief, or structured handoff output.
- The team could take action immediately if TikTok Claim Rewriter returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about scripts, briefs, video/image production, or source-to-content workflows, and the operator needs a copy-ready draft, reusable brief, or structured handoff output.
- The team could take action immediately if TikTok Claim Rewriter returns a clear verdict, deliverable set, and next-step list.
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

## Localization Notes

- If the workflow touches TikTok Shop, Meta, or marketplace messaging, specify whether the recommendation assumes China, SEA, US, or another market.
- Adjust disclosure language, payment expectations, and compliance phrasing by market instead of assuming one global default.
- If the user did not specify market, ask once and keep the draft conservative until that is known.

- If the workflow touches TikTok Shop, Meta, or marketplace messaging, specify whether the recommendation assumes China, SEA, US, or another market.
- Adjust disclosure language, payment expectations, and compliance phrasing by market instead of assuming one global default.
- If the user did not specify market, ask once and keep the draft conservative until that is known.

- If the workflow touches TikTok Shop, Meta, or marketplace messaging, specify whether the recommendation assumes China, SEA, US, or another market.
- Adjust disclosure language, payment expectations, and compliance phrasing by market instead of assuming one global default.
- If the user did not specify market, ask once and keep the draft conservative until that is known.

- If the workflow touches TikTok Shop, Meta, or marketplace messaging, specify whether the recommendation assumes China, SEA, US, or another market.
- Adjust disclosure language, payment expectations, and compliance phrasing by market instead of assuming one global default.
- If the user did not specify market, ask once and keep the draft conservative until that is known.

## Template Use

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.
