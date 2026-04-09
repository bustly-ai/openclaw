---
name: "TikTok Live Reply Scripts"
description: >-
  Handle TikTok Live sales objections in real time with structured reply
  strategies, risk-safe phrasing, and conversion-focused response sequences. Use
  when the user asks how to reply to buyer objections during live selling, wants
  objection scripts, or needs a playbook for price/trust/urgency hesitation in
  TikTok Shop live sessions.
status: enabled
layer: ecommerce
sub_layer: customers
---
# TikTok Live Reply Scripts

## Skill Card

- **Category:** Live Commerce Conversion
- **Core problem:** How to respond to live objections fast without sounding pushy or risky.
- **Best for:** TikTok Shop live hosts and moderators handling buyer hesitation.
- **Expected input:** Objection text, product facts, offer terms, proof points, risk constraints.
- **Expected output:** Prioritized objection replies + escalation ladder + fallback close scripts.
- **Creatop handoff:** Feed winning objection/reply patterns into script and live SOP libraries.

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

1. Parse objection type (price, trust, fit, shipping, urgency, quality, social proof).
2. Map objection to buyer intent stage (curious, comparing, almost-buying, post-trust check).
3. Generate 2-3 reply variants per objection:
   - short live-safe line (<= 20 words),
   - expanded reassurance line,
   - action prompt (comment keyword / click cart / stay for demo).
4. Add risk checks for claims, guarantees, and policy-sensitive language.
5. Build a sequence ladder: first reply -> proof reinforcement -> close prompt -> fallback.

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
1. Objection diagnosis table (type, urgency, likely hidden concern)
2. Reply pack (short / expanded / CTA) per objection
3. Escalation ladder for repeated objections
4. 7-day live training loop (what to test and log)

## Quality and safety rules

- Do not fabricate outcomes, certifications, inventory, or shipping promises.
- Keep replies aligned with provided product facts and offer terms.
- Avoid manipulative pressure language; prioritize trust-building and clarity.
- If evidence is missing, recommend collecting proof instead of forcing a close.
- Flag policy-risk phrases and provide safer alternatives.

## License

Copyright (c) 2026 **Razestar**.

This skill is provided under **CC BY-NC-SA 4.0** for non-commercial use.
You may reuse and adapt it with attribution to Razestar, and share derivatives
under the same license.

Commercial use requires a separate paid commercial license from **Razestar**.
No trademark rights are granted.

## Example

**User:** During my TikTok live, people keep saying "I can get this cheaper on Amazon." How do I handle that?

**Assistant:** Objection type: price / trust (comparing stage). Short live line: "Totally get it -- but you won't get [exclusive bundle/color/bonus] anywhere else." Expanded: "Amazon has a similar one, but this version includes [differentiator] and you're getting the live-only price today." CTA: "Drop 'COMPARE' in chat and I'll show the side-by-side." Fallback if they push back: pivot to social proof -- "Ask [buyer name] who just grabbed two -- she compared before buying."

## When to Use

- The request is fundamentally about reviews, refunds, retention, subscriptions, or public reply workflows, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if TikTok Live Reply Scripts returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about reviews, refunds, retention, subscriptions, or public reply workflows, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if TikTok Live Reply Scripts returns a clear verdict, deliverable set, and next-step list.
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
