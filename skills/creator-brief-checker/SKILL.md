---
name: "Creator Brief Checker"
description: >-
  Check and improve creator briefs before sending to influencers. Use when your
  brief is unclear, too long, or likely to cause revision loops.
status: enabled
layer: ecommerce
sub_layer: creators
---
# Creator Brief Checker

## Skill Card

- **Category:** Creator Operations
- **Core problem:** Unclear briefs cause revision loops and delayed creator delivery.
- **Best for:** Teams sending product briefs to TikTok creators or UGC partners.
- **Expected input:** Original brief, product facts, must-say points, restrictions, delivery rules.
- **Expected output:** Brief health check + risk list + copy-ready improved brief.

## Workflow

1. Define the decision question, review window, and the one KPI or business signal that matters most.
2. Normalize the evidence into a compact table so facts, assumptions, and missing fields are separated.
3. Rank the gaps or options by business impact, reversibility, and confidence.
4. Convert the diagnosis into P0 / P1 / P2 actions tied to evidence, not generic best practices.
5. End with a validation loop so the operator knows exactly how to recheck if the fix worked.
6. Separate creator fit, creator operations, and creator economics rather than mixing them into one fuzzy score.

1. Define the decision question, review window, and the one KPI or business signal that matters most.
2. Normalize the evidence into a compact table so facts, assumptions, and missing fields are separated.
3. Rank the gaps or options by business impact, reversibility, and confidence.
4. Convert the diagnosis into P0 / P1 / P2 actions tied to evidence, not generic best practices.
5. End with a validation loop so the operator knows exactly how to recheck if the fix worked.
6. Separate creator fit, creator operations, and creator economics rather than mixing them into one fuzzy score.

1. Check missing and conflicting requirements.
2. Flag unclear or over-restrictive parts.
3. Rebuild into a concise, creator-friendly brief.
4. Add one-line clarification for alignment.

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
1. Brief health check
2. Risk points
3. Improved brief (copy-ready)
4. One-line clarification

## Quality and safety rules

- Keep brief short and executable.
- Separate must-follow rules from flexible suggestions.
- Do not fabricate product claims or legal terms.
- Reduce revision risk and communication overhead.

## License

Copyright (c) 2026 **Razestar**.

This skill is provided under **CC BY-NC-SA 4.0** for non-commercial use.
You may reuse and adapt it with attribution to Razestar, and share derivatives
under the same license.

Commercial use requires a separate paid commercial license from **Razestar**.
No trademark rights are granted.

## Example

**User:** Check this brief before I send it to our TikTok creator: "Make a video about our protein powder. Must mention it's the best. Show the bag. Keep it under 60 seconds. Post by Friday."

**Assistant:** Brief health: weak -- missing product claims backup, no hook guidance, no CTA direction. Risk points: "the best" is an unsupported superlative that may cause compliance issues; no creative freedom for the creator's style. Improved brief: "Create a 30-60s TikTok showing how you use [Brand] protein powder in your routine. Key message: 25g protein per scoop, mixes smooth. Must show the product bag. CTA: link in bio. Deadline: Friday 5 PM EST. Creative style is up to you."

## Missing Data Protocol

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (product / offer context, budget, or creator evidence), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (product / offer context, budget, or creator evidence), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the minimum missing inputs needed to avoid misleading advice.
- If the user cannot provide them, switch to checklist or hypothesis mode and label assumptions clearly.
- Do not convert rough estimates, benchmarks, or ranges into measured facts.
- End low-confidence outputs with the single most valuable next data request.

## Validation Loop

- Recheck: reply rate / acceptance rate / content go-live / GMV proxy.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Recheck: reply rate / acceptance rate / content go-live / GMV proxy.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Name the 1-3 core metrics or checkpoints to recheck after action.
- Give a review window that matches the cadence of the work.
- Define what improvement, no-change, and failure look like so the operator can close the loop.
- If the user has no analytics access, provide a manual validation checkpoint instead.

## Compliance Checklist

- Check disclosure requirements such as `#ad`, `#sponsored`, or local paid partnership labels.
- Remove unsupported superlatives and health or earnings claims unless the user provides proof.
- Separate must-follow compliance rules from creative suggestions to reduce revision loops.

## When to Use

- The request is fundamentally about creator selection, briefing, outreach, performance, or deal operations, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Creator Brief Checker returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about creator selection, briefing, outreach, performance, or deal operations, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Creator Brief Checker returns a clear verdict, deliverable set, and next-step list.
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

- creator handle(s) or profile links
- product / offer + target buyer
- budget or commercial constraint
- known performance or content samples
- baseline or benchmark expectation
- the evidence source to trust first

- creator handle(s) or profile links
- product / offer + target buyer
- budget or commercial constraint
- known performance or content samples
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
- partner-fit or outreach / delivery guidance

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- gap diagnosis or scorecard
- P0 / P1 / P2 action list
- confidence and evidence labels
- partner-fit or outreach / delivery guidance

## Boundary and Routing

- Use this skill to clean and de-risk the brief before it is sent.
- Route to `creator-collab-checklist` when the problem is launch-readiness, timing, or operational alignment rather than brief quality.
- Route to `creator-outreach` if the brand has not even opened the conversation yet.

- Use this skill to clean and de-risk the brief before it is sent.
- Route to `creator-collab-checklist` when the problem is launch-readiness, timing, or operational alignment rather than brief quality.
- Route to `creator-outreach` if the brand has not even opened the conversation yet.

## Quality Rules

- Separate observed facts, user-provided facts, and assumptions.
- Do not invent exact numbers, specs, claims, certifications, or outcomes that were not provided or verified.
- Prefer the shortest useful answer shape that an operator can actually hand off.
- Do not over-generalize from one screenshot, one SKU, one creator, or one time window.
- Keep the top 3-5 actions only; backlog items belong in a secondary list.
- Separate audience fit from operational fit and from commercial fit.

- Separate observed facts, user-provided facts, and assumptions.
- Do not invent exact numbers, specs, claims, certifications, or outcomes that were not provided or verified.
- Prefer the shortest useful answer shape that an operator can actually hand off.
- Do not over-generalize from one screenshot, one SKU, one creator, or one time window.
- Keep the top 3-5 actions only; backlog items belong in a secondary list.
- Separate audience fit from operational fit and from commercial fit.

## Success Metrics

- fewer low-fit creators are approved
- reply / acceptance / go-live quality improves
- a clear upgrade / hold / stop threshold exists

- fewer low-fit creators are approved
- reply / acceptance / go-live quality improves
- a clear upgrade / hold / stop threshold exists

- fewer low-fit creators are approved
- reply / acceptance / go-live quality improves
- a clear upgrade / hold / stop threshold exists

- fewer low-fit creators are approved
- reply / acceptance / go-live quality improves
- a clear upgrade / hold / stop threshold exists

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

## Platform and Region Caveats

- If the brief spans TikTok Shop plus another platform, separate the platform-specific CTA, disclosure, and format rules.
- If the market is China or another disclosure-sensitive market, ask once for region before finalizing the compliance wording.

- If the brief spans TikTok Shop plus another platform, separate the platform-specific CTA, disclosure, and format rules.
- If the market is China or another disclosure-sensitive market, ask once for region before finalizing the compliance wording.
