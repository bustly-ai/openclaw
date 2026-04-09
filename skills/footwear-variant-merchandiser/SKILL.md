---
name: "Footwear Variant Merchandiser"
description: >-
  Optimize footwear size-color variant depth and merchandising to lift
  conversion and margin. Use for shoe catalog reviews, variant stock
  rebalancing, size demand curve analysis, or footwear sell-through improvement.
  Use when the team needs a diagnosis, ranking, or audit before changing
  execution.
status: enabled
trigger: >-
  Activate for footwear catalogs with slow sell-through, variant stockouts on
  popular sizes, excess inventory on slow sizes, or conversion drops on
  multi-variant footwear listings.
cooldown: 0
layer: ecommerce
sub_layer: apparel
---
# Footwear Variant Merchandiser

## Skill Card
- **Category:** Ecommerce / Footwear Merchandising
- **Core problem:** Footwear has the most complex variant structure in apparel — 2D matrix of size × color, with highly non-uniform demand distribution. Most brands either over-stock slow variants (margin erosion) or stockout their best sellers (revenue loss). Precise variant depth and merchandising is the lever.
- **Best for:** Size-color depth optimization, SKU rationalization, sell-through improvement, new colorway launch decisions, variant page merchandising
- **Expected input:** Variant-level inventory, sales by size and color (last 30–90 days), margins by variant, stockout history
- **Expected output:** ABC variant classification, stock rebalancing plan, clearance list, reorder recommendations, merchandising priority changes

---

## Before You Start

If the user hasn't provided these, ask:

1. **Catalog scope:** How many SKUs (parent styles)? How many total variants (size × color combinations)?
2. **Sales data:** Can you share variant-level sales for the last 30–90 days? (Size, color, units sold, revenue)
3. **Inventory snapshot:** Current on-hand inventory by variant
4. **Margin data:** Is margin consistent across variants, or do certain colors/materials have different costs?
5. **Lead time:** What's the restocking lead time from your supplier? (Affects reorder urgency calculation)
6. **Channel mix:** DTC only / Amazon / wholesale / multi-channel? (Stockout risk differs by channel)
7. **Price strategy:** Any variants on markdown/clearance currently?

**Variant Data Template (ask user to fill):**

| Style | Size | Color | On-hand units | Units sold (30d) | Unit price | Unit cost | Days of cover |
|---|---|---|---|---|---|---|---|
| Runner-X1 | 9 | Black | 24 | 8 | $89 | $32 | 90 |
| Runner-X1 | 9 | White | 6 | 6 | $89 | $32 | 30 |
| Runner-X1 | 13 | Black | 18 | 1 | $89 | $32 | 540 |

---

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

### Step 1 — Demand Curve Mapping
- Calculate sell-through rate per size: units sold / (units sold + on-hand inventory)
- Plot the size demand distribution — for most footwear categories, demand follows a predictable bell curve
- Identify the peak demand range (e.g., US women's shoes: peak at 7–9; US men's: peak at 9–11)
- Flag sizes above and below the bell curve with poor sell-through

**Typical US Footwear Size Demand Distribution (benchmark):**

| Category | Peak sizes (highest demand) | Tail sizes (low demand) |
|---|---|---|
| Women's athletic | 7, 7.5, 8, 8.5 | 5, 5.5, 11, 12 |
| Men's athletic | 9, 9.5, 10, 10.5, 11 | 6, 6.5, 14, 15 |
| Women's fashion | 7, 7.5, 8 | 4.5, 11, 12 |
| Men's casual | 9, 10, 11 | 6, 14 |
| Kids' (US) | 2Y, 3Y, 4Y, 5Y | 13, 1Y, 6Y+ |

### Step 2 — ABC Variant Classification
Classify every variant using revenue contribution and sell-through rate:

**ABC Classification Framework:**

| Class | Criteria | Action |
|---|---|---|
| **A** — Core winners | Top 20% of variants by revenue AND sell-through ≥ 60% | Protect stock depth; priority reorder; increase merchandising visibility |
| **B** — Mid performers | 20–60% of variants; sell-through 30–60% | Monitor; reorder conservatively; maintain listing |
| **C — Slow** | Sell-through < 30%, in bottom 40% by revenue | Reduce reorder; discount to clear; consider discontinuing |
| **D — Zero sellers** | Zero units sold in 60+ days | Mark down aggressively; clear within 30 days; do not reorder |

**Sample ABC Output Table:**

