---
name: "Creator Performance Audit"
description: >-
  Audit creator campaign performance using ROI thresholds to decide renew,
  negotiate, or terminate. Use when reviewing past creator collaborations,
  deciding contract renewals, or diagnosing why a creator campaign
  underperformed.
status: enabled
trigger: >-
  Triggered when the user needs to audit creator ROI, make renewal decisions, or
  diagnose creator performance after a campaign.
cooldown: 0
layer: ecommerce
sub_layer: creators
---
# Creator Performance Audit

## Skill Card

- **Category:** Creator Operations
- **Core problem:** Which creators are delivering real ROI, and what to do about each tier?
- **Best for:** Post-campaign review, contract renewal decisions, portfolio optimization
- **Expected input:** Creator name/handle, GMV or revenue generated, investment (fees + product cost + ops time), engagement data, content metrics
- **Expected output:** ROI score per creator, tier decision (renew/negotiate/terminate), audit memo with next-step recommendation
- **Handoff:** Feed renew decisions into creator-brief-checker for next campaign; feed terminate list into tiktok-shop-creator-fit-scorer for replacement sourcing

## Before You Start

Ask the user for the following if not provided:

1. **Creator list** — Which creators to audit? Handles or names.
2. **Revenue/GMV data** — What GMV or revenue did each creator generate during the period?
3. **Investment data** — What was the total cost per creator? Include: fixed fee, commission paid, product cost (COGS × units gifted/sold), ops hours (if tracked).
4. **Time period** — What campaign window are we auditing (e.g., last 30 days, Q1)?
5. **Context** — Any known external factors (new product, seasonal spike, creative issues)?

If data is partial, proceed with what is available and flag confidence level per creator.

## ROI Formula

```
Creator ROI = Revenue Attributed / Total Investment

Revenue Attributed = GMV × Gross Margin %
Total Investment   = Fixed Fee + Commission Paid + (COGS × Units Gifted) + Ops Cost
```

**Example:**
- GMV: $8,000 | Gross Margin: 50% → Revenue Attributed: $4,000
- Fixed Fee: $500 | Commission: $400 | COGS gifted: $60 | Ops: $100 → Total Investment: $1,060
- **ROI = $4,000 / $1,060 = 3.77x**

## Decision Thresholds

| ROI | Decision | Action |
|-----|----------|--------|
| **> 3x** | ✅ **RENEW** | Prioritize for next campaign; offer better deal to lock in |
| **1x – 3x** | 🟡 **NEGOTIATE** | Investigate content/audience issues; renegotiate terms; test with new brief |
| **< 1x** | 🔴 **TERMINATE** | End collaboration; replace with better-fit creator; document learnings |

Secondary signals to adjust the threshold:
- **Adjust UP** (treat as one tier higher): Brand awareness value, new product launch spike, audience quality unusually strong
- **Adjust DOWN** (treat as one tier lower): Fraudulent engagement detected, policy violation, content quality below standard

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

1. **Collect campaign data** — For each creator: gather GMV, fixed fee, commission, gifted units (COGS), ops hours. Normalize to same time window.

2. **Calculate ROI per creator** — Apply the formula above. If GMV is unavailable, use order count × average order value. Flag LOW confidence if data source is indirect (e.g., platform estimate vs. tracked affiliate link).

3. **Classify into tiers** — Apply the >3x / 1–3x / <1x decision matrix. Note any adjustment signals.

4. **Diagnose underperformers** — For NEGOTIATE and TERMINATE tiers: identify the failure mode. Use the audit template below to structure the diagnosis.

5. **Write recommendations per creator** — Specific next action: renew with what terms, or negotiate what change, or terminate and replace with what profile.

6. **Deliver audit memo** — Summary table + per-creator narrative + action queue.

## Audit Template (Per Creator)

```
Creator: @handle
Period: [date range]
GMV: $X | Margin: X% | Revenue Attributed: $X
Total Investment: $X (breakdown: fee $X / commission $X / gifted $X / ops $X)
ROI: Xx → Tier: RENEW / NEGOTIATE / TERMINATE

Performance notes:
- Engagement rate: X% (benchmark: >2% = healthy)
- Top video views: X
- Conversion rate on shop link: X%
- Content quality: [Strong/Weak/Inconsistent]
- Audience match: [On-target/Mixed/Off-target]

Failure mode (if NEGOTIATE/TERMINATE):
□ Low reach — not enough views
□ Low conversion — views not converting to purchases
□ Audience mismatch — wrong demographics
□ Content quality — off-brand, poor demo, weak CTA
□ Fraud signal — suspicious engagement pattern
□ Ops issue — late delivery, revision loop, unresponsive

Recommendation:
[Specific action with rationale]
```

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

1. **Executive summary** (max 5 lines): number audited, tier breakdown, estimated avoidable loss, top action
2. **Priority actions (P0/P1/P2):** renew contracts, renegotiate terms, terminate and source replacements
3. **Evidence table:** creator | GMV | investment | ROI | tier | failure mode | recommendation
4. **7-day execution plan:** day-by-day steps to act on audit results

