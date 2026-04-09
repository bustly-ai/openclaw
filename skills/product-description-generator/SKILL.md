---
name: "Product Description Generator"
description: >-
  Generate high-converting, SEO-optimized product descriptions for any
  e-commerce platform. Use when user asks to write product copy, listing, or
  description.
status: enabled
layer: ecommerce
sub_layer: store-ops
---
# Product Description Generator

## Overview

Generate high-converting, SEO-optimized product descriptions for any e-commerce platform. Create compelling copy that drives sales while improving search visibility across multiple marketplaces.

## Core Capabilities

### 1. Platform-Specific Optimization

**Supported Platforms:**
- **Amazon** - Title, bullet points, description, search terms, backend keywords
- **Shopify** - Product title, description, SEO meta data
- **eBay** - Item title, description, item specifics, condition description
- **Etsy** - Listing title, description, tags, materials, attributes
- **Shopify/WooCommerce** - Product name, description, SEO elements
- **Custom** - Flexible format for any platform

### 2. SEO Optimization

**Automatically includes:**
- Primary keyword placement (title, first paragraph)
- Secondary keywords throughout content
- Long-tail keyword variations
- Semantic keywords and related terms
- Optimized character counts for each platform
- Meta descriptions and titles for SEO

### 3. Conversion-Focused Copy

**Elements that drive sales:**
- Benefit-oriented features (not just specs)
- Emotional triggers and storytelling
- Social proof integration
- Urgency and scarcity elements
- Clear value propositions
- Strong calls-to-action
- Objection handling

### 4. Structure Templates

**Product description structure:**
1. **Hook** - Attention-grabbing opening
2. **Problem/Agitation** - Address pain points
3. **Solution** - How your product helps
4. **Features → Benefits** - What it does and why it matters
5. **Social Proof** - Reviews, testimonials, stats
6. **Use Cases** - When/how to use the product
7. **Specifications** - Technical details
8. **FAQ** - Common questions answered
9. **CTA** - Clear action to take

### 5. Bulk Generation

**Generate descriptions for:**
- Multiple products from CSV
- Product variations (colors, sizes, models)
- A/B testing variations
- Multiple platforms simultaneously
- International markets (localization)

## Quick Start

### Generate Amazon Listing

```python
# Use scripts/generate_description.py
python3 scripts/generate_description.py \
  --product "Wireless Bluetooth Headphones" \
  --platform amazon \
  --features "40hr battery,noise cancelling,Bluetooth 5.3" \
  --benefits "crystal clear audio,comfortable fit,fast charging" \
  --tone professional \
  --output amazon_listing.md
```

### Generate Shopify Product Description

```python
python3 scripts/generate_description.py \
  --product "Ergonomic Office Chair" \
  --platform shopify \
  --features "adjustable lumbar support,360° swivel,breathable mesh" \
  --tone conversational \
  --include-faq \
  --output shopify_description.md
```

### Bulk Generate from CSV

```python
# Use scripts/bulk_generate.py
python3 scripts/bulk_generate.py \
  --csv products.csv \
  --platform amazon \
  --output-dir ./descriptions
```

### Optimize Existing Description

```python
# Use scripts/optimize_description.py
python3 scripts/optimize_description.py \
  --input existing_description.md \
  --target-keyword "wireless headphones" \
  --platform amazon \
  --output optimized.md
```

## Scripts

### `generate_description.py`
Generate product description for a single product.

**Parameters:**
- `--product` (required): Product name/title
- `--platform` (required): Target platform
- `--features`: Product features (comma-separated)
- `--benefits`: Benefits/value proposition (comma-separated)
- `--tone`: Tone preference (professional, conversational, playful, luxury)
- `--target-audience`: Who is this for?
- `--keywords`: SEO keywords (comma-separated)
- `--include-faq`: Include FAQ section
- `--include-specs`: Include specifications section
- `--output`: Output file

**Example:**
```bash
python3 scripts/generate_description.py \
  --product "Smart WiFi Thermostat" \
  --platform amazon \
  --features "energy saving,app control,7-day programming" \
  --benefits "lower energy bills,remote access,comfort" \
  --target-audience "homeowners,smart home enthusiasts" \
  --keywords "smart thermostat,programmable thermostat,WiFi thermostat" \
  --include-faq \
  --include-specs \
  --output thermostat_description.md
```

### `bulk_generate.py`
Generate descriptions for multiple products from CSV.

**CSV Format:**
```csv
product,features,benefits,tone,target_audience,keywords
"Wireless Headphones","40hr battery,noise cancelling","clear audio,comfort","professional","audiophiles","headphones,bluetooth"
"Ergonomic Chair","lumbar support,mesh back","back pain relief,comfort","conversational","office workers","office chair,ergonomic"
"Smart Thermostat","energy saving,app control","lower bills,remote control","professional","homeowners","thermostat,smart home"
```

