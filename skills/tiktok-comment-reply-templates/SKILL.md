---
name: "TikTok Comment Reply Templates"
description: >-
  Generate conversion-focused TikTok comment replies that turn questions and
  objections into safe next-step actions without sounding spammy. Use when the
  user needs sales replies for TikTok comments, wants structured reply scripts
  by intent, or needs comment-to-DM/cart conversion sequences for TikTok Shop.
status: enabled
layer: ecommerce
sub_layer: customers
---
# TikTok Comment Reply Templates

## Skill Card

- **Category:** Comment Conversion
- **Core problem:** How to reply to comments in a way that increases conversion without hurting trust.
- **Best for:** TikTok Shop creators/operators handling high-volume pre-sale comment threads.
- **Expected input:** Comment text, product facts, offer terms, shipping/return rules, prohibited claims.
- **Expected output:** Intent-tagged reply scripts + CTA ladder + escalation and fallback logic.
- **Creatop handoff:** Save best-performing reply patterns into Creatop response templates.

## Workflow

1. Define the decision question, review window, and the one KPI or business signal that matters most.
2. Normalize the evidence into a compact table so facts, assumptions, and missing fields are separated.
3. Rank the gaps or options by business impact, reversibility, and confidence.
4. Convert the diagnosis into P0 / P1 / P2 actions tied to evidence, not generic best practices.
5. End with a validation loop so the operator knows exactly how to recheck if the fix worked.
6. Separate product issue, expectation issue, policy issue, and service issue before recommending a response.

1. Define the decision question, review window, and the one KPI or business signal that matters most.
2. Normalize the evidence into a compact table so facts, assumptions, and missing fields are separated.
3. Rank the gaps or options by business impact, reversibility, and confidence.
4. Convert the diagnosis into P0 / P1 / P2 actions tied to evidence, not generic best practices.
5. End with a validation loop so the operator knows exactly how to recheck if the fix worked.
6. Separate product issue, expectation issue, policy issue, and service issue before recommending a response.

1. Classify each comment into intent buckets:
   - info request,
   - objection (price/trust/fit/shipping),
   - buying signal,
   - low-intent/noise.
2. Generate 2 reply variants per comment:
   - concise public reply,
   - conversion-oriented follow-up prompt.
3. Add CTA ladder by intent stage:
   - comment keyword,
   - click cart,
   - DM for detail,
   - live demo reminder.
4. Add policy-safe rewrite when risky claims appear.
5. Provide handling map for repeat objections and hostile comments.

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
1. Comment intent table (intent, urgency, confidence)
2. Reply pack (short/public + follow-up/CTA)
3. Conversion ladder (by buyer stage)
4. Risk-safe alternatives and do-not-say list

## Quality and safety rules

- Do not fabricate guarantees, outcomes, stock levels, or delivery promises.
- Keep replies grounded in provided product/offer facts.
- Avoid repetitive spam-like phrasing across multiple comments.
- For abusive/low-intent comments, provide de-escalation or ignore guidance.
- Flag policy-risk phrases and provide compliant alternatives.

## License

Copyright (c) 2026 **Razestar**.

This skill is provided under **CC BY-NC-SA 4.0** for non-commercial use.
You may reuse and adapt it with attribution to Razestar, and share derivatives
under the same license.

Commercial use requires a separate paid commercial license from **Razestar**.
No trademark rights are granted.

## Example

**User:** Someone commented "Is this actually worth $35 or just hype?" on our TikTok. How should I reply?

**Assistant:** Intent: price objection (comparing stage). Public reply: "Totally fair question -- we packed in [key feature] that usually costs 2x elsewhere. Drop a comment 'DETAILS' and I'll DM you the full breakdown." Follow-up CTA: DM with side-by-side value comparison and a limited-time bundle offer. This acknowledges the concern, provides social proof framing, and moves the conversation to DM for conversion.

## When to Use

- The request is fundamentally about reviews, refunds, retention, subscriptions, or public reply workflows, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if TikTok Comment Reply Templates returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about reviews, refunds, retention, subscriptions, or public reply workflows, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if TikTok Comment Reply Templates returns a clear verdict, deliverable set, and next-step list.
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

- feedback source
- time window + sample size
- product / SKU scope
- desired decision
- baseline or benchmark expectation
- the evidence source to trust first

- feedback source
- time window + sample size
- product / SKU scope
- desired decision
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
- customer-facing or ops-facing response guidance

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- gap diagnosis or scorecard
- P0 / P1 / P2 action list
- confidence and evidence labels
- customer-facing or ops-facing response guidance

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
- Preserve useful positive signals, not only complaints or failure themes.

- Separate observed facts, user-provided facts, and assumptions.
- Do not invent exact numbers, specs, claims, certifications, or outcomes that were not provided or verified.
- Prefer the shortest useful answer shape that an operator can actually hand off.
- Do not over-generalize from one screenshot, one SKU, one creator, or one time window.
- Keep the top 3-5 actions only; backlog items belong in a secondary list.
- Preserve useful positive signals, not only complaints or failure themes.

## Missing Data Protocol

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (sample size, timeframe, or source of feedback), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (sample size, timeframe, or source of feedback), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

## Validation Loop

- Recheck: reply quality / complaint share / refund rate / rating trend.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Recheck: reply quality / complaint share / refund rate / rating trend.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

## Success Metrics

- the targeted complaint or refund theme declines
- public-facing replies become reusable and lower confusion
- positive themes are preserved in messaging

- the targeted complaint or refund theme declines
- public-facing replies become reusable and lower confusion
- positive themes are preserved in messaging

- the targeted complaint or refund theme declines
- public-facing replies become reusable and lower confusion
- positive themes are preserved in messaging

- the targeted complaint or refund theme declines
- public-facing replies become reusable and lower confusion
- positive themes are preserved in messaging
