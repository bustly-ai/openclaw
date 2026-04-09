---
name: "Conversion Rate Optimizer"
description: >-
  Optimize funnel friction points from landing to checkout. Use when conversion
  rate underperforms category benchmarks, when there's a significant drop-off at
  a specific funnel stage, or when uplift from traffic is not translating to
  revenue.
status: enabled
trigger: >-
  Activate when conversion underperforms target, add-to-cart rate drops, or
  checkout abandonment rises.
cooldown: 0
layer: ecommerce
sub_layer: ads
---
# Conversion Rate Optimizer

## Skill Card
- **Category:** Ecommerce / Funnel Optimization
- **Core problem:** Traffic that doesn't convert is wasted spend. Friction points at any funnel stage — product page, cart, checkout — kill ROI silently without obvious error signals.
- **Best for:** Product page CRO, checkout abandonment reduction, funnel drop-off diagnosis, A/B test prioritization
- **Expected input:** Funnel stage metrics (sessions, add-to-cart rate, checkout initiation rate, purchase rate), page analytics, optional heatmap/session recording insights
- **Expected output:** Friction diagnosis by funnel stage, prioritized fix list (P0/P1/P2), A/B test recommendations, expected uplift estimates

---

## Before You Start

If the user hasn't provided these, ask:

1. **Current conversion rate:** What is the overall store CVR (sessions → purchase)? And the target?
2. **Funnel breakdown:** Can you share stage-by-stage metrics? Minimum: sessions → add-to-cart → checkout initiated → purchase
3. **Traffic source:** Organic / paid / email / social? (Different sources have different intent levels; a 2% CVR from cold paid traffic vs. 2% from email are very different problems)
4. **Platform:** Shopify / WooCommerce / custom? (Affects checkout optimization levers available)
5. **Device breakdown:** Mobile vs. desktop split? (Mobile checkout friction is usually the #1 issue)
6. **Known pain points:** Any existing heatmap data, session recordings, or customer feedback about friction?

---

## Workflow

1. Define the decision question, review window, and the one KPI or business signal that matters most.
2. Normalize the evidence into a compact table so facts, assumptions, and missing fields are separated.
3. Rank the gaps or options by business impact, reversibility, and confidence.
4. Convert the diagnosis into P0 / P1 / P2 actions tied to evidence, not generic best practices.
5. End with a validation loop so the operator knows exactly how to recheck if the fix worked.
6. Keep traffic quality, tracking integrity, and budget efficiency separate instead of collapsing them into one verdict.

1. Define the decision question, review window, and the one KPI or business signal that matters most.
2. Normalize the evidence into a compact table so facts, assumptions, and missing fields are separated.
3. Rank the gaps or options by business impact, reversibility, and confidence.
4. Convert the diagnosis into P0 / P1 / P2 actions tied to evidence, not generic best practices.
5. End with a validation loop so the operator knows exactly how to recheck if the fix worked.
6. Keep traffic quality, tracking integrity, and budget efficiency separate instead of collapsing them into one verdict.

### Step 1 — Funnel Stage Mapping & Leak Identification
- Map the full funnel: Landing/PDP → Add to Cart → Cart View → Checkout Initiation → Payment → Purchase
- Calculate conversion rate at each stage transition
- Identify the stage with the largest absolute drop-off (this is the priority, not the biggest %-drop)
- Use benchmark comparison to determine if each stage is underperforming

**Funnel Stage Benchmarks (ecommerce, paid traffic):**

| Stage | Benchmark CVR | Below benchmark = friction present |
|---|---|---|
| Landing page → Add to Cart | 5–10% | < 5% = PDP/offer problem |
| Add to Cart → Checkout Initiated | 55–70% | < 55% = cart friction or price shock |
| Checkout Initiated → Purchase | 50–65% | < 50% = checkout friction |
| Overall sessions → Purchase | 1.5–3.5% | < 1.5% = multiple friction points |
| Mobile-specific sessions → Purchase | 1.0–2.5% | < 1.0% = mobile UX critical issue |

> **Note on benchmarks:** These are cross-industry averages for paid traffic. Adjust for vertical: luxury goods expect lower CVR (0.5–1.5%); consumables/impulse expect higher (3–6%). The benchmark is a diagnostic guide, not a hard pass/fail threshold.

### Step 2 — PDP (Product Detail Page) Audit
If the biggest leak is Landing → Add to Cart:

- **Above the fold:** Is the product name, price, primary benefit, and CTA visible without scrolling on mobile?
- **Value proposition clarity:** Can a first-time visitor understand what the product does and why to buy it in < 5 seconds?
- **Social proof:** Are reviews visible above the fold? Count, star rating, and recency matter
- **Visual quality:** Hero image quality, multiple angles, lifestyle shots — does the product look trustworthy?
- **CTA prominence:** Is the "Add to Cart" button high-contrast, clear, and easy to tap on mobile?
- **Price anchoring:** Is the price contextualized (compare-at price, per-use cost breakdown, value framing)?
- **Urgency/scarcity:** Any legitimate stock signal or time-limited offer?

### Step 3 — Cart & Checkout Friction Audit
If the biggest leak is Add to Cart → Purchase:

- **Shipping cost reveal:** Is shipping cost first shown at checkout? (Most common conversion killer) → Test free-shipping threshold banner on PDP/cart
- **Checkout steps:** How many pages/steps? (1-page checkout vs. multi-page: 1-page typically +10–15% CVR)
- **Guest checkout:** Is guest checkout prominently available? Forced account creation kills mobile CVR
- **Payment methods:** Is the customer's preferred method available? (Shop Pay, Apple Pay, Google Pay reduce mobile friction significantly)
- **Form fields:** Are unnecessary fields present? (Company name, phone when email works, etc.)
- **Mobile UX:** Does the checkout render well on small screens? Tap targets large enough?
- **Trust signals:** SSL badge, return policy, security icons visible at checkout?

### Step 4 — Offer & Pricing Diagnosis
- Is the price competitive vs. the customer's perceived alternatives?
- Is there a clear return/refund policy that reduces purchase risk?
- Is there a free-shipping threshold, and is it set appropriately for average order value?
- Is there an upsell or cross-sell that increases AOV without adding friction?

### Step 5 — A/B Test Prioritization
Rank potential tests by:
- **Estimated impact:** How many sessions flow through this stage per week?
- **Implementation effort:** Developer time required (low = ship fast)
- **Confidence of hypothesis:** Based on data evidence or user feedback strength

**Test Prioritization Matrix:**
| Test idea | Estimated impact | Effort | Priority |
|---|---|---|---|
| Free shipping threshold banner on PDP | High (affects all sessions) | Low | P0 |
| 1-page checkout vs. multi-step | High | Medium | P0 |
| CTA color/text above fold | Medium | Low | P1 |
| Review widget above fold | Medium | Low | P1 |
| Guest checkout default | High | Medium | P0 |
| Trust badge at payment | Medium | Low | P1 |

### Step 6 — Uplift Estimation & Monitoring Plan
- For each P0 fix, estimate CVR uplift range based on industry evidence
- Set measurement window: minimum 1,000 sessions or 2 weeks before declaring a test winner
- Define success metric: primary (purchase CVR), secondary (add-to-cart rate, checkout initiation rate)
- Track before/after comparison for each change

---

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

1. **Executive Summary** (≤ 5 lines): current CVR vs. benchmark, biggest leak stage, top 3 fixes
2. **Funnel Stage Table** — actual vs. benchmark CVR at each stage with gap analysis
3. **Friction Diagnosis by Stage** — specific issues found with evidence
4. **Prioritized Fix List** — P0/P1/P2 with implementation effort and expected uplift
5. **A/B Test Roadmap** — ordered test list with hypothesis, metric, and minimum sample size
6. **7-Day Execution Plan** — what to implement immediately vs. what to queue

---

## Quality and Safety Rules

- Always separate "PDP problem" from "checkout problem" from "offer problem" — they require different fixes
- Don't recommend A/B tests on < 500 weekly sessions — insufficient power
- State benchmark source and note when a merchant's vertical warrants adjusted targets
- When recommending shipping threshold changes, note the margin impact
- Uplift estimates should be ranges, not point estimates ("expected +0.3–0.7pp" not "will increase CVR by 0.5%")

---

## Benchmark Targets

| Metric | Target |
|---|---|
| Overall store CVR (paid traffic) | ≥ 2.0% (vertical-adjusted) |
| Add to Cart rate | ≥ 7% |
| Cart → Checkout initiation | ≥ 60% |
| Checkout completion rate | ≥ 55% |
| Mobile CVR vs. desktop CVR | ≥ 70% of desktop rate |
| Checkout CVR uplift from optimization | ≥ 8% over baseline window |

---

## Example 1 — Product page with 2.1% CVR, target 3.5%

**User:** Our product page has a 2.1% conversion rate but the target is 3.5%. Here are the funnel metrics from last week — can you find the biggest drop-off?

**Assistant:**
**Funnel Analysis:**

| Stage | Your rate | Benchmark | Gap |
|---|---|---|---|
| Sessions → Add to Cart | 6.8% | 5–10% | ✅ Within range |
| Add to Cart → Checkout Initiated | 42% | 55–70% | ❌ -13pp below benchmark |
| Checkout Initiated → Purchase | 61% | 50–65% | ✅ Within range |
| Overall CVR | 2.1% | 2.0–3.5% | ❌ Below target |

**Biggest leak: Cart → Checkout Initiation (42% vs. 55–70% benchmark)**

This stage gap accounts for most of your CVR shortfall. The add-to-cart rate is fine — customers want the product. The friction is between cart view and checkout start.

**Most likely cause:** Shipping cost reveal. If your checkout is the first place customers see shipping costs, 41% are choosing not to proceed. This is the #1 cart abandonment driver in e-commerce.

**Recommended fixes:**
1. **P0 — Free shipping threshold banner:** Add a persistent banner on PDP and cart ("Free shipping on orders $75+"). Expected uplift: +0.8–1.2pp CVR.
2. **P0 — Display shipping cost on PDP:** Show shipping cost (or "Free shipping" badge) before customers reach checkout. Eliminates the surprise.
3. **P1 — Single-page checkout:** If you're on multi-page checkout, migrate to 1-page (Shopify's native 1-page checkout is recommended). Expected uplift: +0.5–0.8pp.
4. **P1 — Enable Shop Pay / Apple Pay** in the cart for mobile users — removes the form-filling friction.

