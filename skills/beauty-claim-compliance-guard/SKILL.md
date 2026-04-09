---
name: "Beauty Claim Compliance Guard"
description: >-
  Audit beauty and skincare product claims for regulatory compliance across FDA
  (US), EU Cosmetics Regulation, and China NMPA. Use when launching new
  products, reviewing campaign copy, checking ingredient language, or auditing
  any beauty listing before it goes live.
status: enabled
trigger: >-
  Activate for beauty/skincare launches, campaign copy reviews, ingredient claim
  checks, or any beauty listing going live across US/EU/CN markets.
cooldown: 0
layer: ecommerce
sub_layer: beauty
---
# Beauty Claim Compliance Guard

## Skill Card
- **Category:** Ecommerce / Beauty Regulatory
- **Core problem:** Beauty brands regularly cross the line between cosmetic claims (legal) and drug/therapeutic claims (regulated/illegal for cosmetics) — often unknowingly. Violations lead to platform takedowns, regulatory warning letters, customs holds, and brand credibility damage.
- **Best for:** New product launch copy review, campaign tagline audit, ingredient claim validation, multi-market expansion compliance check
- **Expected input:** Product description, ingredient list, claim copy (taglines, bullets, ads), target market(s)
- **Expected output:** Claim risk audit with severity ratings, compliant rewrite alternatives, market-specific approval status, high-risk term blacklist applied

---

## Before You Start

If the user hasn't provided these, ask:

1. **Product type:** Skincare / haircare / makeup / body care / supplement? (Supplements follow different rules than cosmetics)
2. **Claims to review:** Provide the exact copy — product description, bullets, taglines, ad copy
3. **Ingredient list:** Full INCI ingredient list (needed to flag ingredients with drug-claim implications)
4. **Target markets:** US only / EU / China / multiple? (Each has different rules — see market matrix below)
5. **Sales channels:** DTC, Amazon, TikTok Shop, physical retail? (Platforms may have stricter rules than regulations)
6. **Existing substantiation:** Do you have clinical studies, patch-test data, or dermatologist testing that can support claims?

---

## Workflow

1. Define the decision question, review window, and the one KPI or business signal that matters most.
2. Normalize the evidence into a compact table so facts, assumptions, and missing fields are separated.
3. Rank the gaps or options by business impact, reversibility, and confidence.
4. Convert the diagnosis into P0 / P1 / P2 actions tied to evidence, not generic best practices.
5. End with a validation loop so the operator knows exactly how to recheck if the fix worked.
6. Separate platform risk from legal / factual proof risk.

1. Define the decision question, review window, and the one KPI or business signal that matters most.
2. Normalize the evidence into a compact table so facts, assumptions, and missing fields are separated.
3. Rank the gaps or options by business impact, reversibility, and confidence.
4. Convert the diagnosis into P0 / P1 / P2 actions tied to evidence, not generic best practices.
5. End with a validation loop so the operator knows exactly how to recheck if the fix worked.
6. Separate platform risk from legal / factual proof risk.

### Step 1 — Claim Extraction & Categorization
- Extract every claim from the provided copy: product name claims, description claims, bullet claims, tagline claims
- Categorize each claim:
  - **Cosmetic claim (safe):** Describes appearance change only ("moisturizes skin," "adds shine," "visibly brightens")
  - **Drug claim (HIGH risk):** Implies physiological change, treatment, or cure ("repairs DNA," "reverses aging," "treats acne")
  - **Structure/function claim (MEDIUM risk — context-dependent):** References how skin functions ("stimulates collagen production," "increases cell turnover")
  - **Implied drug claim (MEDIUM risk):** Legal-sounding but implies therapeutic effect ("clinically proven," "dermatologist tested" without substantiation)

### Step 2 — High-Risk Term Blacklist Scan
Apply the following blacklist to all copy:

**🔴 HIGH RISK — Drug claims (avoid entirely in cosmetics):**