| Variant | Units sold (30d) | Sell-through % | Revenue contribution % | Class | Action |
|---|---|---|---|---|---|
| Size 9 / Black | 22 | 78% | 18% | A | Reorder +30 units |
| Size 10 / White | 18 | 65% | 15% | A | Reorder standard |
| Size 8 / Navy | 9 | 40% | 7% | B | Monitor |
| Size 13 / Black | 1 | 5% | 0.8% | C | Reduce reorder |
| Size 5 / Pink | 0 | 0% | 0% | D | Markdown + clearance |

### Step 3 — Stockout Risk Assessment
- Calculate days of cover per variant: on-hand units / (units sold per day)
- Flag variants with < (lead time + safety stock) days of cover = imminent stockout risk
- Prioritize reorder for Class A variants with low days of cover

**Stockout Risk Thresholds:**

| Days of cover | Risk tier | Action |
|---|---|---|
| < 14 days | 🔴 Critical | Reorder immediately |
| 14–30 days | 🟡 At risk | Initiate reorder this week |
| 30–60 days | 🟢 Healthy | Monitor |
| > 90 days | 🔵 Over-stocked | Consider markdown to reduce carrying cost |

### Step 4 — Inventory Rebalancing Plan
- **Class A:** Increase stock depth by 20–30% over current on-hand target; set reorder point = 2× lead time daily demand
- **Class B:** Maintain current depth; reduce reorder quantity by 10%
- **Class C:** No new orders; allow to sell through naturally; consider bundle or multi-buy promotion to accelerate
- **Class D:** Mark down to cost + 10% for liquidation; do not reorder; delist once cleared
- Calculate total inventory capital freed by Class D/C actions vs. capital required for Class A reorders

### Step 5 — Colorway & Listing Merchandising Optimization
- **Listing primary image:** Lead with the highest-converting colorway (typically the best-selling color for that style) — do not default to factory color order
- **Color swatch order:** Display Class A colors first in the variant selector; Class C/D colors last
- **Stockout display:** If a size/color combination is out of stock, show as "Notify Me" rather than removing the variant (preserves demand signal data)
- **Bundle opportunities:** Slow-moving sizes (Class C) can be bundled with accessories (socks, laces, care kits) to improve margin on clearance
- **Cross-sell:** On the PDP for a Class A variant that's low in stock, surface the next-best available size/color

### Step 6 — Reorder Quantity Calculation & Action Plan
For each Class A variant requiring reorder:
- **Reorder quantity formula:** (Average daily sales × (lead time + safety stock days)) − current on-hand
- **Safety stock:** 14 days for standard products; 21 days for best-sellers / seasonal peak products
- Total reorder cost vs. expected sell-through revenue
- Produce prioritized PO list for supplier

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

1. **Executive Summary** (≤ 5 lines): catalog health, % of variants by class, revenue at risk from stockouts, inventory value in slow/dead stock
2. **ABC Classification Table** — all variants classified with evidence
3. **Stockout Risk Dashboard** — Class A variants by days of cover, reorder urgency
4. **Clearance List** — Class D variants with recommended markdown price and expected clearance timeline
5. **Reorder Priority List** — Class A variants with reorder quantity calculation
6. **Merchandising Changes** — listing order, primary image, color swatch recommendations
7. **7-Day Action Plan** — what to do immediately vs. in the next 30 days

---

## Quality and Safety Rules

- Never recommend discontinuing a variant based on < 30 days of data — seasonal patterns distort short-window data
- Flag when a "zero seller" may be a new listing (< 14 days live) — don't classify as Class D prematurely
- Reorder quantity recommendations should include a cash flow impact note (total PO cost)
- When lead time data is not provided, use a conservative 30-day assumption and flag

---

## Benchmark Targets

| Metric | Target |
|---|---|
| Overall sell-through rate (30-day) | ≥ 50% across active variants |
| Class A variant sell-through | ≥ 65% |
| Class D (zero-seller) variants | < 10% of total active variants |
| Stockout events on Class A variants | 0 per month |
| Inventory days of cover — Class A | 30–60 days |
| Gross margin preservation post-clearance | > account-level target margin |
| Sell-through improvement (after rebalance) | ≥ 15pp over 60-day window |

---

## Example 1 — Running shoe with 24 variants, 60% of sales from 5 SKUs

**User:** Our running shoe has 24 size-color variants but 60% of sales come from just 5 SKUs. Should we trim the catalog?

**Assistant:**
**ABC Classification — Runner-X1 (24 variants, 90-day data)**

| Class | # Variants | % of revenue | Sell-through avg | Action |
|---|---|---|---|---|
| A | 5 | 60% | 74% | Protect + reorder |
| B | 11 | 35% | 38% | Monitor |
| C | 5 | 5% | 12% | No reorder, sell down |
| D | 3 | 0% | 0% | Clearance immediately |

