---
name: "Tracking QA"
description: >-
  Validate event tracking and attribution integrity before budget ramp. Use when
  preparing to scale paid media, after a platform migration, or when conversion
  data looks off.
status: enabled
trigger: >-
  Activate before paid traffic scale-up, after pixel/tag changes, or when
  ROAS/CPA data looks implausible.
cooldown: 0
layer: ecommerce
sub_layer: ads
---
# Tracking QA

## Skill Card
- **Category:** Ads / Tracking Infrastructure
- **Core problem:** Faulty tracking causes inflated ROAS, lost conversions, and mis-allocated budget. Catch errors before scaling spend.
- **Best for:** Pre-scale QA, post-migration validation, iOS ATT impact assessment, pixel audit
- **Expected input:** Pixel/Events API config, GA4 schema, checkout event logs, iOS consent rate (optional)
- **Expected output:** QA report with pass/fail checklist, error severity table, patched event mapping, acceptance criteria

---

## Before You Start

If the user hasn't provided these, ask before proceeding:

1. **Platform(s):** Which ad platform(s)? (Meta / Google / TikTok / Pinterest — or multiple)
2. **Event scope:** Which events need validation? (PageView, AddToCart, InitiateCheckout, Purchase minimum)
3. **Purchase event config:** Does the Purchase event pass `value`, `currency`, and `order_id`?
4. **iOS / ATT status:** Do you have an estimate of iOS opt-in rate, or access to Aggregated Event Measurement (AEM) setup?
5. **Current daily spend:** Helps calibrate risk tier (≥$1k/day = high priority).
6. **Integration method:** Browser pixel only? Server-side Events API? Both (recommended)?

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

### Step 1 — Inventory & Risk Triage
- List all tracked events with firing method (browser pixel / CAPI / GA4)
- Flag events missing deduplication keys (`event_id`)
- Rate each event: HIGH risk (Purchase, Lead), MEDIUM (AddToCart, InitiateCheckout), LOW (PageView, ViewContent)

### Step 2 — Browser-Side Pixel Audit
- Check for duplicate fires (variant selection, SPA page transitions)
- Verify event parameters: `content_ids`, `value`, `currency`, `num_items` on Purchase
- Test via Meta Pixel Helper / Tag Assistant / browser console
- Confirm `fbq('track', 'Purchase', {...})` fires exactly once per order

```javascript
// Correct Purchase event — all required fields
fbq('track', 'Purchase', {
  value: 99.00,
  currency: 'USD',
  content_ids: ['SKU-123', 'SKU-456'],
  content_type: 'product',
  num_items: 2,
  order_id: 'ORD-789'   // dedup key
});
```

### Step 3 — Server-Side / Events API Audit
- Verify CAPI is receiving Purchase events with matching `event_id` to browser pixel
- Check event match quality score (target ≥ 7.0 in Meta Events Manager)
- Confirm `user_data` fields: hashed email, phone, external_id sent where available
- Test deduplication: same `event_id` on browser + server should produce one counted event

```python
# Meta CAPI — minimal correct payload
payload = {
    "event_name": "Purchase",
    "event_time": int(time.time()),
    "event_id": "ORD-789",          # must match browser fbq event_id
    "action_source": "website",
    "user_data": {
        "em": hashlib.sha256(email.lower().encode()).hexdigest(),
        "ph": hashlib.sha256(phone.encode()).hexdigest(),
        "client_ip_address": request.META.get("REMOTE_ADDR"),
        "client_user_agent": request.META.get("HTTP_USER_AGENT"),
    },
    "custom_data": {
        "value": 99.00,
        "currency": "USD",
        "order_id": "ORD-789"
    }
}
```