**Parameters:**
- `--csv`: Path to CSV file
- `--platform`: Target platform (applies to all products)
- `--output-dir`: Output directory
- `--format`: Output format (markdown, html, csv)

### `optimize_description.py`
Optimize an existing product description for SEO and conversions.

**Parameters:**
- `--input`: Input file path
- `--target-keyword`: Primary keyword to optimize for
- `--platform`: Target platform
- `add-cta`: Add strong call-to-action
- `add-social-proof`: Add social proof placeholders
- `output`: Output file

### `generate_variations.py`
Generate A/B testing variations of a description.

**Parameters:**
- `--input`: Base description file
- `--variations`: Number of variations to generate (default: 3)
- `--test-elements`: Elements to test (cta, hook, benefits)
- `--output-dir`: Output directory

### `seo_analyzer.py`
Analyze SEO score of product description.

**Parameters:**
- `--input`: Description to analyze
- `--target-keyword`: Primary keyword
- `--platform`: Platform-specific analysis
- `--output`: Analysis report

## Platform-Specific Guidelines

### Amazon
- **Title:** 150-200 characters, primary keyword first
- **Bullet Points:** 5-7 points, benefit-focused
- **Description:** 2000-3000 characters, full product story
- **Backend Keywords:** 250 bytes, comma-separated
- **Style:** Professional, informative, detailed

### Shopify
- **Title:** 70 characters for optimal display
- **Description:** 300-500 words, HTML supported
- **Meta Description:** 155 characters for SEO
- **Handle:** 75 characters max, SEO-friendly URL
- **Style:** Brand-consistent, visual, lifestyle-oriented

### eBay
- **Title:** 80 characters optimal, include key details
- **Description:** 500-1000 words, HTML allowed
- **Item Specifics:** Fill all relevant fields
- **Condition:** Clearly state condition
- **Style:** Auction-style urgency, detailed specs

### Etsy
- **Title:** 140 characters, front-load keywords
- **Description:** 500+ words, handmade story
- **Tags:** 13 tags, 20 characters each
- **Materials:** Accurate listing
- **Style:** Personal, story-driven, handmade emphasis

## Best Practices

### Write Benefits, Not Just Features
- **Bad:** "40-hour battery life"
- **Good:** "40-hour battery means you can listen for days without charging"

### Use Emotional Triggers
- "Transform your daily routine"
- "Experience the difference quality makes"
- "Join thousands of satisfied customers"

### Include Social Proof
- "Trusted by 10,000+ customers"
- "4.8/5 star average rating"
- "30-day money-back guarantee"

### Handle Objections
- "Worried about fit? We offer free returns"
- "Not sure? Try it risk-free for 30 days"
- "Questions? Our US-based support is here 24/7"

### Strong CTAs
- "Order now and get free shipping"
- "Limited stock - add to cart today"
- "Join the thousands who upgraded their experience"

## Tone Guidelines

### Professional
- **Best for:** B2B, tech products, high-ticket items
- **Characteristics:** Authoritative, data-driven, precise
- **Example:** "Engineered for performance. Backed by science."

### Conversational
- **Best for:** Consumer products, lifestyle items
- **Characteristics:** Friendly, relatable, personal
- **Example:** "You're going to love how this fits into your daily routine."

### Playful
- **Best for:** Trendy items, younger audiences
- **Characteristics:** Fun, energetic, emoji-friendly
- **Example:** "Ready to level up? Let's do this! 🚀"

### Luxury
- **Best for:** Premium products, jewelry, designer items
- **Characteristics:** Elegant, exclusive, sophisticated
- **Example:** "Experience unparalleled craftsmanship. A masterpiece of design."

## Automation

### Daily Bulk Generation

```bash
# Generate descriptions for all products in catalog
0 8 * * * /path/to/product-description-generator/scripts/bulk_generate.py \
  --csv /path/to/products.csv \
  --platform amazon \
  --output-dir /path/to/output
```

### A/B Testing Automation

```bash
# Generate variations for top-selling products
0 9 * * 1 /path/to/product-description-generator/scripts/generate_variations.py \
  --input /path/to/bestsellers/ \
  --variations 3 \
  --output-dir /path/to/ab-tests
```

## Integration Opportunities

### With SEO Article Generator
```bash
# 1. Generate SEO-optimized article
seo-article-gen --keyword "wireless headphones review"

# 2. Extract key benefits and features
# 3. Generate product description
product-description-generator --product "[name]" --features "[extracted]"
```

### With Review Summarizer
```bash
# 1. Analyze reviews for insights
review-summarizer/scrape_reviews.py --url "[product_url]"

# 2. Extract top pros/cons
# 3. Generate description addressing cons
product-description-generator --product "[name]" --benefits "[address cons]"
```

## Output Formats

### Markdown
Best for documentation, CMS without HTML support, easy reading.

