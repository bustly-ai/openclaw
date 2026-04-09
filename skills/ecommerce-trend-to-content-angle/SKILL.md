---
name: "Trend Angle Planner"
description: >-
  Turn a trend, news item, creator signal, review pattern, or market observation
  into sharper ecommerce content angles that are timely, useful, and
  commercially relevant. Use when teams want better hooks without sounding
  forced or generic.
status: enabled
layer: ecommerce
sub_layer: content
---
# Trend Angle Planner

Translate a raw signal into clearer ecommerce content angles, hooks, and narrative directions.

## Solves

Teams often spot something interesting — a trend, headline, creator shift, comment pattern, or market signal — but struggle to turn it into content that is both timely and commercially useful.

Common problems:
- the signal is real, but the angle is vague;
- trend chasing creates generic content;
- hooks feel forced or disconnected from the product;
- teams generate ideas that are topical but not strategic.

Goal:
**Convert a raw signal into content angles that feel timely, relevant, and worth publishing.**

## Use when

- A team wants to turn a fresh trend into social or creator content
- A brand sees a pattern in reviews, comments, or customer behavior
- Operators need hook directions for X, TikTok, creator briefs, or email
- A market observation needs sharper editorial framing
- The user wants multiple angles from one source signal

## Do Not Use When

- Do not pretend a system mutation happened if the skill only has analysis or drafting context.
- Do not keep this skill active when the request clearly belongs to a narrower adjacent skill.
- Do not use this skill to invent product facts, legal claims, or performance data just to make the draft sound polished.
- Do not return vague brainstorm lists when a concrete output is required.

- Do not pretend a system mutation happened if the skill only has analysis or drafting context.
- Do not keep this skill active when the request clearly belongs to a narrower adjacent skill.
- Do not use this skill to invent product facts, legal claims, or performance data just to make the draft sound polished.
- Do not return vague brainstorm lists when a concrete output is required.

- There is no real signal, trend, or observation to work from
- The task is a finished long-form draft rather than angle generation
- The user only wants keyword research with no editorial angle

## Inputs

- Trend, headline, post, signal, or observation
- Product or brand context
- Target audience
- Channel: X, TikTok, landing page, email, creator brief, etc.
- Desired tone or angle style
- Any claims or compliance boundaries

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

1. Clarify what the underlying signal actually means.
2. Identify why the signal matters to the audience commercially or emotionally.
3. Generate angle directions rather than surface-level topic repeats.
4. Turn each angle into hooks, framing notes, and content uses.
5. Prioritize the angles most likely to feel timely and distinctive.

## Output

Return:
1. Signal interpretation
2. 3-7 content angles
3. Hook ideas for each angle
4. Best-fit channels or formats
5. Notes on risk, freshness, or overused framing

## Quality bar

- Angles should connect the trend to a real audience tension or opportunity.
- Avoid obvious rewrites of the same idea.
- Hooks should feel publishable, not brainstorming fluff.
- Keep the result commercially relevant for ecommerce teams.
- Prefer specific observations over empty trend language.

## Resource

See `references/output-template.md`.

## Example

**User:** There's a viral TikTok trend around "de-influencing" -- people telling followers NOT to buy overhyped products. How can our skincare brand turn this into content?

**Assistant:** Signal interpretation: audience trust in creator recommendations is shifting; authenticity signals now outperform hype. Angle 1: "3 products I'd actually re-buy" -- honest repurchase proof. Angle 2: "What I'd skip from our own line" -- radical transparency hook. Angle 3: "The $12 product that replaced my $60 one" -- value credibility play. Best-fit channels: TikTok (angle 1-2), email (angle 3). Risk note: avoid sounding performatively humble -- keep it grounded in real product data.

## When to Use

- The request is fundamentally about scripts, briefs, video/image production, or source-to-content workflows, and the operator needs a copy-ready draft, reusable brief, or structured handoff output.
- The team could take action immediately if Ecommerce Trend to Content Angle returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about scripts, briefs, video/image production, or source-to-content workflows, and the operator needs a copy-ready draft, reusable brief, or structured handoff output.
- The team could take action immediately if Ecommerce Trend to Content Angle returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

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