### Step 4 — iOS ATT & Aggregated Event Measurement Check
- Verify domain is verified in Meta Business Manager
- Confirm AEM event priority list (max 8 events; Purchase must be #1)
- Check iOS opt-in rate baseline: industry avg ~42% post-ATT; <30% = signal loss risk
- Validate SKAdNetwork (SKAN) postbacks are arriving if running iOS app campaigns
- Check `fb_app_id` and `advertiser_tracking_enabled` flag in mobile SDK

**iOS ATT acceptance criteria:**
| Check | Pass condition |
|---|---|
| Domain verified | ✅ Verified in Business Manager |
| AEM configured | Purchase event ranked #1 in priority list |
| Event deduplication | event_id present on both browser + CAPI |
| Modeled conversions | Enabled in Events Manager |
| iOS opt-in rate | ≥ 30% (flag if lower) |

### Step 5 — Attribution Window & UTM Consistency
- Confirm attribution window settings (7-day click, 1-day view recommended for most e-commerce)
- Validate UTM parameters survive redirects (especially on checkout sub-domains)
- Cross-check Meta-reported conversions vs. GA4 / backend order counts (acceptable variance ≤ 15%)
- Flag if Meta over-counts >20% vs backend (usually double-fire) or under-counts >20% (CAPI gap)

### Step 6 — Final QA Report & Sign-Off
Produce structured output (see Output Format below). Provide go/no-go recommendation before scale-up.

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

1. **Executive Summary** (≤ 5 lines): overall risk level, critical blockers, go/no-go verdict
2. **Event QA Checklist** — pass/fail per event per platform
3. **Error Severity Table** — issue, severity (P0/P1/P2), fix recommendation, owner
4. **iOS ATT Status Card** — opt-in rate estimate, AEM config status, SKAN status
5. **Patched Event Mapping** — corrected code snippets for any failed checks
6. **Acceptance Criteria** — minimum standards that must pass before budget ramp

---

## Quality and Safety Rules

- Never fabricate conversion counts or pixel data; always work from user-provided inputs
- If sample is too small (<50 events in window), flag low confidence explicitly
- Don't recommend scaling budget until P0 issues are resolved
- Label every recommendation with which platform it applies to

---

## Benchmark Targets

| Metric | Target |
|---|---|
| Event match accuracy | ≥ 95% |
| Purchase event dedup rate | 100% (no double-counting) |
| CAPI event match quality | ≥ 7.0 / 10 |
| Meta vs backend conversion variance | ≤ 15% |
| iOS opt-in rate | ≥ 30% (flag below) |
| AEM Purchase event priority | Rank #1 |

---

## Example 1 — Pre-scale audit before 10× budget increase

**User:** We're about to scale our Meta ads from $500 to $5,000/day. Can you check our tracking setup first?

**Assistant:**
Running event QA across your pixel, Events API, and checkout flow. Found 2 critical issues:

**P0 — Double-fire on AddToCart:** Your `AddToCart` event fires twice on variant selection pages (SPA re-render trigger). This inflates reported funnel volume by ~40%.

**P0 — Purchase missing value parameter:** The `Purchase` event on mobile checkout is missing `value` and `currency`. Meta's algorithm cannot optimize for revenue — only for event count.

**P1 — No CAPI deduplication:** Browser pixel and CAPI are both firing Purchase without shared `event_id`, causing ~25% double-count in reported conversions.

**iOS ATT:** Domain is verified. AEM configured but Purchase is ranked #3 — move to #1.

Patched event code attached. Do not scale to $5k/day until P0s are fixed. Estimated fix time: 2 hours (dev) + 24h validation window.

---

## Example 2 — Edge case: cross-domain checkout causing UTM loss

**User:** Our GA4 shows 800 sessions from Meta ads but only 12 purchases attributed to Meta in GA4. Meta reports 95 purchases. What's happening?

**Assistant:**
This pattern (Meta over-reports vs. GA4) typically has two causes — let me check both:

**Likely cause #1 — UTM parameter loss at cross-domain checkout:**
If your checkout lives on a subdomain (e.g., `checkout.yourdomain.com`) and you haven't configured GA4 cross-domain tracking, sessions lose their UTM source at the handoff — GA4 records purchases as "direct" while Meta's pixel fires correctly on the thank-you page.

**Fix:** Add `checkout.yourdomain.com` to GA4's cross-domain list under Admin → Data Streams → Configure tag settings.

**Likely cause #2 — Attribution window mismatch:**
Meta uses 7-day click / 1-day view by default; GA4 uses last-click. The same conversion can be claimed by Meta (7-day window) but not attributed there in GA4.

**Verification steps:**
1. Check GA4 Acquisition → Session source/medium for "direct" purchases — are they suspiciously high?
2. Pull Meta breakdown by attribution window: how many of the 95 are view-through vs. click-through?
3. Test UTM persistence: place a Meta test click and trace the session through checkout in GA4 DebugView.

Acceptable Meta/GA4 variance with cross-domain fixed: ≤15%.

---

## Routing Hints

- If conversion data looks fine but ROAS is still poor → use **meta-ads-analyser** (account-level bidding/audience diagnosis)
- If you need to audit creative performance separately from tracking → use **ad-creative-analysis**
- If the core issue is checkout drop-off (not tracking) → use **checkout-friction-audit**
- If attribution is correct but ROI is not meeting targets → use **conversion-rate-optimizer**

---

- Trigger condition: Triggered when the user needs to validate pixel setup, event firing, CAPI integration, iOS ATT compliance, or UTM attribution before scaling paid media.

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

## Scale-Up Pass Gate

- Require all P0 checks to pass before recommending any budget increase.
- Confirm GTM or tag-manager containers are not duplicating browser-side events.
- Verify AEM priority order and that Purchase is ranked first when Meta is in scope.
- Check accelerated checkout or alternate payment paths separately when present.
- Require a 24-hour validation window after fixes before declaring the setup scale-ready.

## When to Use

- The request is fundamentally about paid media, attribution, creative, or budget efficiency, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Tracking & Attribution QA returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about paid media, attribution, creative, or budget efficiency, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Tracking & Attribution QA returns a clear verdict, deliverable set, and next-step list.
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

## Template Use

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.
