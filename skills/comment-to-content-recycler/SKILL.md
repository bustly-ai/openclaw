---
name: "Comment Recycler"
description: >-
  Transform comments, DMs, and FAQ threads into prioritized content ideas and
  script-ready angles. Use when the user wants audience-driven topics, needs
  repeatable idea generation, or wants to turn community questions into
  high-relevance short-form content.
status: enabled
layer: ecommerce
sub_layer: content
---
# Comment Recycler

## Skill Card

- **Category:** Market Intelligence
- **Core problem:** How to convert comments/DMs into content pipeline?
- **Best for:** Always-on content ideation
- **Expected input:** Comments, DMs, objections, FAQ snippets
- **Expected output:** Intent clusters + prioritized content backlog
- **Creatop handoff:** Send high-priority clusters into Creatop script queue

## What this does

Convert audience questions into ranked, script-ready content topics.

## Workflow

1. Confirm the audience, channel, proof, and format guardrails before drafting anything.
2. Distill the raw inputs into the exact angles, must-say points, and do-not-say constraints.
3. Build the output in the target structure first, then fill the details instead of free-writing.
4. Add the final draft plus a short QA pass for claims, formatting, and missing proof.
5. End with what still needs verification, who should review it, and what to ship next.
6. Separate product issue, expectation issue, policy issue, and service issue before recommending a response.

1. Confirm the audience, channel, proof, and format guardrails before drafting anything.
2. Distill the raw inputs into the exact angles, must-say points, and do-not-say constraints.
3. Build the output in the target structure first, then fill the details instead of free-writing.
4. Add the final draft plus a short QA pass for claims, formatting, and missing proof.
5. End with what still needs verification, who should review it, and what to ship next.
6. Separate product issue, expectation issue, policy issue, and service issue before recommending a response.

### 1) Ingest and clean input

Collect recent comments/DM/FAQ items (e.g., 7–30 days).

Normalize by:
- removing duplicates
- merging near-identical phrasing
- preserving representative audience wording

### 2) Cluster by intent

Group into:
- how-to
- comparison
- troubleshooting
- buying concerns
- objections/myths

### 3) Prioritize clusters

Score each cluster:
- frequency
- urgency
- monetization relevance
- ease of production

Rank clusters before writing outputs.

### 4) Generate content outputs

For top clusters, provide:
- topic/title
- 3 hook options
- short script angle
- CTA tied to audience language

### 5) Close the loop

Add:
- which comments to reply first
- one follow-up question to collect better demand signals

## Quality Rules

- Separate observed facts, user-provided facts, and assumptions.
- Do not invent exact numbers, specs, claims, certifications, or outcomes that were not provided or verified.
- Prefer the shortest useful answer shape that an operator can actually hand off.
- Make the draft copy-ready or handoff-ready; do not stop at abstract principles.
- If proof is missing, downgrade the claim instead of fabricating supporting language.
- Preserve useful positive signals, not only complaints or failure themes.

- Separate observed facts, user-provided facts, and assumptions.
- Do not invent exact numbers, specs, claims, certifications, or outcomes that were not provided or verified.
- Prefer the shortest useful answer shape that an operator can actually hand off.
- Make the draft copy-ready or handoff-ready; do not stop at abstract principles.
- If proof is missing, downgrade the claim instead of fabricating supporting language.
- Preserve useful positive signals, not only complaints or failure themes.

- Keep audience language intact where useful.
- Avoid generic ideas disconnected from real comments.
- Prioritize repeated pains with commercial relevance.
## License

Copyright (c) 2026 **Razestar**.

This skill is provided under **CC BY-NC-SA 4.0** for non-commercial use.
You may reuse and adapt it with attribution to Razestar, and share derivatives
under the same license.

Commercial use requires a separate paid commercial license from **Razestar**.
No trademark rights are granted.

## Example

**User:** Here are 50 comments from our last TikTok video. Turn the best ones into content ideas.

**Assistant:** Clustered 50 comments into 4 intent groups: **How-to** (18 comments -- "how do you use this with oily skin?"), **Comparison** (12 -- "is this better than CeraVe?"), **Buying concern** (11 -- "does it ship to Canada?"), **Myth/objection** (9 -- "no way this works in 2 weeks"). Top 3 content ideas: 1) "Oily skin routine using our serum" (hook: "POV: your oily skin needed this"). 2) "Us vs. CeraVe -- honest breakdown" (hook: "I tried both for 30 days"). 3) "Does it actually ship to Canada? Yes -- here's proof." Prioritized by frequency and monetization relevance.

## When to Use

- The request is fundamentally about reviews, refunds, retention, subscriptions, or public reply workflows, and the operator needs a copy-ready draft, reusable brief, or structured handoff output.
- The team could take action immediately if Comment To Content Recycler returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about reviews, refunds, retention, subscriptions, or public reply workflows, and the operator needs a copy-ready draft, reusable brief, or structured handoff output.
- The team could take action immediately if Comment To Content Recycler returns a clear verdict, deliverable set, and next-step list.
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

- feedback source
- time window + sample size
- product / SKU scope
- desired decision
- brand guardrails or forbidden claims
- any examples of acceptable output tone or format

- feedback source
- time window + sample size
- product / SKU scope
- desired decision
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
- customer-facing or ops-facing response guidance

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- copy-ready or operator-ready output
- QA checklist for claims / format
- handoff note for the next owner
- customer-facing or ops-facing response guidance

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
- Review window: after review, publish, or first usage in production.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Recheck: reply quality / complaint share / refund rate / rating trend.
- Review window: after review, publish, or first usage in production.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

## Cluster Prioritization

- Rank clusters by frequency, commercial relevance, urgency / objection severity, and ease of production.
- Handle logistics or service complaints separately from product-education topics so content does not accidentally mask an ops problem.

- Rank clusters by frequency, commercial relevance, urgency / objection severity, and ease of production.
- Handle logistics or service complaints separately from product-education topics so content does not accidentally mask an ops problem.
