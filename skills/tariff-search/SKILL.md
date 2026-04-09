---
name: "Tariff Search"
description: >-
  Look up HS codes and calculate import tariff rates between countries. Trigger
  when user mentions tariff, HS code, duty rate, or import tax calculation. Use
  when the team needs a diagnosis, ranking, or audit before changing execution.
status: enabled
layer: ecommerce
sub_layer: supply-chain
---
# Tariff Search

A Python library for querying tariff classification and HS code information through the TurtleClassify RESTful API.

## Quick Reference

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `search_tariff(products)` | Product list | `[{hsCode, tariffRate, ...}]` | Batch tariff lookup |
| `search_tariff(products, return_type='detail')` | Product list | `{success, results, processing_time}` | With metadata |

### Required Input Fields

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| `originCountryCode` | ✓ | ISO country code | `'CN'` |
| `destinationCountryCode` | ✓ | ISO country code | `'US'` |
| `productName` | ✓ | Product name/title | `'Woman Dress'` |
| `digit` | Optional | HS code length (8/10) | `10` |

## How to Use

```python
import sys
import os
# Add the current skill directory to sys.path
skill_dir = os.path.dirname(os.path.abspath(__file__))
if skill_dir not in sys.path:
    sys.path.insert(0, skill_dir)
from script import TariffSearch

searcher = TariffSearch()

# Single product
products = [{
    'originCountryCode': 'CN',
    'destinationCountryCode': 'US',
    'productName': 'Woman Dress',
    'digit': 10,
}]
results = searcher.search_tariff(products)
# Returns: [{'hsCode': '62044340', 'tariffRate': 43.5, ...}]
```

## Examples

### Basic Usage

```python
# Query tariff for a single product
products = [{'originCountryCode': 'CN', 'destinationCountryCode': 'US', 'productName': 'Wireless Headphones'}]
results = searcher.search_tariff(products)
print(f"HS Code: {results[0]['hsCode']}, Tariff Rate: {results[0]['tariffRate']}%")
```

### Batch Processing with DataFrame

