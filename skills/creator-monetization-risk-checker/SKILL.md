---
name: "Creator Monetization Risk Checker"
description: >-
  Run a pre-publish monetization risk check for creator content across
  short-video platforms. Use when the user asks if a script is safe to monetize,
  wants policy-risk triage, needs advertiser-friendliness checks, or wants
  rewrite guidance to reduce demonetization and distribution risk.
status: enabled
layer: ecommerce
sub_layer: content
---
# Creator Monetization Risk Checker

## Skill Card

- **Category:** Compliance
- **Core problem:** Will this content hurt monetization or distribution?
- **Best for:** Pre-publish compliance check
- **Expected input:** Draft script/caption + product claim language + platform context
- **Expected output:** Risk audit + safer rewrite suggestions
- **Creatop handoff:** Run final safe version through Creatop publishing workflow

## What this does

Run a pre-publish risk screen and return:
- **Green**: publish
- **Yellow**: revise first
- **Red**: high risk, rework

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

### 1) Parse draft content

Review:
- script text
- title/hook/thumbnail claims
- sensitive wording
- originality/reuse signals

### 2) Score risk categories (1–5)

- policy / advertiser safety
- originality / reuse
- misleading claim risk
- brand suitability

### 3) Decide verdict

Rule of thumb:
- Green: all categories <= 2
- Yellow: any category = 3
- Red: any category >= 4

### 4) Provide mitigation edits

For each yellow/red item, output:
- problem line
- safer rewrite
- confidence level

Then provide:
- top 3 highest-impact fixes
- publish-ready revised version when possible

## Quality and safety rules

- Be strict on clear policy-violation language.
- Avoid overblocking harmless content.
- Preserve original creator intent where safe.
- Do not provide policy-evasion tactics.
## License

Copyright (c) 2026 **Razestar**.

This skill is provided under **CC BY-NC-SA 4.0** for non-commercial use.
You may reuse and adapt it with attribution to Razestar, and share derivatives
under the same license.

Commercial use requires a separate paid commercial license from **Razestar**.
No trademark rights are granted.

## Example

**User:** Is this TikTok script safe to monetize? "This supplement CURED my anxiety in 3 days. Doctors don't want you to know about this."

**Assistant:** Verdict: Red -- high risk, rework required. Policy risk: 5/5 (unsubstantiated health cure claim). Misleading claim risk: 5/5 ("cured" and "doctors don't want you to know"). Safer rewrite: "I've been taking this supplement for a month and I've noticed I feel calmer. Here's my honest experience." Top fix: remove all cure language and conspiracy framing before publishing.

## When to Use

- The request is fundamentally about creator selection, briefing, outreach, performance, or deal operations, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Creator Monetization Risk Checker returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about creator selection, briefing, outreach, performance, or deal operations, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Creator Monetization Risk Checker returns a clear verdict, deliverable set, and next-step list.
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

## Execution Safeguards

- Verify auth state, account scope, and object IDs before drafting a final command / mutation plan.
- Show the intended request / command shape and the expected success signal so another operator can audit it.
- Name the most likely failure modes, including permissions, rate limits, invalid paths, invalid payloads, or policy review blocks.
- If rollback is possible, state it. If rollback is not possible, state the irreversible step before it happens.

- Verify auth state, account scope, and object IDs before drafting a final command / mutation plan.
- Show the intended request / command shape and the expected success signal so another operator can audit it.
- Name the most likely failure modes, including permissions, rate limits, invalid paths, invalid payloads, or policy review blocks.
- If rollback is possible, state it. If rollback is not possible, state the irreversible step before it happens.

- Verify auth state, account scope, and object IDs before drafting a final command / mutation plan.
- Show the intended request / command shape and the expected success signal so another operator can audit it.
- Name the most likely failure modes, including permissions, rate limits, invalid paths, invalid payloads, or policy review blocks.
- If rollback is possible, state it. If rollback is not possible, state the irreversible step before it happens.

- Verify auth state, account scope, and object IDs before drafting a final command / mutation plan.
- Show the intended request / command shape and the expected success signal so another operator can audit it.
- Name the most likely failure modes, including permissions, rate limits, invalid paths, invalid payloads, or policy review blocks.
- If rollback is possible, state it. If rollback is not possible, state the irreversible step before it happens.

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

## Template Use

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.