**Class A (protect and reorder):**
- Size 9 / Black, Size 10 / Black, Size 10 / White, Size 9 / White, Size 11 / Black
- All have < 25 days of cover — reorder recommended this week (assuming 21-day lead time)
- Reorder quantity: ~30 units each = ~150 units total, estimated PO cost $4,800

**Class D (immediate action — $4,200 in tied capital):**
- Size 13 / Blue (0 sales in 90 days), Size 5 / Pink (0 sales), Size 14 / Gray (0 sales)
- Recommend markdown to cost + 10% = ~$35/pair
- Delist after clearing; do not reorder

**Merchandising change:** Move Black and White colorways to positions 1–2 in variant selector. Size 9 as default selected size (leads to fastest add-to-cart flow).

**Answer to your question:** Don't "trim" broadly — trim the 3 Class D variants, reduce reorder on 5 Class C, and invest the freed capital into deeper stock on Class A. Net result: same variant count but better sell-through and no stockout on winners.

---

## Example 2 — Edge case: best-selling size keeps stocking out but supplier has 45-day lead time

**User:** Our size 9 keeps selling out in our top 3 colors. We can't keep up with demand and the lead time from our supplier is 45 days. What do we do?

**Assistant:**
A 45-day lead time with a fast-selling variant creates a demand/supply timing gap. Here's the structured approach:

**Step 1 — Emergency reorder calculation:**
- Daily sales rate for Size 9 Black (last 30 days): e.g., 4 units/day
- Safety stock: 21 days × 4 units = 84 units
- Lead time buffer: 45 days × 4 units = 180 units
- Reorder point: current on-hand drops to 84 units → trigger order
- Reorder quantity: 180 + 84 = 264 units minimum per color

If you're already stocked out, order immediately and plan for a 45-day gap.

**Step 2 — Bridge the stockout period:**
- Add "Back in Stock" waitlist capture on the out-of-stock variant (Shopify: Back in Stock apps or native "Notify me" on out-of-stock)
- Email captured waitlist immediately when stock arrives — these are high-intent buyers
- Don't remove the listing from the store — keep it visible with "Notify Me" to retain demand signal

**Step 3 — Supplier negotiation:**
- 45-day lead time is manageable for stable demand but dangerous for fast-movers
- Request "floor stock" agreement: supplier holds 200 units of your top 3 variants at their warehouse, you call off within 7 days
- Or: explore a secondary supplier for emergency reorder (quality validation required)

**Step 4 — Price/demand management during scarcity:**
- If demand reliably exceeds supply, consider a modest price increase (5–10%) on Size 9 to extend sell-through period — this is preferable to stockouts
- Limit purchase quantity to 2 per customer order during low-stock periods

**Outcome target:** Zero stockout events on Class A variants within 60 days of implementing the reorder system.

---

## Routing Hints

- High return rates on footwear (fit/size complaints) → use **apparel-size-return-reducer**
- Product page conversion issues (customers viewing but not buying) → use **conversion-rate-optimizer**
- Inventory reorder planning with demand forecasting → use **inventory-reorder-calculator**
- Inventory health monitoring and auto-alerts → use **inventory-guardrail**
- Pricing and promotional strategy for clearance variants → use **promo-calendar-optimizer**

---

- Trigger condition: Triggered when the user explicitly requires the `footwear-variant-merchandiser` capability, or when managing footwear variant depth, size demand curves, or catalog rationalization.

## Missing Data Protocol

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (page scope, KPI baseline, or traffic context), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (page scope, KPI baseline, or traffic context), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the minimum missing inputs needed to avoid misleading advice.
- If the user cannot provide them, switch to checklist or hypothesis mode and label assumptions clearly.
- Do not convert rough estimates, benchmarks, or ranges into measured facts.
- End low-confidence outputs with the single most valuable next data request.

## Validation Loop

- Recheck: primary conversion KPI / friction signal / launch blocker count.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Recheck: primary conversion KPI / friction signal / launch blocker count.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Name the 1-3 core metrics or checkpoints to recheck after action.
- Give a review window that matches the cadence of the work.
- Define what improvement, no-change, and failure look like so the operator can close the loop.
- If the user has no analytics access, provide a manual validation checkpoint instead.

## Variant Audit Template

- Start with SKU, color, size, on-hand inventory, sell-through, and days since last sale.
- Use ABC classification to separate hero variants from slow-moving long-tail variants.
- If liquidation is recommended, note which channels can absorb volume without damaging flagship pricing.

## When to Use

- The request is fundamentally about listing, pricing, launch, or store-ops decisions, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Footwear Variant Merchandiser returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about listing, pricing, launch, or store-ops decisions, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Footwear Variant Merchandiser returns a clear verdict, deliverable set, and next-step list.
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

## Template Use

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.