```python
import pandas as pd

df = pd.read_csv('products.csv')
products = [
    {'originCountryCode': 'CN', 'destinationCountryCode': 'US', 
     'digit': 10, 'productName': row['product_title']} 
    for _, row in df.iterrows()
]

results = searcher.search_tariff(products)

# Add to DataFrame (use title format for column names)
df['HS Code'] = [r.get('hsCode', 'N/A') for r in results]
df['Tariff Rate (%)'] = [r.get('tariffRate', 0) for r in results]
df['HS Description'] = [r.get('hsCodeDescription', '') for r in results]
df['Tariff Formula'] = [r.get('tariffFormula', '') for r in results]
df['Tariff Amount (Avg)'] = [r.get('tariffRate', 0) * df.loc[i, 'Average Price'] / 100 for i, r in enumerate(results)]
df['Landed Cost (Avg)'] = df['Average Price'] + df['Tariff Amount (Avg)']
df.to_csv('products_with_tariffs.csv', index=False)
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

```jsonc
{
    "hsCode": "61044200",                      // HS code (harmonized system code)
    "hsCodeDescription": "Women's or girls'...",  // HS code description in English
    "tariffRate": 39.0,                        // Total tariff rate (percentage)
    "tariffFormula": "一般关税[11.5%] + 附加关税[27.5%]",  // Tariff calculation formula
    "tariffCalculateType": "ByAmount",         // Calculation type (ByAmount/ByQuantity)
    "originCountryCode": "CN",                 // Origin country ISO code
    "destinationCountryCode": "US",            // Destination country ISO code
    "productName": "Woman Dress",              // Product name/title
    "calculationDetails": { ... }              // Full API response data
}
```

| Field | Type | Description |
|-------|------|-------------|
| `hsCode` | string | HS code (harmonized system classification code) |
| `hsCodeDescription` | string | English description of the HS code |
| `tariffRate` | number | Total tariff rate in percentage |
| `tariffFormula` | string | Formula showing how tariff is calculated |
| `tariffCalculateType` | string | Calculation method (e.g., ByAmount, ByQuantity) |
| `extendInfo` | string | Additional information from API |
| `originCountryCode` | string | ISO 3166-1 alpha-2 origin country code |
| `destinationCountryCode` | string | ISO 3166-1 alpha-2 destination country code |
| `productName` | string | Product name or title |
| `calculationDetails` | object | Complete raw API response data |

## Notes

- Maximum 100 products per request (auto-truncated)
- Concurrent processing: ~20 seconds for 100 products
- Column naming: Use `"HS Code"` not `"hsCode"` in CSV output
- Error codes: 200 (success), 20001 (validation failed), -1 (system error)

- Trigger condition: Triggered when the user explicitly requires the "Tariff Search" capability.

## When to Use

- The request is fundamentally about inventory, supplier, shipping-cost, or replenishment decisions, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Tariff Search returns a clear verdict, deliverable set, and next-step list.
- The user may describe the business problem without naming the skill; route semantically rather than by exact skill name.

- The request is fundamentally about inventory, supplier, shipping-cost, or replenishment decisions, and a decision depends on ranking evidence, diagnosing gaps, or prioritizing fixes.
- The team could take action immediately if Tariff Search returns a clear verdict, deliverable set, and next-step list.
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

- inventory / supplier snapshot
- demand or velocity signal
- lead time / MOQ / shipping constraint
- margin or stockout risk
- baseline or benchmark expectation
- the evidence source to trust first

- inventory / supplier snapshot
- demand or velocity signal
- lead time / MOQ / shipping constraint
- margin or stockout risk
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
- inventory / supplier decision table

- one-line verdict or executive summary
- priority-ranked actions or next decisions
- evidence or rationale table
- risks + next-step recommendations
- gap diagnosis or scorecard
- P0 / P1 / P2 action list
- confidence and evidence labels
- inventory / supplier decision table

## Workflow

1. Define the decision question, review window, and the one KPI or business signal that matters most.
2. Normalize the evidence into a compact table so facts, assumptions, and missing fields are separated.
3. Rank the gaps or options by business impact, reversibility, and confidence.
4. Convert the diagnosis into P0 / P1 / P2 actions tied to evidence, not generic best practices.
5. End with a validation loop so the operator knows exactly how to recheck if the fix worked.
6. Separate stockout prevention from inventory cleanup so the recommendation does not solve one problem by creating another.

1. Define the decision question, review window, and the one KPI or business signal that matters most.
2. Normalize the evidence into a compact table so facts, assumptions, and missing fields are separated.
3. Rank the gaps or options by business impact, reversibility, and confidence.
4. Convert the diagnosis into P0 / P1 / P2 actions tied to evidence, not generic best practices.
5. End with a validation loop so the operator knows exactly how to recheck if the fix worked.
6. Separate stockout prevention from inventory cleanup so the recommendation does not solve one problem by creating another.

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
- If the core blocker is missing (velocity, lead time, or current stock depth), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

- Ask for the smallest missing set that would change the recommendation materially.
- If the core blocker is missing (velocity, lead time, or current stock depth), stop short of a hard verdict and ask for it explicitly.
- If only secondary inputs are missing, continue in checklist or hypothesis mode and label every assumption.
- End low-confidence outputs with the single most valuable next data request instead of hiding uncertainty.

## Validation Loop

- Recheck: stock cover / sell-through / fill rate / aging inventory share.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

- Recheck: stock cover / sell-through / fill rate / aging inventory share.
- Review window: after the first review window that can show a real signal.
- Define what improvement, no-change, and failure look like before closing the task.
- If analytics access is missing, replace the metric with a manual checkpoint and label that downgrade.

## Success Metrics

- cash is freed without creating hero-SKU stockouts
- reorder timing becomes explicit
- aging or margin risk is ranked instead of guessed

- cash is freed without creating hero-SKU stockouts
- reorder timing becomes explicit
- aging or margin risk is ranked instead of guessed

- cash is freed without creating hero-SKU stockouts
- reorder timing becomes explicit
- aging or margin risk is ranked instead of guessed

- cash is freed without creating hero-SKU stockouts
- reorder timing becomes explicit
- aging or margin risk is ranked instead of guessed

## Template Use

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.

- Use the bundled output template when the task is recurring or handoff-heavy.
- If the real input is too weak to fill the full template honestly, keep empty sections out instead of fabricating filler.