**Expected combined uplift:** +1.3–2.0pp CVR, which would bring you to 3.4–4.1%, meeting or exceeding the 3.5% target.

---

## Example 2 — Edge case: high mobile traffic but mobile CVR is 0.6% vs. desktop 3.2%

**User:** Our desktop CVR is 3.2% but mobile is only 0.6%. Mobile is 70% of our traffic. Overall store CVR looks terrible because of this.

**Assistant:**
A 5:1 desktop-to-mobile CVR gap is severe — this is almost always a mobile UX/checkout issue, not an offer problem (since desktop performs well).

**Diagnostic checklist for mobile-specific friction:**

**1 — Hero image and CTA above fold on mobile:**
- On a 375px screen, does the "Add to Cart" button appear without scrolling?
- Is the product image taking up too much vertical space, pushing the CTA below fold?
- Test: On an actual iPhone (not desktop browser simulate), how many taps to reach checkout?

**2 — Checkout method on mobile:**
- Is Apple Pay / Google Pay available? Mobile users hate typing card details. Enabling one-tap payment typically lifts mobile CVR by 20–35%.
- Is guest checkout the default? Forced login on mobile is especially high-friction.

**3 — Form field optimization:**
- Count the number of form fields. Every additional field costs ~5% of completions on mobile.
- Is autofill working? (Address autocomplete, email suggestion)

