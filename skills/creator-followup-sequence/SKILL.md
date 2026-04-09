---
name: "Creator Followup Sequence"
description: >-
  Write short, human follow-up messages for creator outreach when the first
  message gets ignored, delayed, or half-answered. Use when the user needs
  second-touch or third-touch outreach that revives the conversation without
  sounding needy, spammy, or generic.
status: enabled
layer: ecommerce
sub_layer: creators
---
# Creator Followup Sequence

## Skill Card

- **Category:** Creator Acquisition
- **Core problem:** How to follow up with creators after no reply without sounding annoying or robotic?
- **Best for:** Affiliate recruiting, UGC sourcing, partnership outreach, and creator pipeline recovery.
- **Expected input:** Original outreach, creator context, offer angle, time since first touch, desired next step.
- **Expected output:** 2-4 follow-up message options with timing logic, angle shifts, and stop rules.
- **Creatop handoff:** Store winning follow-up patterns inside outreach SOPs and CRM templates.

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

1. Diagnose the conversation state.
   - no reply after first touch
   - warm but vague reply
   - interested then stalled
   - timing objection
   - likely low fit / low priority
2. Identify the most likely reason for silence.
3. Choose the best follow-up angle.
   - light bump
   - value bump
   - clarity bump
   - proof bump
   - polite close-the-loop
4. Draft a short sequence with escalating clarity, not escalating pressure.
5. Add timing guidance and stop rules.

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
1. Outreach status diagnosis
2. Best follow-up angle to use now
3. Follow-up sequence (message 1 / message 2 / final check-in)
4. Timing recommendation
5. Stop / no-chase rule

## Quality and safety rules

- Keep each message short and easy to answer from a phone.
- Add new value, clearer context, or a smaller ask in each follow-up.
- Do not guilt-trip, pressure, or fake urgency.
- Do not invent proof, budgets, or performance claims.
- If the creator appears unqualified or uninterested, recommend stopping.

## License

Copyright (c) 2026 **Razestar**.

This skill is provided under **CC BY-NC-SA 4.0** for non-commercial use.
You may reuse and adapt it with attribution to Razestar, and share derivatives
under the same license.

Commercial use requires a separate paid commercial license from **Razestar**.
No trademark rights are granted.

## Example

**User:** I DMed a creator about an affiliate deal 5 days ago and got no reply. How should I follow up?

**Assistant:** Diagnosis: no reply after first touch -- likely missed or low priority. Best angle: value bump (add a concrete proof point). Follow-up message: "Hey [Name], just wanted to share -- our last 3 affiliate partners averaged $1,200/mo in commissions. Happy to send details if you're curious. No pressure either way!" Timing: send this week, then one final check-in in 7 days. Stop rule: if no reply after 3 touches total, move on.

## When to Use

- The request is fundamentally about creator selection, briefing, outreach, performance, or deal operations, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Creator Followup Sequence returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about creator selection, briefing, outreach, performance, or deal operations, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Creator Followup Sequence returns a clear verdict, deliverable set, and next-step list.
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

- Use this skill after the first outreach message has already been sent and the next question is follow-up sequencing.
- Route to `creator-outreach` for the first message and to `creator-deal-ops` after the creator starts discussing terms.

- Use this skill after the first outreach message has already been sent and the next question is follow-up sequencing.
- Route to `creator-outreach` for the first message and to `creator-deal-ops` after the creator starts discussing terms.

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

## Missing Data Protocol

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (product / offer context, budget, or creator evidence), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (product / offer context, budget, or creator evidence), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

## Validation Loop

- Recheck: reply rate / acceptance rate / content go-live / GMV proxy.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Recheck: reply rate / acceptance rate / content go-live / GMV proxy.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

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

## Half-Reply Branch

- If the creator replies vaguely, switch from a sequence script to a qualification response that clarifies interest, rate, and availability.
- Log no-response patterns so the next outreach batch improves instead of repeating the same angle blindly.

- If the creator replies vaguely, switch from a sequence script to a qualification response that clarifies interest, rate, and availability.
- Log no-response patterns so the next outreach batch improves instead of repeating the same angle blindly.
