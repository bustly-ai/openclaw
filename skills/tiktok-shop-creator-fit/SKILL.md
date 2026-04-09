---
name: "TikTok Shop Creator Fit"
description: >-
  Score TikTok Shop creator-product fit using audience match, content style,
  conversion evidence, and execution risk to produce a ranked creator shortlist
  with outreach angles. Use when the team needs a diagnosis, ranking, or audit
  before changing execution.
status: enabled
trigger: >-
  Triggered when the user needs to evaluate, rank, or shortlist TikTok creators
  for a specific product or campaign before outreach or briefing.
cooldown: 0
layer: ecommerce
sub_layer: creators
---
# TikTok Shop Creator Fit

## Skill Card

- **Category:** Creator Matching
- **Core problem:** Which creators are most likely to convert for a specific product?
- **Best for:** Creator sourcing before outreach, batch screening of candidate lists
- **Expected input:** Product positioning, target ICP, creator profile links/metrics, budget constraints
- **Expected output:** Ranked creator shortlist with fit scores, outreach angle, and risk flags
- **Handoff:** Use top-ranked creators in outreach sequence and brief generation

## Before You Start

If the user hasn't provided the following, ask before proceeding:

1. **Product info** — What is the product? Price point, key selling points, target buyer (gender, age, interest)?
2. **Creator list** — How many creators to score? Provide handles, links, or metric snapshots.
3. **Budget range** — Is there a commission-only model, or fixed fee + commission? Any cap per creator?
4. **Market/platform** — Which TikTok Shop market (US, UK, SEA, etc.)? Any niche restrictions?

If the user provides partial info, score what is available and flag unknowns explicitly.

## Scoring Dimensions & Weights

Each creator is scored across 5 dimensions (total 100 points):

| Dimension | Weight | What to assess |
|-----------|--------|----------------|
| **Audience Relevance** | 30% | Follower demographics match target ICP (age, gender, interest, location) |
| **Content Style Fit** | 25% | Content format (demo, review, lifestyle) aligns with product category |
| **Conversion Evidence** | 25% | Past affiliate/shop conversion rate, GMV history, similar product performance |
| **Trust & Proof Signals** | 10% | Engagement rate (likes/comments vs. followers), comment quality, authenticity |
| **Operational Risk** | 10% | Past delivery reliability, responsiveness, exclusivity conflicts, red flags |

**Tier classification:**
- **P0 (Must-test):** 80–100 pts — prioritize outreach immediately
- **P1 (Worth-testing):** 60–79 pts — test with low-commitment deal
- **P2 (Low priority):** Below 60 pts — deprioritize unless specific niche advantage

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

1. **Collect inputs** — Gather product brief, ICP definition, creator list, and budget constraints. Note any unknowns.

2. **Profile normalization** — For each creator: pull or estimate follower count, engagement rate, niche tags, recent video themes, and any known affiliate/shop performance data.

3. **Score each dimension** — Apply the 5-dimension framework. If data is missing for a dimension, mark confidence as LOW and assign a conservative estimate (do not inflate score). Compute weighted total.

4. **Rank and tier** — Sort by total score. Assign P0/P1/P2 tier. Flag any risk issues (fake followers, audience mismatch, over-commercialized feed).

5. **Generate outreach angles** — For each P0/P1 creator, write a personalized 1-sentence outreach hook that references their specific content and connects it to the product.

6. **Deliver report + 7-day execution plan** — Output structured results with evidence table, priority actions, and a 7-day activation calendar.

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

1. **Executive summary** (max 5 lines): overall pool quality, recommended next step, biggest risk
2. **Priority actions (P0/P1/P2):** ranked creator table with scores per dimension and total
3. **Evidence table:** signal, confidence (HIGH/MED/LOW), risk flag, outreach angle
4. **7-day execution plan** (see template below)

### 7-Day Execution Plan Template

| Day | Action | Owner | Success Signal |
|-----|--------|-------|----------------|
| Day 1 | Send outreach DM to all P0 creators with personalized hook | Ops/BD | DM sent, read receipt |
| Day 2 | Follow up P0 non-replies; send to P1 creators | Ops/BD | ≥50% reply rate P0 |
| Day 3 | Negotiate deal terms (commission %, exclusivity, deadline) | BD | Draft agreement shared |
| Day 4 | Ship product samples + brief to confirmed creators | Ops | Tracking numbers sent |
| Day 5 | Brief review call / async Q&A with creators | BD | Creator confirms content plan |
| Day 6 | First draft review (if required) | BD/Creative | Feedback delivered <4h |
| Day 7 | Content goes live; track GMV link and engagement | Analytics | First 24h performance logged |

## Quality and Safety Rules

