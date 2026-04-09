---
name: minimax-pdf
description: Create polished PDFs from structured content, reformat markdown/text into styled PDFs, or inspect and fill existing PDF forms. Use when the user wants a report, proposal, resume, or other client-ready PDF, asks to restyle an existing document into PDF, or needs PDF form fields listed or filled.
license: MIT
metadata:
  {
    "openclaw":
      {
        "emoji": "📄",
        "homepage": "https://github.com/MiniMax-AI/skills/tree/main/skills/minimax-pdf",
        "requires": { "bins": ["node"] },
        "install":
          [
            {
              "id": "playwright",
              "kind": "node",
              "package": "playwright",
              "bins": ["playwright"],
              "label": "Install Playwright",
            },
          ],
      },
  }
---

# MiniMax PDF

Use this skill for visually polished PDFs. It has three routes.

## Route Selection

- `CREATE`: make a new PDF from structured content.
- `REFORMAT`: turn an existing `.md`, `.txt`, `.pdf`, or `.json` document into a designed PDF.
- `FILL`: inspect or fill fields in an existing PDF form.

Before any `CREATE` or `REFORMAT` work, read [`design/design.md`]({baseDir}/design/design.md). That file contains the visual rules and token system the scripts expect.
If the document is an analytical report, also read [`references/report-methodology.md`]({baseDir}/references/report-methodology.md) before generating any content. That file is the hard constraint for analytical depth.

## Analytical Report Constraint

For business, growth, operations, finance, marketing, customer, or performance-analysis PDFs, do not let the model free-write a shallow narrative.

You must structure the report around evidence and decisions:
- State the reporting scope, time window, and missing-data handling.
- Decompose headline results into drivers, not just outcomes.
- Separate observation, interpretation, and action.
- Every important claim must cite numbers, comparisons, or concrete evidence from the input.
- If evidence is missing, say that explicitly and lower confidence instead of guessing.

Minimum analytical sections for report-style PDFs:
- `Executive Summary`: 3-5 bullets with headline metric, key change, primary driver, and business implication.
- `Metric Decomposition`: a table of core metrics, definitions, period, comparison baseline, and what changed.
- `Key Findings`: at least 3 evidence-backed findings; each finding must include what happened, why it likely happened, and why it matters.
- `Driver Analysis`: by channel / product / customer / region / time slice when data exists.
- `Risks & Blind Spots`: missing data, anomalies, attribution ambiguity, seasonality, sample-size issues.
- `Prioritized Actions`: 3-5 actions with rationale, expected impact, and urgency.

Do not use empty language such as:
- “表现不错”
- “建议持续观察”
- “整体较稳定”

unless it is immediately followed by quantified evidence and business meaning.

## Commands

### Output Naming Rule (Required)

For CREATE / REFORMAT outputs, use a user-facing file name in this format:

- `[topic]_[YYYYMMDD_HHMMSS].pdf`

Example:
- `Bustly-Onboarding-Design_20260409_153501.pdf`

Rules:
- Prefer workspace-relative output paths (for example `./...`) over temporary paths.
- Do not present `/tmp/...` style paths as the document title in user-facing responses.
- If `--out` is omitted, `make.sh` now auto-generates the required filename format from `--title`.

### CREATE

Use the sample content file at `{baseDir}/assets/sample-content.json` as a starting point when the user does not provide one.

Canonical body content is a top-level JSON array of blocks:

```json
[
  { "type": "h1", "text": "Overview" },
  { "type": "body", "text": "Summarize the business context and the time range." },
  {
    "type": "table",
    "headers": ["Metric", "Value"],
    "rows": [["Revenue", "HKD 15,415"], ["Orders", "69"]]
  }
]
```

The OpenClaw build also auto-normalizes common report-shaped inputs, so these variants are accepted:
- Top-level objects with `abstract` + `sections`
- `content` instead of `text`
- `header` instead of `headers`
- Plain strings inside the block list (they become `body` blocks)

For multi-section business reports, this higher-level shape is usually the easiest for the agent to write:

```json
{
  "title": "Store Operations Report",
  "abstract": "Summarize the reporting window and the headline outcome.",
  "sections": [
    {
      "title": "Core Metrics",
      "blocks": [
        { "type": "body", "content": "Give the narrative summary." },
        {
          "type": "table",
          "header": ["Metric", "Value"],
          "rows": [["Revenue", "HKD 15,415"], ["Orders", "69"]]
        }
      ]
    },
    {
      "title": "Next Actions",
      "blocks": [
        { "type": "numbered", "content": "Restock the top missing SKU." }
      ]
    }
  ]
}
```