### HTML
Best for Amazon, Shopify, eBay - formatted with tags.

### CSV
Best for bulk upload, catalog management systems.

---

**Drive sales. Rank higher. Convert visitors.**

## When to Use

- The request is fundamentally about scripts, briefs, video/image production, or source-to-content workflows, and the operator needs a copy-ready draft, reusable brief, or structured handoff output.
- The team could take action immediately if Product Description Generator returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about scripts, briefs, video/image production, or source-to-content workflows, and the operator needs a copy-ready draft, reusable brief, or structured handoff output.
- The team could take action immediately if Product Description Generator returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

## Do Not Use When

- Do not pretend a system mutation happened if the skill only has analysis or drafting context.
- Do not keep this skill active when the request clearly belongs to a narrower adjacent skill.
- Do not use this skill to invent product facts, legal claims, or performance data just to make the draft sound polished.
- Do not return vague brainstorm lists when a concrete output is required.

- Do not pretend a system mutation happened if the skill only has analysis or drafting context.
- Do not keep this skill active when the request clearly belongs to a narrower adjacent skill.
- Do not use this skill to invent product facts, legal claims, or performance data just to make the draft sound polished.
- Do not return vague brainstorm lists when a concrete output is required.

## Required Inputs

- source material or product facts
- target channel
- audience + CTA
- format constraints
- brand guardrails or forbidden claims
- any examples of acceptable output tone or format

- source material or product facts
- target channel
- audience + CTA
- format constraints
- brand guardrails or forbidden claims
- any examples of acceptable output tone or format

## Deliverables

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- copy-ready or operator-ready output
- QA checklist for claims / format
- handoff note for the next owner
- content-angle or asset-brief structure

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- copy-ready or operator-ready output
- QA checklist for claims / format
- handoff note for the next owner
- content-angle or asset-brief structure

## Workflow

1. Confirm the audience, channel, proof, and format guardrails before drafting anything.
2. Distill the raw inputs into the exact angles, must-say points, and do-not-say constraints.
3. Build the output in the target structure first, then fill the details instead of free-writing.
4. Add the final draft plus a short QA pass for claims, formatting, and missing proof.
5. End with what still needs verification, who should review it, and what to ship next.
6. Keep source extraction, creative logic, and output polish in separate passes.

1. Confirm the audience, channel, proof, and format guardrails before drafting anything.
2. Distill the raw inputs into the exact angles, must-say points, and do-not-say constraints.
3. Build the output in the target structure first, then fill the details instead of free-writing.
4. Add the final draft plus a short QA pass for claims, formatting, and missing proof.
5. End with what still needs verification, who should review it, and what to ship next.
6. Keep source extraction, creative logic, and output polish in separate passes.

## Output Format

1. Conclusion / verdict
2. Key evidence or context table
3. Priority actions or draft output
4. Risks / caveats / missing data
5. Recommended next steps

- Return the usable draft first, then a short QA checklist and any missing fact requests.

1. Conclusion / verdict
2. Key evidence or context table
3. Priority actions or draft output
4. Risks / caveats / missing data
5. Recommended next steps

- Return the usable draft first, then a short QA checklist and any missing fact requests.

## Boundary and Routing

- Keep this skill focused on draft output quality; route strategic diagnosis or system mutation to a narrower skill when needed.
- If the draft depends on missing proof, keep the claim conservative and ask for verification before publish.

- Keep this skill focused on draft output quality; route strategic diagnosis or system mutation to a narrower skill when needed.
- If the draft depends on missing proof, keep the claim conservative and ask for verification before publish.

## Quality Rules

- Separate observed facts, user-provided facts, and assumptions.
- Do not invent exact numbers, specs, claims, certifications, or outcomes that were not provided or verified.
- Prefer the shortest useful answer shape that an operator can actually hand off.
- Make the draft copy-ready or handoff-ready; do not stop at abstract principles.
- If proof is missing, downgrade the claim instead of fabricating supporting language.
- Keep hook, proof, CTA, and format constraints explicit rather than implied.

- Separate observed facts, user-provided facts, and assumptions.
- Do not invent exact numbers, specs, claims, certifications, or outcomes that were not provided or verified.
- Prefer the shortest useful answer shape that an operator can actually hand off.
- Make the draft copy-ready or handoff-ready; do not stop at abstract principles.
- If proof is missing, downgrade the claim instead of fabricating supporting language.
- Keep hook, proof, CTA, and format constraints explicit rather than implied.

## Missing Data Protocol

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (source asset, product facts, or channel format constraints), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (source asset, product facts, or channel format constraints), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

## Validation Loop

- Recheck: publish quality / engagement proxy / CTA completion / reuse readiness.
- Review window: after review, publish, or first usage in production.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Recheck: publish quality / engagement proxy / CTA completion / reuse readiness.
- Review window: after review, publish, or first usage in production.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

## Template Use

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.