| Term/phrase | Risk reason | Compliant alternative |
|---|---|---|
| "Erase wrinkles" | Drug claim — implies structural change | "Visibly reduces the appearance of fine lines" |
| "Reverse aging" / "anti-aging" | Drug claim in some markets (CN) | "Helps skin look more youthful" |
| "Treat acne" | Drug claim (OTC drug in US) | "Helps reduce the appearance of blemishes" |
| "Heal" / "cure" / "repair" (skin) | Drug claims | "Help soothe," "comfort," "improve the look of" |
| "Rebuild collagen" | Drug claim — implies cellular mechanism | "Supports skin's natural radiance" |
| "Stimulates cell regeneration" | Drug claim | "Encourages a refreshed complexion" |
| "Reverse sun damage" | Drug claim / therapeutic | "Helps visibly brighten sun-exposed skin" |
| "Clinically proven to [specific result]" | Requires substantiation; FDA risk without docs | "Formulated with clinically tested ingredients" |
| "SPF 50+" without proper testing | Requires SPF testing documentation | Only claim SPF if properly substantiated |
| "Whitening" (in CN context) | Requires special functional cosmetic registration in China | "Brightening" or specific approved language |

**🟡 MEDIUM RISK — Requires substantiation or careful framing:**

| Term/phrase | Market risk | Guidance |
|---|---|---|
| "Dermatologist tested" | Needs proof of dermatologist involvement | OK if substantiated; note test outcome |
| "Hypoallergenic" | No legal definition (FDA); implies safety claim | Can use with patch-test documentation |
| "Non-comedogenic" | No legal standard | Can use; recommend patch test documentation |
| "Clinically tested" | Needs actual clinical test documentation | Document and keep on file |
| "Reduces inflammation" | Drug claim in US (anti-inflammatory = OTC drug category) | "Helps soothe the look of redness" |
| "Boosts collagen" | Structure/function — borderline | "Helps skin look firmer and more supple" |
| "UV protection" without SPF number | Requires testing | Add SPF number with proper substantiation |

### Step 3 — Market-Specific Regulatory Comparison

| Regulation | US (FDA) | EU (EC No 1223/2009) | China (NMPA) |
|---|---|---|---|
| **Framework** | FD&C Act — cosmetics vs. drug line | EU Cosmetics Regulation — cosmetics vs. medicinal products | Cosmetics Supervision & Administration Regulation (CSAR 2021) |
| **Drug claim test** | Does the product affect body structure/function? → Drug | Does it have pharmacological action? → Medicinal | Same principle; stricter enforcement |
| **Banned ingredients** | FDA prohibited list | EU Annex II (1,400+ banned substances); Annex III (restricted) | NMPA prohibited list (different from EU) |
| **"Anti-aging" claim** | Generally acceptable as cosmetic claim | Generally acceptable | ⚠️ Requires filing as "Special Cosmetic" — separate approval process |
| **Whitening/brightening** | "Brightening" acceptable; bleaching = drug | "Brightening" acceptable | "Whitening" (美白) = Special Cosmetic — requires separate NMPA registration |
| **Sunscreen** | OTC drug product — requires monograph compliance (SPF testing, active ingredient list) | Cosmetic; requires in-vitro/in-vivo testing; SPF labeled differently | Sunscreen = Special Cosmetic — requires NMPA registration |
| **Notification/registration** | No pre-market approval for cosmetics (except OTC drugs) | Responsible Person EU notification required before market | Regular cosmetic: filing; Special cosmetic (sunscreen, whitening, hair dye, perm, anti-hair loss, freckle removal): pre-market registration |
| **Ingredient labeling** | INCI names required | INCI names required | Chinese name + INCI required |
| **Claims substantiation** | FTC requires "competent and reliable scientific evidence" | Must be substantiated, proportionate, and verifiable | Stricter — claims must align with product's registered function |
| **Platform enforcement** | Amazon, TikTok have own policies often stricter than FDA | Similar — platforms self-police | Tmall, JD require filing certificates before listing |

### Step 4 — Claim Rewrite
For each flagged claim, produce:
- **Original claim** (exact quote)
- **Risk level:** HIGH / MEDIUM / LOW
- **Market risk:** Which markets are affected
- **Risk reason:** Why it's problematic
- **Compliant rewrite:** One or two alternatives that preserve marketing intent

### Step 5 — Ingredient-Claim Alignment Check
- Cross-reference ingredients with claimed benefits
- Flag ingredients that trigger drug-claim implications at certain concentrations:
  - Retinol > 1% = prescription territory in EU
  - Hydroquinone = banned in EU cosmetics; prescription in US; regulated in CN
  - AHAs > 10% at pH < 3.5 = drug-like penetration (FDA guidance)
  - Niacinamide — generally safe; avoid "treats hyperpigmentation" language
  - Salicylic acid — OTC acne drug active in US at ≥ 0.5%; cosmetic claim only at lower concentrations