**4 — Page speed on mobile:**
- Mobile CVR correlates directly with page load time. Every 1-second delay costs ~7% CVR.
- Test with Google PageSpeed Insights — mobile score < 60 = significant issue.

**5 — Mobile-specific checkout bugs:**
- Test the entire purchase flow on actual mobile devices (iOS Safari + Android Chrome)
- Common bugs: keyboard pushing page layout, sticky headers blocking tap targets, payment modal not loading

**Recommended immediate actions:**
1. Enable Apple Pay + Google Pay (P0 — often 2 hours to implement, 20–30% mobile CVR lift)
2. Confirm CTA above fold on mobile (P0 — CSS fix)
3. Run PageSpeed Insights and fix score < 60 (P0 — developer task)
4. Enable 1-page checkout on Shopify (P1)

Addressing these should bring mobile CVR from 0.6% to 1.5–2.0%, which at 70% mobile share will move your overall store CVR from ~1.3% to ~2.2–2.6%.

---

## Routing Hints

- Ad creative performance is causing poor post-click CVR → use **ad-creative-analysis**
- Tracking data doesn't match actual orders → fix first with **tracking-attribution-qa**
- Landing page copy and offer structure deep-dive → use **ecommerce-landing-page-conversion-audit**
- Overall checkout experience audit → use **checkout-friction-audit**
- High return rates reducing net CVR value → use **apparel-size-return-reducer** or **refund-rate-reducer**