## Quality and Safety Rules

- Do not fabricate GMV or ROI data — if data is unavailable, flag explicitly and use conservative estimates.
- Separate genuine underperformance from one-time anomalies (product OOS, platform outage, seasonal dip).
- Flag potential engagement fraud (suspiciously high like rate, bot-pattern comments) for manual review.
- Do not terminate based on a single data point — require at least 2 campaigns or 30 days of data.
- Respect any contractual notice periods before recommending termination.

## Benchmark Targets

- Portfolio average ROI: ≥2.5x
- RENEW tier creators: ≥30% of active roster
- TERMINATE decisions actioned within 7 days of audit
- Replacement sourcing started within same 7-day window

## Example 1 (主场景 — 批量续约审计)

**User:** Audit these 4 creators for our skincare brand. Last month GMV: @GlowWithMia $12K, @SkincareByJay $3.2K, @NaturalLookLena $800, @BeautyVault $6K. Fixed fees: Mia $1K, Jay $500, Lena $300, Vault $800. All get 8% commission. Our margin is 55%. Gifted product COGS avg $80 each.

**Assistant:**
Investment calc (8% commission + fee + gifted):
- Mia: $960+$1K+$80=$2,040 | Revenue attr: $6,600 | ROI: **3.24x → RENEW**
- Jay: $256+$500+$80=$836 | Revenue attr: $1,760 | ROI: **2.11x → NEGOTIATE**
- Lena: $64+$300+$80=$444 | Revenue attr: $440 | ROI: **0.99x → TERMINATE**
- Vault: $480+$800+$80=$1,360 | Revenue attr: $3,300 | ROI: **2.43x → NEGOTIATE**

Executive summary: 1 RENEW, 2 NEGOTIATE, 1 TERMINATE. Estimated monthly loss from Lena: ~$4/month net, but opportunity cost is the slot. Portfolio avg ROI: 2.19x — below 2.5x target, driven by Lena drag.

Priority actions: (P0) Lock in Mia with improved deal this week. (P1) Renegotiate Jay's brief — content quality low, shift to commission-only. (P1) Renegotiate Vault — explore exclusivity. (P2) Terminate Lena, begin replacement sourcing via tiktok-shop-creator-fit-scorer.

## Example 2 (边缘场景 — 数据不完整 + 高品牌价值)

**User:** @FashionKai did $2K GMV last month but she's a fashion KOL with 500K followers and great brand image. We paid her $2K flat fee. Should we keep her?

**Assistant:**
ROI calculation (margin 40%): Revenue attr = $800. Investment = $2,000. **ROI = 0.4x → TERMINATE by formula**.

However, applying adjustment signals:
- 500K followers with authentic engagement = significant brand awareness value (untracked)
- Fashion KOL positioning = potential halo effect on new product launches
- $2K GMV in first campaign may reflect ramp-up period

**Adjusted recommendation: NEGOTIATE** — don't terminate outright.

Suggested renegotiation: Reduce fixed fee to $500 + 12% commission (aligns incentives). Set 60-day GMV target of $5K as renewal threshold. If she doesn't hit it, terminate with data to back the decision.

⚠️ Caution: Brand value is real but unquantifiable — do not let it justify indefinite subsidy. Set a clear performance gate.

## Routing Hints

- If creator is being renewed and needs a new brief → use **creator-brief-checker** skill
- If you need to source replacement creators after terminations → use **tiktok-shop-creator-fit-scorer** skill
- If content quality is a recurring issue → use **creator-analysis** skill to diagnose fit
- If ad performance (paid) is the concern, not organic creator — use **meta-ads-analyser** or **ads-analyst** skills instead

- Applicable scenarios: Post-campaign review, contract renewal decisions, creator portfolio optimization.
- Trigger condition: Triggered when the user needs to audit creator ROI, make renewal decisions, or diagnose creator campaign underperformance.

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

## Weighted Audit Scorecard

- ROI efficiency: 40%
- Content efficiency (GMV or orders per post): 20%
- Audience fit: 20%
- Operational reliability: 10%
- Compliance and brand safety: 10%
- Use the weighted score to break ties between creators with similar ROI.

## 7-Day Action Calendar

- Day 1: validate GMV, fee, commission, and gifting data.
- Day 2: calculate ROI and weighted score.
- Day 3: confirm fraud or compliance risks.
- Day 4: draft renew / negotiate / terminate decisions.
- Day 5: align internal stakeholders.
- Day 6-7: send creator communications and begin replacement sourcing if needed.

## When to Use

- The request is fundamentally about creator selection, briefing, outreach, performance, or deal operations, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Creator Performance Audit returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about creator selection, briefing, outreach, performance, or deal operations, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Creator Performance Audit returns a clear verdict, deliverable set, and next-step list.
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
