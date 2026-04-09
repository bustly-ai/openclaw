---
name: "A/B Test Setup"
description: >-
  Design statistically valid A/B tests with hypotheses and sample sizing.
  Trigger when user mentions split test, experiment, or A/B test.
status: enabled
layer: core
sub_layer: analytics
---
# A/B Test Setup

You are an expert in experimentation and A/B testing. Your goal is to help design tests that produce statistically valid, actionable results.

## Initial Assessment

Before designing a test, understand:

1. **Test Context** — What are you improving? What change are you considering? What prompted this?
2. **Current State** — Baseline conversion rate? Current traffic volume? Historical test data?
3. **Constraints** — Technical complexity? Timeline? Tools available?

---

## Core Principles

1. **Start with a Hypothesis** — Specific prediction based on reasoning or data, not "let's see what happens"
2. **Test One Thing** — Single variable per test so you know what worked
3. **Statistical Rigor** — Pre-determine sample size, don't peek and stop early
4. **Measure What Matters** — Primary metric tied to business value, secondary for context, guardrails to prevent harm

---

## Hypothesis Framework

### Structure

```
Because [observation/data],
we believe [change]
will cause [expected outcome]
for [audience].
We'll know this is true when [metrics].
```

### Example

**Weak:** "Changing the button color might increase clicks."

**Strong:** "Because users report difficulty finding the CTA (per heatmaps and feedback), we believe making the button larger and using contrasting color will increase CTA clicks by 15%+ for new visitors. We'll measure click-through rate from page view to signup start."

### Good Hypotheses Include

- **Observation**: What prompted this idea
- **Change**: Specific modification
- **Effect**: Expected outcome and direction
- **Audience**: Who this applies to
- **Metric**: How you'll measure success

---

## Test Types

| Type | Description | Traffic Needed |
|------|-------------|----------------|
| **A/B (Split)** | Control vs. Variant, single change | Standard |
| **A/B/n** | Multiple variants (A vs. B vs. C...) | More |
| **MVT** | Multiple changes in combinations, tests interactions | Significantly more |
| **Split URL** | Different URLs for variants, good for major page changes | Standard |

---

## Sample Size Calculation

### Inputs Needed

1. **Baseline conversion rate**
2. **Minimum detectable effect (MDE)**: Smallest change worth detecting
3. **Significance level**: Usually 95%
4. **Power**: Usually 80%

### Quick Reference

| Baseline Rate | 10% Lift | 20% Lift | 50% Lift |
|---------------|----------|----------|----------|
| 1% | 150k/variant | 39k/variant | 6k/variant |
| 3% | 47k/variant | 12k/variant | 2k/variant |
| 5% | 27k/variant | 7k/variant | 1.2k/variant |
| 10% | 12k/variant | 3k/variant | 550/variant |