For analytical reports, prefer a sectioned object and force evidence into each section. The most reliable pattern is:

```json
{
  "title": "Store Operations Report",
  "abstract": "State scope, time range, and the headline conclusion in 2-3 sentences.",
  "sections": [
    {
      "title": "Executive Summary",
      "blocks": [
        { "type": "bullet", "content": "Headline metric + delta + driver + implication." },
        { "type": "bullet", "content": "Headline metric + delta + driver + implication." }
      ]
    },
    {
      "title": "Metric Decomposition",
      "blocks": [
        {
          "type": "table",
          "header": ["Metric", "Current", "Baseline", "Delta", "Interpretation"],
          "rows": [["Revenue", "HKD 91,838", "HKD 74,210", "+23.8%", "Growth came from repeat buyers, not traffic expansion."]]
        }
      ]
    },
    {
      "title": "Key Findings",
      "blocks": [
        { "type": "callout", "title": "Finding 1", "content": "Observation -> likely cause -> business implication." }
      ]
    },
    {
      "title": "Prioritized Actions",
      "blocks": [
        { "type": "numbered", "content": "Action + rationale + expected effect + urgency." }
      ]
    }
  ]
}
```

```bash
bash {baseDir}/scripts/make.sh run \
  --title "Q3 Strategy Review" \
  --type proposal \
  --author "Strategy Team" \
  --date "March 2026" \
  --content {baseDir}/assets/sample-content.json
```

Or set an explicit file name in the required format:

```bash
bash {baseDir}/scripts/make.sh run \
  --title "Q3 Strategy Review" \
  --type proposal \
  --content {baseDir}/assets/sample-content.json \
  --out ./Q3-Strategy-Review_20260409_153501.pdf
```

Supported document types:
- `report`
- `proposal`
- `resume`
- `portfolio`
- `academic`
- `general`
- `minimal`
- `stripe`
- `diagonal`
- `frame`
- `editorial`
- `magazine`
- `darkroom`
- `terminal`
- `poster`

### REFORMAT

```bash
bash {baseDir}/scripts/make.sh reformat \
  --input ./source.md \
  --title "Restyled Report" \
  --type report
```

### FILL

Always inspect first so field names are exact.

```bash
bash {baseDir}/scripts/make.sh fill --input ./form.pdf --inspect

bash {baseDir}/scripts/make.sh fill \
  --input ./form.pdf \
  --out ./filled.pdf \
  --values '{"FirstName":"Jane","Agree":"true"}'
```

## Dependencies

Check the environment first:

```bash
bash {baseDir}/scripts/make.sh check
```

Default CREATE / REFORMAT only needs Node + Playwright:

```bash
npm install -g playwright
npx playwright install chromium
```

Python is now optional and only needed for:
- `FILL`
- `REFORMAT` when the input source itself is an existing `.pdf`

If you need those optional routes and Python libraries are missing, install them explicitly:

```bash
python3 -m pip install pypdf
```

## Notes

- The default CREATE / REFORMAT renderer is now Node + Playwright, so report generation no longer depends on a local Python runtime.
- The default renderer uses browser-native system font stacks with CJK coverage, so Chinese tables, chart titles, legends, and axis labels render correctly without matplotlib / ReportLab font tuning.
- Legacy optional Python utilities still keep the older CJK font-probing path for form / PDF-source helper flows.
- If a machine uses a non-standard font layout and you still need the legacy Python utilities, you can force custom body fonts with:
  - `MINIMAX_PDF_CJK_DISPLAY_FONT`
  - `MINIMAX_PDF_CJK_BODY_FONT`
  - `MINIMAX_PDF_CJK_BODY_BOLD_FONT`
- Cover rendering still uses Playwright and may fetch remote cover images when those are referenced.
- The Node renderer uses browser-native HTML tables and SVG charts with CJK-capable font stacks, which fixes the previous chart-title / axis-label garbling seen in Chinese reports.
- The main entrypoint is `bash {baseDir}/scripts/make.sh ...`; it now routes CREATE / REFORMAT through the Node renderer by default. Do not call the lower-level scripts unless you need to debug the pipeline.
