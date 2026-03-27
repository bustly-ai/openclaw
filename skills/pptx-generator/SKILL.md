---
name: pptx-generator
description: Create, read, and iteratively build PowerPoint decks with a PptxGenJS starter project and markitdown extraction. Use when the user asks for a slide deck, presentation, PPTX, PowerPoint file, or wants text extracted from an existing PPTX.
license: MIT
metadata:
  {
    "openclaw":
      {
        "emoji": "📊",
        "homepage": "https://github.com/MiniMax-AI/skills/tree/main/skills/pptx-generator",
        "requires": { "bins": ["node", "python3"] },
        "install":
          [
            {
              "id": "markitdown",
              "kind": "uv",
              "package": "markitdown[pptx]",
              "bins": ["markitdown"],
              "label": "Install markitdown",
            },
          ],
      },
  }
---

# PPTX Generator

This OpenClaw version turns the original reference-heavy skill into a usable workflow with a starter deck scaffold.

## Main Routes

### READ AN EXISTING PPTX

```bash
bash {baseDir}/scripts/pptx.sh read ./deck.pptx
```

This uses `markitdown` when available and falls back to `python3 -m markitdown`.

### CREATE A NEW DECK

Initialize a starter project:

```bash
bash {baseDir}/scripts/pptx.sh init ./my-deck
```

Then install the local Node dependency and compile:

```bash
cd ./my-deck
npm install
bash {baseDir}/scripts/pptx.sh compile .
```

Edit the generated files under `./my-deck/slides/`. The starter includes:

- `slides/slide-01.js`: cover slide
- `slides/slide-02.js`: content slide with page badge
- `compile.js`: auto-discovers `slides/slide-*.js` in sorted order

### EDIT AN EXISTING DECK

For XML-level editing or template-based changes, read:

- `{baseDir}/references/editing.md`
- `{baseDir}/references/pitfalls.md`

For slide design and layout choices, read:

- `{baseDir}/references/design-system.md`
- `{baseDir}/references/slide-types.md`

## Workflow Rules

- New decks should start from `bash {baseDir}/scripts/pptx.sh init ...` instead of recreating the scaffold by hand.
- Keep one slide module per file and export a synchronous `createSlide(pres, theme)` function.
- Use the theme keys exactly as provided in the starter: `primary`, `secondary`, `accent`, `light`, `bg`.
- Use `theme.fonts.display` and `theme.fonts.body` for text instead of hard-coding `Arial`.
- The starter now auto-detects deck language from `slideConfig` content and sets both `pres.lang` and default fonts for Chinese, Japanese, and Korean decks.
- If auto-detection is not enough, override explicitly with `PPTX_LANG`, `PPTX_FONT_DISPLAY`, or `PPTX_FONT_BODY` before compile.
- After generating or editing a deck, run `bash {baseDir}/scripts/pptx.sh read ...` to verify the text structure.

## Notes

- `pptxgenjs` is installed locally inside each initialized deck via `npm install`.
- `markitdown` is the preferred reader for verification and extraction.
- PPTX text is rendered by the presentation client, not by this skill. That means CJK output is generally safer than PDF body rendering, but font consistency still depends on the font names written into the deck. This starter now writes localized defaults instead of hard-coding `Arial`.