- Confirm that claimed ingredients are actually on the INCI list (false ingredient claims = separate compliance issue)

### Step 6 — Compliance Report & Approval Package
- Produce market-specific approval status: Approved / Conditionally approved (rewrite needed) / Not approved (requires regulatory action)
- List substantiation documents needed for conditional claims
- Produce "approved copy pack" — the rewritten, compliant version of all reviewed copy
- Note: this skill provides guidance, not legal advice. For high-stakes markets (China NMPA registration, EU Responsible Person filing), recommend consulting a regulatory specialist.

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

1. **Executive Summary** (≤ 5 lines): overall risk level, number of HIGH/MEDIUM flags, go/no-go by market
2. **Claim Risk Audit Table** — every claim with risk level, market impact, and reason
3. **High-Risk Term Hit List** — exact matches from the blacklist found in the copy
4. **Market Approval Matrix** — US / EU / CN approval status for the product as submitted
5. **Compliant Rewrite Pack** — approved alternative copy for all flagged claims
6. **Ingredient-Claim Flags** — any ingredient-specific concerns
7. **Substantiation Checklist** — documents to prepare for conditional claims

---

## Quality and Safety Rules

- This skill provides compliance guidance, not legal advice — for formal regulatory submissions, recommend a specialist
- Never approve claims without knowing the target market — "safe in US" ≠ "safe in CN or EU"
- Don't fabricate substantiation — if a claim needs documentation, flag it clearly
- Distinguish between platform policy (Amazon, TikTok) and regulatory law — platform rules are often stricter
- Flag when an ingredient list contains restricted substances — don't assume safety

---

## Benchmark Targets

| Metric | Target |
|---|---|
| HIGH-risk claim flags in final approved copy | 0 |
| MEDIUM-risk claims with substantiation doc | 100% documented |
| Platform claim-related takedowns | 0 per quarter |
| Regulatory warning letters / notices | 0 |
| Copy review turnaround | Same session for standard review |
| China Special Cosmetic categories properly identified | 100% (sunscreen, whitening, anti-hair loss, freckle removal, hair dye, perm) |

---

## Example 1 — Vitamin C serum pre-launch copy review

**User:** Check this product description for our new vitamin C serum before we publish: "Clinically proven to erase wrinkles and reverse sun damage in 7 days."

**Assistant:**
**Compliance Audit — Vitamin C Serum (US/EU/CN)**

**Claim flags:**

| Claim | Risk | Markets | Reason | Compliant rewrite |
|---|---|---|---|---|
| "Clinically proven to erase wrinkles" | 🔴 HIGH | US, EU, CN | "Erase" = drug claim (implies structural change). "Clinically proven" requires substantiation. | "Formulated with Vitamin C to visibly improve the appearance of fine lines" |
| "Reverse sun damage" | 🔴 HIGH | US, EU, CN | "Reverse" implies therapeutic/medical action — treating UV damage is a drug claim | "Helps visibly brighten the look of sun-exposed skin" |
| "In 7 days" | 🟡 MEDIUM | All | Specific timeframe claim requires clinical evidence with that exact timeframe | Remove or change to "with consistent use" unless you have a 7-day clinical study |

**High-risk term hits:** "erase," "reverse," "clinically proven" (without docs)

**Market matrix:**
- 🇺🇸 **US (FDA):** Not approved as written. Drug claims could trigger FDA warning letter. Rewrite required.
- 🇪🇺 **EU:** Not compliant under EU Cosmetics Regulation — "reverse sun damage" implies medicinal product. Rewrite required.
- 🇨🇳 **CN (NMPA):** Not compliant. "Reverse sun damage" would classify this as a medicinal product. Vitamin C brightening claim requires documentation aligned with registration.

**Approved copy (US/EU):**
"Formulated with stabilized Vitamin C to help visibly improve skin texture, brighten the appearance of dark spots, and support a more luminous complexion with consistent use."

**Substantiation needed:**
- Clinical or consumer use study supporting the visible improvement claim
- If restoring "7 days" claim: provide IRB-approved clinical study with that specific timeframe

---

## Example 2 — Edge case: entering China market with existing US-approved whitening product

