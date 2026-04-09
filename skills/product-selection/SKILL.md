---
name: "Product Selection"
description: >-
  Comprehensive product selection with industry analysis. Use when the team
  needs a diagnosis, ranking, or audit before changing execution.
status: enabled
layer: ecommerce
sub_layer: store-ops
---
# Product Selection

Comprehensive **product selection workflow** with evidence-first methodology. Guides you through industry analysis, consumer research, product discovery, and supplier matching based on user's starting point.

## When to Use

- The request is fundamentally about listing, pricing, launch, or store-ops decisions, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Product Selection returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about listing, pricing, launch, or store-ops decisions, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Product Selection returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- User wants **product selection**, **trending products**, **category analysis**, or **follow-sell opportunities**
- Questions like: "what to sell", "which products are trending", "how to choose a category", "find hot products for [market]"
- Coordinates with `product-supplier-sourcing` skill for concrete product/supplier retrieval

---

## Execution Flow

| User's Starting Point | Action |
|----------------------|--------|
| **No industry specified** | Start from **Step 1** (Industry Research) + **Step 2** (Consumer Research) then Step 3 |
| **Industry specified, no specific category** | Start from **Step 2** (Consumer Research) then Step 3 |
| **Industry + Category specified** | Jump to **Step 3** (Product Selection) |
| **Product(s) identified + supplier request** | Execute **Step 4** (Supplier Matching) — only when explicitly requested |

**Key Rules**:
- Step 2 (consumer research) is critical for category selection within an industry — skip only if user specifies both industry AND specific category
- Step 4 (supplier) runs **ONLY** when user explicitly mentions "supplier", "factory", "manufacturer", or "sourcing"

---

## Core Principles

1. **User intent overrides skill**: Follow user's specific requirements even if they differ from this guide
2. **Evidence first**: Every conclusion needs data support; cite sources and methods
3. **Multi-source validation**: Use >=2 data source types for trend/industry conclusions
4. **Explicit data gaps**: State what data is missing instead of guessing

---

## Step 1: Industry Research

**Trigger**: User has NOT specified industry/category.

### Selection Criteria (priority order)

| Criterion | What to Look For |
|-----------|-----------------|
| **Traffic trend** | Growing traffic (faster than sales growth = room for new sellers) |
| **Sales trend** | Increasing sales volume/GMV |
| **Competition intensity** | Low concentration (no monopoly by top 10 sellers) |
| **New listing rate** | Moderate (10-20% annually) |
| **Compliance** | No policy/legal restrictions |

### Data Sources

| Dimension | Tools/Sources |
|-----------|--------------|
| Traffic trends | SimilarWeb, Jungle Scout, Helium 10 |
| Sales trends | Amazon Brand Analytics, ecommerceDB, Statista |
| Concentration | Manual calculation from marketplace data |
| New listings | Platform analytics (Seller Central insights) |

**Output Format**:
```
Industry: [Category Name]
Conclusion: [Promising/Not Recommended]
Evidence:
  - Traffic: [Trend data + source]
  - Sales: [Trend data + source]
  - Concentration: [Top 10 share + source]
  - New listings: [Rate + source]
Data Gaps: [List any missing data points]
```

---

## Step 2: Consumer Research

**Trigger**: Required when industry is not pre-specified, OR when industry is specified but specific product category is not.

**Goal**: Identify consumer pain points, unmet needs, and product opportunities.

### Research Method

1. **Extract complaints/needs** from: e-commerce reviews (Amazon, eBay, Walmart), social discussions (Reddit, Facebook groups, TikTok), Q&A platforms (Quora, forums), app reviews
2. **Use specialized skills**: `review-summarizer` for scraping/summarization, `review-analyst-agent` for deep analysis with priority matrix
3. **Categorize pain points**: Quality issues, design/functionality gaps, price sensitivity, delivery/service problems, safety/compliance concerns
4. **Map to product opportunities**: Improvement, gap-filling, differentiation, follow-sell

### When to Use Each Skill

