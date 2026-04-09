---
name: "Landing Page Analysis"
description: >-
  Analyze landing pages for CRO issues and conversion optimization. Use when the
  user mentions landing page audit, funnel diagnosis, conversion rate, message
  match, CTA issues, or low-performing paid traffic pages.
status: enabled
layer: ecommerce
sub_layer: store-ops
---
# Landing Page Analysis

Audit a landing page as a conversion system, not as a design critique.

## Skill Card

- **Category:** CRO / Funnel diagnosis
- **Core problem:** The page gets traffic but fails to convert because the offer, proof, CTA flow, or friction pattern is weak.
- **Best for:** Paid traffic landing pages, pricing pages, campaign pages, lead-gen pages, and product-specific acquisition pages.
- **Expected input:** Page URL or pasted page copy, traffic source, conversion goal, audience, key constraints.
- **Expected output:** Severity-ranked blockers, quick wins, structural fixes, and a validation plan.

## Required Inputs

- page / listing / store scope
- traffic or business context
- primary KPI or pain signal
- hard constraints
- baseline or benchmark expectation
- the evidence source to trust first

- page / listing / store scope
- traffic or business context
- primary KPI or pain signal
- hard constraints
- baseline or benchmark expectation
- the evidence source to trust first

Ask for the smallest missing set before giving hard recommendations:

1. Page URL or screenshots / pasted copy.
2. Primary conversion goal: purchase, lead, signup, demo, quiz start, or add to cart.
3. Traffic source: paid social, paid search, email, affiliate, organic, or mixed.
4. Target audience and offer.
5. Current conversion rate or at least a rough baseline.

If the user cannot share a live URL, switch to questionnaire mode and work from described page structure.

## Access Modes

### Mode A - Live page available
- Inspect the live page directly.
- Capture above-the-fold, CTA placement, proof, objection handling, and form or checkout handoff.

### Mode B - No live page available
- Ask for the page structure in this order:
  - hero headline and subheadline
  - primary CTA
  - sections in order
  - proof elements
  - offer terms
  - FAQ / objection handling
- Mark the audit as **structure-based** rather than page-observed.

## Workflow

1. Define the decision question, review window, and the one KPI or business signal that matters most.
2. Normalize the evidence into a compact table so facts, assumptions, and missing fields are separated.
3. Rank the gaps or options by business impact, reversibility, and confidence.
4. Convert the diagnosis into P0 / P1 / P2 actions tied to evidence, not generic best practices.
5. End with a validation loop so the operator knows exactly how to recheck if the fix worked.
6. Separate traffic-quality issues from page / offer / catalog execution issues.

1. Define the decision question, review window, and the one KPI or business signal that matters most.
2. Normalize the evidence into a compact table so facts, assumptions, and missing fields are separated.
3. Rank the gaps or options by business impact, reversibility, and confidence.
4. Convert the diagnosis into P0 / P1 / P2 actions tied to evidence, not generic best practices.
5. End with a validation loop so the operator knows exactly how to recheck if the fix worked.
6. Separate traffic-quality issues from page / offer / catalog execution issues.

### Step 1 - Confirm goal and traffic intent
- Identify the page type and one primary conversion goal.
- Identify what the visitor expects based on the traffic source.
- If the page serves multiple goals, force-rank them and optimize for the top one.

### Step 2 - Audit the above-the-fold section
- Can a cold visitor understand what the page is, who it is for, and why it matters within 5 seconds?
- Check headline specificity, subheadline clarity, CTA visibility, and trust signal presence.
- Flag generic category language as a likely blocker.

### Step 3 - Check message match
- Compare the traffic promise to the landing page promise.
- For paid traffic, verify that the headline, offer, and CTA continue the same story as the ad or keyword.
- Treat broken message match as a P0 blocker on paid pages.

### Step 4 - Evaluate page momentum
- Review section order: value proposition -> proof -> objection handling -> CTA reinforcement.
- Flag long explanation blocks that appear before trust or before action.
- Check whether proof appears close enough to the CTA to reduce hesitation.

### Step 5 - Find friction and hidden cost
- Identify form friction, navigation leakage, mobile scroll burden, unclear next steps, and hidden shipping or pricing surprises.
- If the page hands off to checkout or signup, call out the handoff risk explicitly.

