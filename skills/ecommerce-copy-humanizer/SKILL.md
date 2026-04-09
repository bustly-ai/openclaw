---
name: "Copy Humanizer"
description: >-
  Humanize ecommerce copy in English, French, Indonesian, Thai, Vietnamese, or
  Chinese so it sounds native, less AI-generated, and still conversion-ready.
  Use for product pages, ad copy, seller replies, live scripts, and ecommerce
  captions when the team needs copy-ready output rather than loose
  brainstorming.
status: enabled
layer: ecommerce
sub_layer: content
---
# Copy Humanizer

Make ecommerce copy sound more human, more local, and less obviously AI-generated without losing selling intent.

## Language support

This skill supports:

- English: `references/en.md`
- French: `references/fr.md`
- Indonesian: `references/id.md`
- Thai: `references/th.md`
- Vietnamese: `references/vn.md`
- Chinese: `references/zh.md`

If the target language is missing or ambiguous, ask once before rewriting. Do not guess between languages that require different local phrasing.

## Solves

- Copy sounds robotic, templated, or machine-written.
- The wording feels translated, over-polished, or not native to ecommerce usage.
- Humanizing the copy often weakens the offer, loses proof, or creates claim risk.

Goal:
**Return copy that feels native to the target market while preserving proof direction, CTA intent, and safer wording.**

## Use when

- Product page copy needs to sound more natural
- Ad copy feels too templated or AI-written
- Seller replies or customer replies need a more human tone
- Ecommerce captions or live selling scripts need less robotic phrasing

## Do not use for

- Translation between languages
- Legal, medical, or regulated compliance review
- Long-form brand storytelling unrelated to ecommerce conversion
- Claim invention or exaggerated benefit creation

## Required inputs

- Original copy or source points
- Target language
- Platform or channel
- Audience
- Tone preference
- Compliance boundaries or banned wording
- Any proof, claim, or CTA that must be preserved

## Workflow

1. Confirm the target language, channel, audience, proof, and format guardrails.
2. Load the matching language note from `references/*.md` and apply its tone rules before drafting.
3. Distill the source into must-say points, do-not-say constraints, and proof limits.
4. Rewrite in the target structure first, then fill the draft instead of free-writing.
5. Run a QA pass for AI-tone patterns, claim safety, formatting, and missing proof.
6. Return the usable draft first, then list risk-safe swaps and what still needs verification.

## Output

1. AI-tone issues
2. Rewritten version (main)
3. Alternative version
4. Risk-safe wording swaps
5. Usage note by context

## Quality rules

- Separate observed facts, user-provided facts, and assumptions.
- Do not invent exact numbers, specs, claims, certifications, or outcomes.
- Keep hook, proof, CTA, and format constraints explicit rather than implied.
- If proof is missing, downgrade the claim instead of fabricating supporting language.
- Sound native to the target market, not just grammatically correct.

## Missing Data Protocol

- Ask for the smallest missing set that would materially change the rewrite.
- If the core blocker is missing, stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist mode and label assumptions.
- End low-confidence outputs with the single most valuable next data request.

## Validation Loop

- Recheck: publish quality, CTA clarity, and reuse readiness.
- Review window: after review, publish, or first usage in production.
- Define what improvement, no-change, and failure look like before closing the task.
- If market validation is missing, label that downgrade instead of hiding uncertainty.

## Resource

See `references/output-template.md`.
