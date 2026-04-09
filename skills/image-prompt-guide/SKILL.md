---
name: "Image Prompt Guide"
description: >-
  Construct high-quality prompts for AI image generation and editing. Use when
  user asks to generate product images, write image prompts, or edit AI photos.
status: enabled
layer: ecommerce
sub_layer: store-ops
---
# Image Prompt Guide

A specification for constructing high-quality prompts for AI image generation and editing tools.

## Spec Definition

### Golden Rules

| Rule | Description |
|------|-------------|
| **Edit, Don't Re-roll** | If 80% correct, modify conversationally instead of regenerating |
| **Natural Language** | Use complete sentences, not keyword stacking |
| **Be Specific** | Define subject, environment, lighting, mood explicitly |
| **Provide Context** | Include "why" or "for whom" to guide artistic decisions |
| **Structured Elements** | Treat prompts as design briefs with clear components |
| **Avoid Brand Infringement** | Unless explicitly requested by user, avoid including recognizable brand logos, brand names, or trademarked elements to prevent copyright/trademark issues |

### Prompt Structure Formula

```
[Shot type] of [Subject] in [Setting], [Action/State]. 
[Style], [Composition], [Lighting], [Color], [Quality].
```

### Required Elements

| Element | Description | Examples |
|---------|-------------|----------|
| **Subject** | What to draw (be specific) | "ginger tabby cat", "ergonomic wireless headphones" |
| **Setting** | Where is the subject | "windowsill bathed in afternoon sunlight" |
| **Style** | Overall feeling | "cinematic", "watercolor", "minimalist" |
| **Composition** | Camera placement | "close-up", "wide-angle", "rule-of-thirds" |
| **Lighting** | Light source and mood | "golden hour", "soft diffused", "Rembrandt lighting" |
| **Color** | Color palette | "Morandi palette", "high saturation", "monochromatic" |
| **Quality** | Detail level | "8K", "hyperrealistic", "masterpiece" |

## How to Use

### For Image Generation (No Reference)

Construct comprehensive prompts covering:
- **Core Elements**: Subject or product features
- **Design Philosophy**: Minimalist, luxurious, eco-friendly, futuristic
- **Setting**: Studio lighting, natural environment, lifestyle context
- **Artistic Style**: Modern, vintage, industrial, organic
- **Visual Effects**: Textures, lighting, materials, color schemes
- **Text**: Use quotes for exact text: `"Display 'LIMITED EDITION' in bold serif"`
- **Resolution**: Request 2K/4K for texture-heavy or print materials

**Note on Brand Safety**: When constructing prompts, avoid including recognizable brand logos, brand names, or trademarked visual elements unless the user explicitly requests them. This helps prevent copyright/trademark infringement issues.

### For Image Editing (With Reference)

Use **semantic instructions**—describe changes naturally:

| Action Type | Examples |
|-------------|----------|
| **Core** | Add, Change, Remove, Replace, Make |
| **Creative** | Restore, Colorize, Illustrate as, Retexture |
| **Compositional** | Combine, Isolate, Zoom out, Blur, Overlay |
| **Dimensional** | Convert 2D to 3D, Convert sketch to render |

## Common Scenarios

This guide applies to various image generation scenarios:

- **Product Photography**: E-commerce shots, lifestyle context, studio lighting
- **Logo Design**: Brand identity, wordmarks, icons (see Advanced References for detailed guidance)
- **Marketing Materials**: Posters, banners, social media graphics
- **Character & Illustration**: Stickers, icons, character design, concept art
- **Scene & Environment**: Backgrounds, landscapes, interior design visualizations
- **Image Editing**: Background changes, object removal, style transfers

## Anti-Patterns

| Avoid ❌ | Why | Better ✅ |
|---------|-----|-----------|
| "beautiful design" | Too vague | Describe specific elements |
| "high quality" | Non-visual | Describe textures, materials, lighting |
| "professional look" | Subjective | Reference specific brands or contexts |
| "make it pop" | Meaningless | Specify contrast, saturation, or focal emphasis |
| Tag stacking | Model understands intent | Use natural sentences |
| Including brand logos/names without user request | Copyright/trademark infringement risk | Use generic descriptions or style references: "minimalist tech aesthetic" instead of "Apple logo" |

## Next Steps

For detailed guidance:
- Design aesthetics enhancement → See `## Design Aesthetics` below
- Material & texture precision → See `## Materials` below
- Brand/style anchoring → See `## Brand References` below

---

## Design Aesthetics

### Atmosphere & Mood Keywords
serene, contemplative, ethereal, intimate, bold, sophisticated, melancholic, uplifting, mysterious, tranquil, wistful, inviting, dramatic, peaceful, energetic, nostalgic, whimsical, elegant, cozy, minimalist

### Composition Principles

| Principle | Prompt Keywords |
|-----------|----------------|
| Negative Space | "generous negative space", "breathing room around subject" |
| Rule of Thirds | "subject positioned at rule-of-thirds intersection" |
| Visual Hierarchy | "clear visual hierarchy with X as focal point" |
| Leading Lines | "leading lines drawing eye toward subject" |

### Lighting Quality

| Basic ❌ | Professional ✅ |
|----------|----------------|
| "bright light" | "diffused golden hour light with soft rim lighting" |
| "dark background" | "deep shadows with subtle gradient falloff" |
| "natural light" | "north-facing window light, soft and directional" |

## Materials

| Generic ❌ | Precise ✅ |
|-----------|-----------|
| "metal finish" | "brushed titanium with subtle anodized reflections" |
| "glass bottle" | "frosted borosilicate glass with soft-touch matte coating" |
| "leather" | "vegetable-tanned full-grain leather with natural patina" |
| "wood" | "live-edge walnut with hand-rubbed oil finish" |

## Brand References

| Category | Reference Brands |
|----------|-----------------|
| Beauty/Skincare | SK-II, Aesop, La Mer |
| Tech/Electronics | Apple, Bang & Olufsen, Nothing Phone |
| Lifestyle | Kinfolk magazine, Cereal magazine, Monocle |
| Luxury/Fashion | Hermès, Bottega Veneta, Muji |

**Usage**: "Overall aesthetic inspired by [Brand] advertising style"

**Note**: When referencing brand styles, focus on describing aesthetic qualities (minimalist, luxurious, etc.) rather than including actual brand logos, brand names, or trademarked elements. Only include recognizable brand elements if the user explicitly requests them.

## When to Use

- The request is fundamentally about scripts, briefs, video/image production, or source-to-content workflows, and the operator needs a copy-ready draft, reusable brief, or structured handoff output.
- The team could take action immediately if Image Prompt Guide returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about scripts, briefs, video/image production, or source-to-content workflows, and the operator needs a copy-ready draft, reusable brief, or structured handoff output.
- The team could take action immediately if Image Prompt Guide returns a clear verdict, deliverable set, and next-step list.
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

## Success Metrics

- the draft is immediately reusable by the next owner
- proof and CTA are explicit
- format risk or compliance risk is flagged before publish

- the draft is immediately reusable by the next owner
- proof and CTA are explicit
- format risk or compliance risk is flagged before publish

- the draft is immediately reusable by the next owner
- proof and CTA are explicit
- format risk or compliance risk is flagged before publish

- the draft is immediately reusable by the next owner
- proof and CTA are explicit
- format risk or compliance risk is flagged before publish