### Step 6 - Score severity
Use this severity model:

| Severity | Meaning | Typical action |
|---|---|---|
| **P0** | Blocks conversion at the core promise or action layer | Fix before scaling spend |
| **P1** | Strong drag on conversion but not total failure | Queue in current sprint |
| **P2** | Helpful polish or test idea | Test after core fixes |

### Step 7 - Produce the action plan
- Prioritize no more than 3 P0 items.
- Add estimated uplift direction where defensible.
- End with a short validation loop: what metric to recheck, when, and what counts as improvement.

## Standard Audit Checklist

Always check these dimensions:

1. Value proposition clarity
2. Message match with traffic source
3. CTA visibility and hierarchy
4. Proof and trust placement
5. Offer clarity and risk reversal
6. Objection handling
7. Form / checkout / handoff friction
8. Mobile readability and scroll burden

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

1. **Executive summary** - overall diagnosis in 3-5 lines
2. **P0 / P1 / P2 blocker list**
3. **Evidence table** - issue, why it matters, confidence, recommended fix
4. **Quick wins** - changes that can ship in 1-3 days
5. **Structural fixes** - larger changes that need design or copy work
6. **Validation loop** - what to measure in 7-14 days

## Missing Data Protocol

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (page scope, KPI baseline, or traffic context), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (page scope, KPI baseline, or traffic context), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- If the page cannot be viewed directly, label findings as **structure-based**.
- If there is no baseline conversion data, avoid precise uplift claims.
- If traffic source is unknown, do not overstate message-match conclusions.

## Validation Loop

- Recheck: primary conversion KPI / friction signal / launch blocker count.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Recheck: primary conversion KPI / friction signal / launch blocker count.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

Recheck at least:

- conversion rate
- CTA click-through rate
- bounce / engagement signal
- step-to-step drop after the page handoff

Suggested window:
- 7 days for paid traffic pages
- 14 days for lower-volume pages

## Routing Hints

- If the issue is the checkout itself, not the landing page -> use `checkout-friction-audit`
- If the issue is full-page CRO across homepage / pricing / blog / feature pages -> use `page-cro`
- If the issue is listing or PDP competitiveness -> use `listing-gap-audit`

## Example

**User:** Our landing page at https://example.com/promo has a 1.2% conversion rate. Can you audit it?

**Assistant:** Executive summary: The page has two P0 blockers and one P1 drag. P0: the hero headline is generic and does not communicate a concrete benefit. P0: the primary CTA sits below the fold with no proof nearby, so paid visitors do not see a clear next step fast enough. P1: trust is weak because there are no testimonials, logos, or guarantee cues before the CTA. Quick wins: rewrite the headline around the specific promise, move the CTA into the first screen, and add 2-3 proof elements near the CTA. Validation loop: recheck CTA click rate and conversion rate 7 days after shipping the hero rewrite.

## When to Use

- The request is fundamentally about listing, pricing, launch, or store-ops decisions, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Landing Page Analysis returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about listing, pricing, launch, or store-ops decisions, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Landing Page Analysis returns a clear verdict, deliverable set, and next-step list.
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

## Deliverables

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- gap diagnosis or scorecard
- P0 / P1 / P2 action list
- confidence and evidence labels
- page / listing / launch decision summary

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- gap diagnosis or scorecard
- P0 / P1 / P2 action list
- confidence and evidence labels
- page / listing / launch decision summary

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

- Separate observed facts, user-provided facts, and assumptions.
- Do not invent exact numbers, specs, claims, certifications, or outcomes that were not provided or verified.
- Prefer the shortest useful answer shape that an operator can actually hand off.
- Do not over-generalize from one screenshot, one SKU, one creator, or one time window.
- Keep the top 3-5 actions only; backlog items belong in a secondary list.

## Success Metrics

- the operator knows the top 3-5 fixes
- the output distinguishes now / later / not yet
- one measurable KPI or gate is named for the next review

- the operator knows the top 3-5 fixes
- the output distinguishes now / later / not yet
- one measurable KPI or gate is named for the next review

- the operator knows the top 3-5 fixes
- the output distinguishes now / later / not yet
- one measurable KPI or gate is named for the next review

- the operator knows the top 3-5 fixes
- the output distinguishes now / later / not yet
- one measurable KPI or gate is named for the next review