**User:** We have a brightening serum that sells well in the US with the claim "brightens and evens skin tone." We want to launch on Tmall. What do we need to change?

**Assistant:**
**China Market Compliance Assessment — Brightening Serum**

**⚠️ Critical finding: Your product is likely a "Special Cosmetic" in China — this requires NMPA pre-market registration, not just a standard filing.**

**Why:**
Under China's CSAR 2021, "whitening/brightening" (美白/提亮) products fall under the "freckle removal and skin whitening" Special Cosmetic category. This requires:
1. Pre-market registration with NMPA (not just notification)
2. Safety assessment by a NMPA-approved testing institution in China
3. Efficacy testing documentation
4. The registration process typically takes 6–12 months
5. Tmall and JD.D require the registration certificate (备案凭证 or 注册证) before listing

**Claim translation risk:**
- "Brightens and evens skin tone" → If translated as "美白均匀肤色," this triggers the Special Cosmetic classification
- If translated more conservatively as "改善肤色光泽" (improves skin radiance/luminosity), it may qualify as a regular cosmetic — but NMPA reviewers assess the actual product function, not just word choice

**Ingredient check required:**
- Does your formula contain niacinamide, kojic acid, arbutin, tranexamic acid, or other recognized brightening actives?
- These ingredients at functional concentrations will trigger the Special Cosmetic review regardless of claim language

**Recommended path for China launch:**
1. Engage a China regulatory consultant or NMPA-registered agent
2. Conduct product safety assessment in a China-approved lab
3. Submit Special Cosmetic registration (美白特殊化妆品注册)
4. Budget 6–12 months lead time before Tmall listing

**Alternative fast-path:**
If timeline is an issue, reformulate to remove whitening actives and file as a "regular cosmetic" (普通化妆品) with only brightening-by-hydration claims. This can be filed in 30–60 days.

**US copy is fine as-is** — "brightens and evens skin tone" does not trigger FDA concerns. No changes needed for US market.

---

## Routing Hints

- Product launch readiness beyond claims (inventory, ops, platform) → use **launch-readiness-checklist**
- Amazon listing copy optimization (including compliance-safe claims) → use **amz-product-optimizer**
- Ad creative copy compliance review for beauty ads → use **ad-creative-analysis**
- Customer review analysis revealing claim credibility issues → use **review-analysis**
- General ecommerce landing page compliance + CRO → use **ecommerce-landing-page-conversion-audit**

---

- Trigger condition: Triggered when the user explicitly requires the `beauty-claim-compliance-guard` capability, or when beauty/skincare copy needs compliance review before publishing or advertising.

## Missing Data Protocol

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (exact claim text, market, or proof status), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (exact claim text, market, or proof status), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the minimum missing inputs needed to avoid misleading advice.
- If the user cannot provide them, switch to checklist or hypothesis mode and label assumptions clearly.
- Do not convert rough estimates, benchmarks, or ranges into measured facts.
- End low-confidence outputs with the single most valuable next data request.

## Validation Loop

- Recheck: high-risk claim count / proof status / approval outcome.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Recheck: high-risk claim count / proof status / approval outcome.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Name the 1-3 core metrics or checkpoints to recheck after action.
- Give a review window that matches the cadence of the work.
- Define what improvement, no-change, and failure look like so the operator can close the loop.
- If the user has no analytics access, provide a manual validation checkpoint instead.

## High-Risk Claim Watchlist

- Escalate words that imply treatment, cure, hormone change, permanent effect, or medically guaranteed outcomes.
- If the user sells cross-border, note that US, EU, and CN compliance expectations can differ materially.
- When evidence is weak, rewrite toward cosmetic appearance or routine-support language instead of efficacy certainty.

## When to Use

- The request is fundamentally about claim, proof, or policy-sensitive messaging, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Beauty Claim Compliance Guard returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about claim, proof, or policy-sensitive messaging, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Beauty Claim Compliance Guard returns a clear verdict, deliverable set, and next-step list.
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

- exact claim text
- market / platform scope
- proof available today
- publish deadline
- baseline or benchmark expectation
- the evidence source to trust first

- exact claim text
- market / platform scope
- proof available today
- publish deadline
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
- claim risk level and required proof state

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- gap diagnosis or scorecard
- P0 / P1 / P2 action list
- confidence and evidence labels
- claim risk level and required proof state

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