- Do not fabricate follower or conversion data.
- Mark unknown values explicitly as UNKNOWN and lower confidence rating.
- Prioritize fit quality over vanity metrics (reach alone ≠ conversion).
- When engagement rate is suspiciously high (>15%) or low (<0.5%), flag for manual verification.
- Do not recommend creators whose audience demographics contradict the product's legal target group (e.g., age-restricted products).

## Benchmark Targets

- P0 outreach reply rate: ≥50% within 48h
- P0 creator-to-activation conversion: ≥70%
- Average fit score of shortlisted pool: ≥72/100
- First video GMV within 7 days of posting: trackable via affiliate link

## Example 1 (主场景)

**User:** Score these 5 creators for our $30 kitchen gadget targeting home cooks aged 25-40.

**Assistant:**
Executive summary: Pool quality is moderate. 1 strong P0, 2 testable P1s, 2 P2s. Recommend activating P0 immediately and testing P1s in parallel with small commission-only deals. Main risk: P2 creators have high reach but wrong audience demographics.

| Creator | Audience Fit | Style Fit | Conversion Ev. | Trust | Op. Risk | Total | Tier |
|---|---|---|---|---|---|---|---|
| @HomeCookHacks | 28/30 | 23/25 | 22/25 | 9/10 | 10/10 | 92 | P0 |
| @FoodieFinds | 20/30 | 20/25 | 16/25 | 8/10 | 10/10 | 74 | P1 |
| @ViralKitchen | 18/30 | 19/25 | 14/25 | 7/10 | 8/10 | 66 | P1 |
| @LifestyleLara | 10/30 | 12/25 | 8/25 | 9/10 | 9/10 | 48 | P2 |
| @TrendHunterMike | 9/30 | 10/25 | 7/25 | 6/10 | 7/10 | 39 | P2 |

Outreach angle for @HomeCookHacks: "Your garlic press video got 2M views — our peeler fits that exact demo format. Open to testing on commission?"

7-day plan: [see template above applied to this creator set]

## Example 2 (边缘场景 — 数据缺失 + 新兴账号)

**User:** We have a $15 beauty sponge and found a creator with only 8K followers but her last 3 videos went viral (3M+ views each). Should we work with her?

**Assistant:**
⚠️ Edge case: Micro-creator with viral breakout pattern — standard follower-count scoring underweights this.

Scoring adjustment:
- Audience Fit: MED confidence (viral content attracts mixed audience; check comment demographics before deciding) — estimate 18/30
- Style Fit: HIGH confidence (beauty demo format is strong product match) — 23/25
- Conversion Evidence: LOW confidence (no shop affiliate history, small account) — 12/25 with HIGH uncertainty
- Trust Signals: HIGH — engagement rate is 38% on viral posts, comment quality authentic — 9/10
- Operational Risk: LOW risk (new creator, likely flexible on terms) — 9/10

**Total: 71/100 → P1 tier** — but flag as "breakout candidate." Recommend: small commission-only deal with a 7-day exclusivity window. If first video converts at ≥2% GMV rate, escalate to a paid package immediately.

Risk: Viral pattern may not be reproducible; do not commit large budgets until she posts once for your product.

## Routing Hints

- If creators score P0 but need a brief before outreach → use **creator-brief-checker** skill
- If a creator has past performance data to review before scoring → use **creator-performance-audit** skill
- If you need to analyze a creator's content and profile in depth → use **creator-analysis** skill
- If the product itself has no clear ICP defined → address ICP first before scoring creators

- Applicable scenarios: Business tasks related to ecommerce/creators — TikTok Shop creator sourcing, screening, and prioritization.
- Trigger condition: Triggered when the user needs to evaluate, rank, or shortlist TikTok creators for a specific product or campaign.

---

## License

Copyright (c) 2026 **Razestar**.

This skill is provided under **CC BY-NC-SA 4.0** for non-commercial use.
You may reuse and adapt it with attribution to Razestar, and share derivatives
under the same license.

Commercial use requires a separate paid commercial license from **Razestar**.
No trademark rights are granted.

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

## Default Weight Guide

- Audience relevance: 35%
- Content style and demo quality: 25%
- Commercial intent and CTA behavior: 20%
- Reliability and communication risk: 10%
- Unit economics / payout fit: 10%
- Adjust weights only when the user has a clear brand-specific priority.

## When to Use

- The request is fundamentally about creator selection, briefing, outreach, performance, or deal operations, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if TikTok Shop Creator Fit Scorer returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about creator selection, briefing, outreach, performance, or deal operations, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if TikTok Shop Creator Fit Scorer returns a clear verdict, deliverable set, and next-step list.
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