---

- Trigger condition: Triggered when the user explicitly requires the `conversion-rate-optimizer` capability, or when CVR underperforms benchmarks or targets at any funnel stage.

## Missing Data Protocol

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (spend context, metric baseline, or tracking state), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (spend context, metric baseline, or tracking state), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the minimum missing inputs needed to avoid misleading advice.
- If the user cannot provide them, switch to checklist or hypothesis mode and label assumptions clearly.
- Do not convert rough estimates, benchmarks, or ranges into measured facts.
- End low-confidence outputs with the single most valuable next data request.

## Validation Loop

- Recheck: CTR / CVR / CPA / ROAS or attribution integrity.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Recheck: CTR / CVR / CPA / ROAS or attribution integrity.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Name the 1-3 core metrics or checkpoints to recheck after action.
- Give a review window that matches the cadence of the work.
- Define what improvement, no-change, and failure look like so the operator can close the loop.
- If the user has no analytics access, provide a manual validation checkpoint instead.

## Benchmark Guide

- Use category benchmarks only as context, never as proof that one exact page element is broken.
- For ecommerce, compare add-to-cart rate, checkout completion rate, and purchase rate as separate stages.
- When available, recommend heatmaps or session recordings to validate friction hypotheses before large redesigns.

## When to Use

- The request is fundamentally about paid media, attribution, creative, or budget efficiency, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Conversion Rate Optimizer returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about paid media, attribution, creative, or budget efficiency, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Conversion Rate Optimizer returns a clear verdict, deliverable set, and next-step list.
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

- platform and campaign scope
- time window + budget or spend context
- key performance metrics or screenshots
- known recent changes
- baseline or benchmark expectation
- the evidence source to trust first

- platform and campaign scope
- time window + budget or spend context
- key performance metrics or screenshots
- known recent changes
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
- metric guardrails or spend thresholds

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- gap diagnosis or scorecard
- P0 / P1 / P2 action list
- confidence and evidence labels
- metric guardrails or spend thresholds

## Boundary and Routing

- Use this skill for full-funnel diagnosis across PDP, cart, checkout, and experiment prioritization.
- Route to `checkout-friction-audit` when the problem is narrowly checkout-specific.
- Route to `ecommerce-landing-page-conversion-audit` or `page-cro` when the scope is page messaging / CRO rather than the whole funnel.

- Use this skill for full-funnel diagnosis across PDP, cart, checkout, and experiment prioritization.
- Route to `checkout-friction-audit` when the problem is narrowly checkout-specific.
- Route to `ecommerce-landing-page-conversion-audit` or `page-cro` when the scope is page messaging / CRO rather than the whole funnel.

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

- primary efficiency metric improves without spend quality collapsing
- tracking / attribution variance narrows
- one losing action is paused or fixed within the review window

- primary efficiency metric improves without spend quality collapsing
- tracking / attribution variance narrows
- one losing action is paused or fixed within the review window

- primary efficiency metric improves without spend quality collapsing
- tracking / attribution variance narrows
- one losing action is paused or fixed within the review window

- primary efficiency metric improves without spend quality collapsing
- tracking / attribution variance narrows
- one losing action is paused or fixed within the review window

## Benchmark Use

- Use benchmarks as a diagnostic guide, not a hard pass / fail verdict, and adjust by channel intent and price point.
- If the sample is too small for a clean A/B claim, prioritize low-regret fixes first and delay hard experiment conclusions.

- Use benchmarks as a diagnostic guide, not a hard pass / fail verdict, and adjust by channel intent and price point.
- If the sample is too small for a clean A/B claim, prioritize low-regret fixes first and delay hard experiment conclusions.