| Scenario | Skill | Why |
|----------|-------|-----|
| Quick review summary for 1-2 products | `review-summarizer` | Fast scraping + basic sentiment |
| Deep analysis for category selection | `review-analyst-agent` | Structured output with priority matrix |
| Multi-platform comparison | `review-summarizer` | Supports Amazon, Google, Yelp, TripAdvisor |
| Competitor pain point analysis | `review-analyst-agent` | Identifies improvement opportunities |

**Output Format**:
```
### Consumer Research Summary

**Sources Analyzed**: [Platform]: [Number] reviews/posts

**Top Pain Points** (by frequency):
1. [Pain Point] — Frequency: [X]%
   - Severity: [High/Medium/Low]
   - Product Category Opportunity: [Category]
   - Product Direction: [How to address]

**Feature Requests**: [Request] — [X] mentions

**Recommended Categories for Step 3**:
1. [Category] — Addresses pain points: [#1, #3]
```

---

## Step 3: Product Selection

**Trigger**: Industry specified OR after completing Steps 1-2.

### Approach 1: E-commerce Platform Analysis

**Target**: Products with proven demand but manageable competition.

**Selection Logic**:
- Sweet spot: BSR rank 100-5,000 (varies by category)
- Avoid: Top 20 (too competitive), BSR > 10,000 (uncertain demand)
- Check: Review count (300-1,000 = validated), rating (4.0-4.5 = room for improvement)

**Tools**: Amazon Best Sellers, Jungle Scout / Helium 10, Kalodata (TikTok Shop), 1688.com (supply chain reference)

**Steps**:
1. Filter category by Step 1/2 criteria
2. Export products in target BSR range
3. **Competitive analysis** (use `competitive-landscape` + `review-analyst-agent` to find competitor weaknesses)
4. Calculate: Estimated sales x margin - fees = profit
5. Rank by: (Profit potential x Demand validation x Differentiation feasibility) / Competition level

### Approach 2: Advertising & Traffic Analysis

**Target**: Products with strong recent marketing momentum.

**Selection Logic**: Ad frequency >=10 times in past 30 days, high engagement, launched within past 6 months.

**Tools**: Pipiads (TikTok ads), Minea (Meta/TikTok/Pinterest ads), Google Trends

**Steps**:
1. Search category keywords in ad intelligence tools
2. Filter: 10+ appearances in past 30 days, engagement rate > 5%
3. Cross-check with `product_supplier_search` (intent_type=product)
4. Validate on destination marketplace (check saturation)

### Approach 3: Crowdfunding Signal Mining

**Target**: Innovative products for early follow-sell or white-label.

**Selection Logic**: Funding 200-500% of goal, backer count 500-5,000, projects ending in 1-3 months.

**Platforms**: Kickstarter / Indiegogo

**Caution**: High risk (crowdfunding success != marketplace success), check for patents, expect 6-12 month sourcing cycle. Only for users with product development capability.

---

## Step 4: Supplier Matching

**CRITICAL**: Execute ONLY when user explicitly requests suppliers/factories/manufacturers/sourcing.

### Matching Process

1. **Prepare product specs**: Product name/category, key features, target price, MOQ constraints
2. **Search suppliers**:
   - **Primary**: Call `product_supplier_search` (intent_type=supplier, query in English) — searches **alibaba.com**
   - **Secondary**: 1688.com, Made-in-China, Global Sources, direct factory outreach
3. **Qualification**: Trade assurance/verified, MOQ match, production capacity, sample policy, responsiveness

**Output Format**:
```
Product: [Name from Step 3]
Target Specs: [Key features/requirements]

Supplier 1: **[Company name](https://alibaba.com/company/...)**
  MOQ: [Quantity + price] | Lead time: [Days]
  Qualification: [Verified/Trade Assurance/Years]

Next Steps: Request samples from top 2-3, compare quality/pricing, negotiate terms
```

**Visual Presentation**: Include product thumbnails (`<img src="..." width="80">`), verify image URLs, make all product/supplier names clickable links.

---

## Selecting the Right Approach

