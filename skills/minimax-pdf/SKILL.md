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
        "requires": { "bins": ["python3", "node"] },
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

## Commands

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

```bash
bash {baseDir}/scripts/make.sh run \
  --title "Q3 Strategy Review" \
  --type proposal \
  --author "Strategy Team" \
  --date "March 2026" \
  --content {baseDir}/assets/sample-content.json \
  --out ./strategy-review.pdf
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
  --type report \
  --out ./restyled-report.pdf
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

If Python libraries are missing, install them explicitly:

```bash
python3 -m pip install reportlab pypdf matplotlib
```

If Playwright is missing:

```bash
npm install -g playwright
npx playwright install chromium
```

## Notes

- Body pages now auto-detect Chinese/Japanese/Korean content and switch to a CJK-capable ReportLab font path automatically.
- Font selection is now cross-platform:
  - macOS: prefers local system CJK fonts and wide Unicode fallback fonts
  - Windows: probes common CJK fonts such as Microsoft YaHei, Meiryo, Yu Gothic, and Malgun Gothic
  - Linux: probes common Noto / Source Han / WenQuanYi style installs under standard font directories
- If no suitable local font can be registered, the renderer falls back to built-in CID fonts so body text still renders instead of tofu.
- If a machine uses a non-standard font layout, you can force custom body fonts with:
  - `MINIMAX_PDF_CJK_DISPLAY_FONT`
  - `MINIMAX_PDF_CJK_BODY_FONT`
  - `MINIMAX_PDF_CJK_BODY_BOLD_FONT`
- `render_cover.cjs` uses Playwright and may fetch remote fonts or remote cover images when those are referenced.
- `matplotlib` is optional but needed for `math`, `chart`, and `flowchart` blocks.
- The main entrypoint is `bash {baseDir}/scripts/make.sh ...`; it now normalizes near-miss JSON formats before rendering. Do not call the lower-level scripts unless you need to debug the pipeline.