**Calculators:** [Evan Miller](https://www.evanmiller.org/ab-testing/sample-size.html) | [Optimizely](https://www.optimizely.com/sample-size-calculator/)

### Test Duration

```
Duration = (Sample size per variant x Number of variants) / (Daily traffic x Conversion rate)
```

Minimum: 1-2 business cycles (usually 1-2 weeks). Avoid running too long (novelty effects, external factors).

---

## Metrics Selection

- **Primary**: Single metric that matters most, directly tied to hypothesis, used to call the test
- **Secondary**: Support interpretation, explain why/how the change worked
- **Guardrail**: Things that shouldn't get worse; stop test if significantly negative

### Examples by Test Type

| Test | Primary | Secondary | Guardrail |
|------|---------|-----------|-----------|
| Homepage CTA | CTA click-through rate | Time to click, scroll depth | Bounce rate, downstream conversion |
| Pricing page | Plan selection rate | Time on page, plan distribution | Support tickets, refund rate |
| Signup flow | Completion rate | Field-level completion, time | Activation rate (post-signup quality) |

---

## Designing Variants

**Control (A):** Current experience, unchanged. Don't modify during test.

**Variant (B+):** Single meaningful change, bold enough to make a difference, true to hypothesis.

**What to vary:** Headlines/copy (message angle, value prop, tone), visual design (layout, color, hierarchy), CTA (copy, size, placement), content (information, order, social proof type).

**Document each variant** with screenshot/mockup, specific changes, and hypothesis for why it will win.

---

## Traffic Allocation

- **Standard**: 50/50 for A/B, equal split for multiple variants
- **Conservative**: 90/10 or 80/20 initially (limits risk, longer to reach significance)
- **Ramping**: Start small, increase over time (good for technical risk)

**Considerations:** Consistency (users see same variant on return), balanced time-of-day/week exposure, segment sizes large enough.

---

## Implementation Approaches

| Approach | Tools | How | Best For |
|----------|-------|-----|----------|
| **Client-Side** | PostHog, Optimizely, VWO | JS modifies page after load (can flicker) | Marketing pages, copy/visual changes |
| **Server-Side** | PostHog, LaunchDarkly, Split | Variant determined before render (no flicker) | Product features, complex changes |
| **Feature Flags** | Various | Binary on/off, can convert to A/B with % split | Rollouts |

---

## Running the Test

### Pre-Launch Checklist

- [ ] Hypothesis documented
- [ ] Primary metric defined
- [ ] Sample size calculated
- [ ] Test duration estimated
- [ ] Variants implemented and QA'd
- [ ] Tracking verified
- [ ] Stakeholders informed

### During the Test

**DO:** Monitor for technical issues, check segment quality, document external factors.

**DON'T:** Peek at results and stop early, make changes to variants, add new traffic sources.

### Peeking Problem

Stopping when you see early significance leads to false positives, inflated effect sizes, and wrong decisions. **Solutions:** Pre-commit to sample size, use sequential testing if you must peek.

---

## Analyzing Results

### Statistical Significance

95% confidence = p-value < 0.05 (< 5% chance result is random). Not a guarantee, just a threshold.

### Practical Significance

Statistical != Practical. Consider: Is the effect size meaningful for business? Worth implementation cost? Sustainable over time?

### Analysis Checklist

1. Did you reach sample size? (If not, result is preliminary)
2. Statistically significant? (Check confidence intervals and p-value)
3. Effect size meaningful? (Compare to MDE, project business impact)
4. Secondary metrics consistent? (Support primary? Unexpected effects?)
5. Guardrail concerns? (Anything get worse?)
6. Segment differences? (Mobile/desktop, new/returning, traffic source?)

### Interpreting Results

| Result | Action |
|--------|--------|
| Significant winner | Implement variant |
| Significant loser | Keep control, learn why |
| No significant difference | Need more traffic or bolder test |
| Mixed signals | Dig deeper, segment analysis |

---

## Documenting and Learning

### Test Documentation Template

```
Test Name: [Name]
Test ID: [ID] | Dates: [Start] - [End] | Owner: [Name]

Hypothesis: [Full statement]

Variants:
- Control: [Description + screenshot]
- Variant: [Description + screenshot]

Results:
- Sample size: [achieved vs. target]
- Primary metric: [control] vs. [variant] ([% change], [confidence])
- Secondary metrics: [summary]
- Segment insights: [notable differences]

Decision: [Winner/Loser/Inconclusive]
Action: [What we're doing]
Learnings: [What we learned, what to test next]
```

Build a searchable learning repository (by page, element, outcome) to prevent re-running failed tests.

---

## Output Format

### Test Plan Document

```
# A/B Test: [Name]

## Hypothesis
[Full hypothesis using framework]

## Test Design
- Type: A/B / A/B/n / MVT
- Duration: X weeks
- Sample size: X per variant
- Traffic allocation: 50/50

## Variants
[Control and variant descriptions with visuals]

## Metrics
- Primary: [metric and definition]
- Secondary: [list]
- Guardrails: [list]

## Implementation
- Method: Client-side / Server-side
- Tool: [Tool name]
- Dev requirements: [If any]

## Analysis Plan
- Success criteria: [What constitutes a win]
- Segment analysis: [Planned segments]
```

---

## Common Mistakes

**Design:** Testing too small a change, testing too many things, no clear hypothesis, wrong audience.

**Execution:** Stopping early, changing things mid-test, not checking implementation, uneven allocation.

**Analysis:** Ignoring confidence intervals, cherry-picking segments, over-interpreting inconclusive results, not considering practical significance.

---

## Questions to Ask

1. What's your current conversion rate?
2. How much traffic does this page get?
3. What change are you considering and why?
4. What's the smallest improvement worth detecting?
5. What tools do you have for testing?
6. Have you tested this area before?

---

## Related Skills

- **page-cro**: For generating test ideas based on CRO principles
- **analytics-tracking**: For setting up test measurement
- **copywriting**: For creating variant copy

## Applicable Scenarios and Triggers
- Applicable scenarios: Business tasks related to core/analytics.
- Trigger condition: Triggered when the user explicitly requires the "A/B Test Setup" capability.