| User Goal | Approach | Required Skills |
|-----------|----------|-----------------|
| Quick follow-sell (low risk) | Approach 1 | `review-analyst-agent` |
| Trend-driven (fast-moving) | Approach 2 | — |
| Innovation/differentiation | Approach 3 | — |
| Brand building | Approach 1 + 2 | `review-analyst-agent` + `competitive-landscape` |
| Gap-filling | Approach 1 + Step 2 emphasis | `review-analyst-agent` (critical) |

**Default**: If user doesn't specify, recommend **Approach 1** (lowest risk).

---

## Tool Integration

### Using `product_supplier_search`

**Step 3**: `intent_type: "product"`, `query: "[product] [attributes]"` (English)
**Step 4**: `intent_type: "supplier"`, `query: "[category] [region]"` (English)

This tool searches **alibaba.com only**. For other platforms, see `product-supplier-sourcing` skill.

### Output Requirements

- **Thumbnails**: `<img src="..." width="80">`, check URL validity, use `[No Image]` if unavailable
- **Clickable links**: `[Product Name](link)`, `[Supplier Name](link)`, `[View Details](link)`
- **Table format**: `| Thumbnail | Product | Price | MOQ | Supplier | Link |`
- Never display broken image links or exceed `width="150"` in tables

---

## Output Structure

```markdown
## 1. Selection Scope
- Market / Category / Goal / Supplier required: [Yes/No]

## 2. Industry Analysis (if Step 1)
- Traffic/Sales/Competition/New listings trends with sources
- Conclusion and data gaps

## 3. Consumer Insights (if Step 2)
- Sources analyzed, skills used
- Top pain points (frequency, severity, product opportunity)
- Feature requests, recommended categories

## 4. Product Candidates (Step 3 - REQUIRED)
- Approach used, competitive landscape
- Product table with thumbnails and links
- Top 3 recommendations with reasoning
- Risk notes

## 5. Supplier Options (only if Step 4)

## 6. Next Steps
```

### Citation Requirements

Every conclusion must include: **Data source**, **Timeframe**, **Method**.
Example: "This product has 150% sales growth in past 30 days (Source: Jungle Scout, accessed 2024-03-07)"

---

## Validation Checklist

- [ ] Starting point determined correctly per Execution Flow
- [ ] Step 2 executed when needed (unless user provides both industry AND category)
- [ ] Step 4 ONLY if user explicitly requested suppliers
- [ ] All conclusions have data sources cited (>=2 sources for trends)
- [ ] Data gaps explicitly stated, quantitative criteria used
- [ ] Risk factors mentioned, actionable next steps provided
- [ ] Product thumbnails included (`width="80"`), image URLs validated, all names are clickable links

---

## Common Pitfalls

- Don't skip Step 2 when user only specifies industry
- Don't run Step 4 when user only asked for "products"
- Don't state trends without data or recommend products without analyzing competitor weaknesses
- Always include thumbnails and clickable links; verify image URLs

---

## Dependencies

- **`product-supplier-sourcing`**: Provides `product_supplier_search` tool (alibaba.com)
- **`review-summarizer`**: Multi-platform review scraping and summarization
- **`review-analyst-agent`**: Deep review analysis with priority matrix
- **`competitive-landscape`**: Porter's Five Forces, positioning maps
- **`chart-design-guide.md`** (optional): For visualizing trends when sufficient data collected

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

- Separate observed facts, user-provided facts, and assumptions.
- Do not invent exact numbers, specs, claims, certifications, or outcomes that were not provided or verified.
- Prefer the shortest useful answer shape that an operator can actually hand off.
- Do not over-generalize from one screenshot, one SKU, one creator, or one time window.
- Keep the top 3-5 actions only; backlog items belong in a secondary list.

## Missing Data Protocol

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (page scope, KPI baseline, or traffic context), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (page scope, KPI baseline, or traffic context), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

## Validation Loop

- Recheck: primary conversion KPI / friction signal / launch blocker count.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Recheck: primary conversion KPI / friction signal / launch blocker count.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

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

## Template Use

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.
