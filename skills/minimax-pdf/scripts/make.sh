#!/usr/bin/env bash
# make.sh — minimax-pdf unified CLI
# Usage: bash make.sh <command> [options]
#
# Commands:
#   check                          Verify default CREATE/REFORMAT dependencies
#   fix                            Auto-install missing default dependencies
#   run   --title T --type TYPE    Node-first CREATE pipeline → <topic>_YYYYMMDD_HHMMSS.pdf
#         --out FILE               Output path (default: auto topic+timestamp filename)
#         --author A --date D
#         --subtitle S
#         --abstract A             Optional abstract text for cover
#         --cover-image URL        Optional cover image URL/path
#         --content FILE           Path to content.json (optional)
#   demo                           Build a full-featured demo to demo.pdf
#
# Document types:
#   report proposal resume portfolio academic general
#   minimal stripe diagonal frame editorial
#   magazine darkroom terminal poster
#
# Content block types:
#   h1 h2 h3 body bullet numbered callout table
#   image figure code math chart flowchart bibliography
#   divider caption pagebreak spacer
#
# Exit codes: 0 success, 1 usage error, 2 dep missing, 3 runtime error

set -euo pipefail
SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY="python3"
NODE="$(command -v node 2>/dev/null || true)"
[[ -z "$NODE" && -x /opt/homebrew/bin/node ]] && NODE="/opt/homebrew/bin/node"
[[ -z "$NODE" && -x /usr/local/bin/node ]] && NODE="/usr/local/bin/node"
[[ -z "$NODE" ]] && NODE="node"
if [[ "$NODE" == */* ]]; then
  export PATH="$(dirname "$NODE"):$PATH"
fi
NPM="$(command -v npm 2>/dev/null || true)"
[[ -z "$NPM" && -x /opt/homebrew/bin/npm ]] && NPM="/opt/homebrew/bin/npm"
[[ -z "$NPM" && -x /usr/local/bin/npm ]] && NPM="/usr/local/bin/npm"
[[ -z "$NPM" ]] && NPM="npm"
NPX="$(command -v npx 2>/dev/null || true)"
[[ -z "$NPX" && -x /opt/homebrew/bin/npx ]] && NPX="/opt/homebrew/bin/npx"
[[ -z "$NPX" && -x /usr/local/bin/npx ]] && NPX="/usr/local/bin/npx"
[[ -z "$NPX" ]] && NPX="npx"

# ── Colour helpers ─────────────────────────────────────────────────────────────
red()    { printf '\033[0;31m%s\033[0m\n' "$*"; }
green()  { printf '\033[0;32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$*"; }
bold()   { printf '\033[1m%s\033[0m\n' "$*"; }

# ── naming helpers ─────────────────────────────────────────────────────────────
timestamp_ymdhms() {
  date '+%Y%m%d_%H%M%S'
}

sanitize_report_topic() {
  local raw="${1:-report}"
  local topic

  topic="$(printf '%s' "$raw" | tr '\r\n\t' '   ' | sed -E 's/[[:space:]]+/ /g; s/^[[:space:]]+//; s/[[:space:]]+$//')"
  topic="${topic//\//-}"
  topic="${topic//\\/-}"
  topic="${topic//:/-}"
  topic="${topic//\?/-}"
  topic="${topic//\*/-}"
  topic="${topic//\"/-}"
  topic="${topic//</-}"
  topic="${topic//>/-}"
  topic="${topic//|/-}"
  topic="$(printf '%s' "$topic" | sed -E 's/[[:space:]]+/-/g; s/-+/-/g; s/^-+//; s/-+$//')"

  if [[ -z "$topic" ]]; then
    topic="report"
  fi

  printf '%s' "$topic"
}

build_report_filename() {
  local title="${1:-Report}"
  local topic ts
  topic="$(sanitize_report_topic "$title")"
  ts="$(timestamp_ymdhms)"
  printf '%s_%s.pdf' "$topic" "$ts"
}

looks_generic_pdf_name() {
  local base
  base="$(basename "$1" | tr '[:upper:]' '[:lower:]')"
  case "$base" in
    output.pdf|report.pdf|daily-report.pdf|document.pdf|result.pdf|final.pdf|untitled.pdf)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

resolve_output_path() {
  local requested="${1:-}"
  local title="${2:-Report}"
  local generated
  generated="$(build_report_filename "$title")"

  if [[ -z "$requested" ]]; then
    printf './%s' "$generated"
    return
  fi

  if [[ -d "$requested" || "$requested" == */ ]]; then
    local dir="${requested%/}"
    [[ -z "$dir" ]] && dir="."
    printf '%s/%s' "$dir" "$generated"
    return
  fi

  local lower
  lower="$(printf '%s' "$requested" | tr '[:upper:]' '[:lower:]')"
  if [[ "$lower" != *.pdf ]]; then
    printf '%s.pdf' "$requested"
    return
  fi

  printf '%s' "$requested"
}

rewrite_tmp_generic_output() {
  local requested="${1:-}"
  local title="${2:-Report}"

  if [[ "$requested" == /tmp/* || "$requested" == /private/tmp/* ]]; then
    if looks_generic_pdf_name "$requested"; then
      printf './%s' "$(build_report_filename "$title")"
      return
    fi
  fi

  printf '%s' "$requested"
}

# ── check ──────────────────────────────────────────────────────────────────────
cmd_check() {
  local ok=true
  bold "Checking dependencies..."

  # Node.js
  if [[ -x "$NODE" ]] || command -v "$NODE" &>/dev/null; then
    green "  ✓ node $("$NODE" --version)"
  else
    red   "  ✗ node not found"
    ok=false
  fi

  # Playwright
  if [[ -x "$NODE" ]] || command -v "$NODE" &>/dev/null; then
    if "$NODE" -e "require('playwright')" 2>/dev/null || \
       "$NODE" -e "require(require('child_process').execSync('$NPM root -g').toString().trim()+'/playwright')" 2>/dev/null; then
      green "  ✓ playwright"
    else
      yellow "  ⚠ playwright not found  (run: make.sh fix)"
      ok=false
    fi
  else
    yellow "  ⚠ playwright check skipped because node is unavailable"
  fi

  # Python is now optional and only needed for FILL + PDF-source REFORMAT.
  if command -v python3 &>/dev/null; then
    green "  ✓ python3 $(python3 --version 2>&1 | awk '{print $2}')  (optional: fill/pdf-reformat)"
    if python3 -c "import pypdf" 2>/dev/null; then
      green "  ✓ pypdf (optional)"
    else
      yellow "  ⚠ pypdf not installed — PDF form fill / PDF-source reformat may be unavailable"
    fi
  else
    yellow "  ⚠ python3 not found — FILL and PDF-source REFORMAT will be unavailable"
  fi

  if $ok; then
    green "\nDefault CREATE/REFORMAT dependencies satisfied."
    exit 0
  else
    yellow "\nDefault dependencies missing. Run: bash make.sh fix"
    exit 2
  fi
}

# ── fix ────────────────────────────────────────────────────────────────────────
cmd_fix() {
  bold "Installing missing dependencies..."
  local rc=0

  # Playwright
  if [[ -x "$NPM" ]] || command -v "$NPM" &>/dev/null; then
    "$NPM" install -g playwright --silent 2>/dev/null && \
    "$NPX" playwright install chromium 2>/dev/null && \
    green "  ✓ Playwright + Chromium installed" || \
    { yellow "  playwright install failed — try manually"; rc=3; }
  else
    yellow "  npm not found — cannot install Playwright automatically"
    rc=2
  fi

  # Optional Python package for fill/pdf-source reformat flows
  if command -v python3 &>/dev/null; then
    python3 -m pip install --break-system-packages -q pypdf 2>/dev/null \
      || python3 -m pip install -q pypdf 2>/dev/null \
      || yellow "  ⚠ optional pypdf install failed — fill/pdf-source reformat may still be unavailable"
  fi

  if [[ $rc -eq 0 ]]; then
    green "\nDefault dependencies installed. Run: bash make.sh check"
  fi
  exit $rc
}

# ── run ────────────────────────────────────────────────────────────────────────
cmd_run() {
  local title="Untitled Document"
  local type="general"
  local author=""
  local date=""
  local subtitle=""
  local abstract=""
  local cover_image=""
  local accent=""
  local cover_bg=""
  local content_file=""
  local out=""
  local out_explicit=false

  # Parse options
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --title)        title="$2";        shift 2 ;;
      --type)         type="$2";         shift 2 ;;
      --author)       author="$2";       shift 2 ;;
      --date)         date="$2";         shift 2 ;;
      --subtitle)     subtitle="$2";     shift 2 ;;
      --abstract)     abstract="$2";     shift 2 ;;
      --cover-image)  cover_image="$2";  shift 2 ;;
      --accent)       accent="$2";       shift 2 ;;
      --cover-bg)     cover_bg="$2";     shift 2 ;;
      --content)      content_file="$2"; shift 2 ;;
      --out)          out="$2"; out_explicit=true; shift 2 ;;
      *) echo "Unknown option: $1"; exit 1 ;;
    esac
  done

  out="$(resolve_output_path "$out" "$title")"
  if [[ "$out_explicit" == true ]]; then
    local rewritten_out
    rewritten_out="$(rewrite_tmp_generic_output "$out" "$title")"
    if [[ "$rewritten_out" != "$out" ]]; then
      yellow "  Temporary generic path detected. Rewriting output to: $rewritten_out"
      out="$rewritten_out"
    fi
  fi

  bold "Building: $title"
  echo "  Type    : $type"
  echo "  Output  : $out"

  if [[ -z "$content_file" ]]; then
    content_file="$SCRIPTS/../assets/sample-content.json"
    yellow "  No content file provided — using bundled sample content."
  fi

  echo ""
  bold "Step 1/1  Rendering PDF via Node + Playwright..."
  local render_args=(
    --title "$title"
    --type "$type"
    --author "$author"
    --date "$date"
    --content "$content_file"
    --out "$out"
  )
  [[ -n "$subtitle"    ]] && render_args+=(--subtitle "$subtitle")
  [[ -n "$abstract"    ]] && render_args+=(--abstract "$abstract")
  [[ -n "$cover_image" ]] && render_args+=(--cover-image "$cover_image")
  [[ -n "$accent"      ]] && render_args+=(--accent "$accent")
  [[ -n "$cover_bg"    ]] && render_args+=(--cover-bg "$cover_bg")

  $NODE "$SCRIPTS/render_document.cjs" "${render_args[@]}"
  green "  ✓ PDF rendered"
}

# ── fill ──────────────────────────────────────────────────────────────────────
cmd_fill() {
  local input="" out="" values="" data_file="" inspect_only=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --input)   input="$2";     shift 2 ;;
      --out)     out="$2";       shift 2 ;;
      --values)  values="$2";    shift 2 ;;
      --data)    data_file="$2"; shift 2 ;;
      --inspect) inspect_only=true; shift ;;
      *) echo "Unknown option: $1"; exit 1 ;;
    esac
  done

  if [[ -z "$input" ]]; then
    echo "Usage: make.sh fill --input form.pdf [--out filled.pdf] [--values '{...}'] [--data values.json] [--inspect]"
    exit 1
  fi

  if $inspect_only || [[ -z "$out" && -z "$values" && -z "$data_file" ]]; then
    if ! command -v "$PY" &>/dev/null; then
      red "python3 is required for fill inspection"
      exit 2
    fi
    bold "Inspecting form fields in: $input"
    $PY "$SCRIPTS/fill_inspect.py" --input "$input"
    return
  fi

  if ! command -v "$PY" &>/dev/null; then
    red "python3 is required for fill"
    exit 2
  fi

  bold "Filling form: $input → $out"

  local val_args=""
  if [[ -n "$values" ]];    then val_args="--values $values"; fi
  if [[ -n "$data_file" ]]; then val_args="--data $data_file"; fi

  $PY "$SCRIPTS/fill_write.py" --input "$input" --out "$out" $val_args
}

# ── reformat ───────────────────────────────────────────────────────────────────
cmd_reformat() {
  local input="" title="Reformatted Document" type="general"
  local author="" date="" out="" subtitle=""
  local out_explicit=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --input)    input="$2";    shift 2 ;;
      --title)    title="$2";    shift 2 ;;
      --type)     type="$2";     shift 2 ;;
      --author)   author="$2";   shift 2 ;;
      --date)     date="$2";     shift 2 ;;
      --subtitle) subtitle="$2"; shift 2 ;;
      --out)      out="$2"; out_explicit=true; shift 2 ;;
      *) echo "Unknown option: $1"; exit 1 ;;
    esac
  done

  if [[ -z "$input" ]]; then
    echo "Usage: make.sh reformat --input source.md --title T --type TYPE [--out title_YYYYMMDD_HHMMSS.pdf]"
    exit 1
  fi

  out="$(resolve_output_path "$out" "$title")"
  if [[ "$out_explicit" == true ]]; then
    local rewritten_out
    rewritten_out="$(rewrite_tmp_generic_output "$out" "$title")"
    if [[ "$rewritten_out" != "$out" ]]; then
      yellow "  Temporary generic path detected. Rewriting output to: $rewritten_out"
      out="$rewritten_out"
    fi
  fi

  local ext="${input##*.}"
  ext="$(printf '%s' "$ext" | tr '[:upper:]' '[:lower:]')"

  if [[ "$ext" == "pdf" ]]; then
    if ! command -v "$PY" &>/dev/null; then
      red "python3 is required to reformat from an existing PDF source"
      exit 2
    fi
    local tmpdir
    tmpdir="$(mktemp -d)"
    bold "Parsing PDF source via optional Python path: $input"
    $PY "$SCRIPTS/reformat_parse.py" --input "$input" --out "$tmpdir/content.json"
    green "  ✓ Parsed to content.json"

    bold "Applying design and building PDF..."
    local sub_args=()
    [[ -n "$subtitle" ]] && sub_args=(--subtitle "$subtitle")

    cmd_run \
      --title "$title" --type "$type" \
      --author "$author" --date "$date" \
      --content "$tmpdir/content.json" \
      --out "$out" \
      "${sub_args[@]+"${sub_args[@]}"}"

    rm -rf "$tmpdir"
    return
  fi

  bold "Applying design and building PDF..."
  echo "  Output  : $out"
  local render_args=(
    --title "$title"
    --type "$type"
    --author "$author"
    --date "$date"
    --input "$input"
    --out "$out"
  )
  [[ -n "$subtitle" ]] && render_args+=(--subtitle "$subtitle")
  $NODE "$SCRIPTS/render_document.cjs" "${render_args[@]}"
}

# ── demo ──────────────────────────────────────────────────────────────────────
cmd_demo() {
  local tmpdir
  tmpdir="$(mktemp -d)"

  cat > "$tmpdir/content.json" <<'JSON'
[
  {"type":"h1",      "text":"Executive Summary"},
  {"type":"body",    "text":"This document was generated by minimax-pdf — a skill for creating visually polished PDFs. Every design decision is rooted in the document type and content, not a generic template."},
  {"type":"callout", "text":"Key insight: design tokens flow from palette.py through every renderer, keeping cover and body visually consistent."},

  {"type":"h1",      "text":"How It Works"},
  {"type":"h2",      "text":"The Token Pipeline"},
  {"type":"body",    "text":"The palette.py script infers a color palette and typography pair from the document type. These tokens are written to tokens.json and consumed by every downstream script."},
  {"type":"numbered","text":"palette.py generates color tokens, font selection, and the cover pattern"},
  {"type":"numbered","text":"cover.py renders the cover HTML using the selected pattern"},
  {"type":"numbered","text":"render_cover.js uses Playwright to convert the HTML cover to PDF"},
  {"type":"numbered","text":"render_body.py builds inner pages from content.json using ReportLab"},
  {"type":"numbered","text":"merge.py combines cover + body and runs final QA checks"},

  {"type":"h2",      "text":"Cover Patterns"},
  {"type":"table",
    "headers": ["Pattern",      "Document type",    "Visual character"],
    "rows": [
      ["fullbleed",   "report, general",   "Deep background · dot-grid texture"],
      ["split",       "proposal",          "Left dark panel · right dot-grid"],
      ["typographic", "resume, academic",  "Oversized display type · first-word accent"],
      ["atmospheric", "portfolio",         "Dark bg · radial glow · dot-grid"],
      ["magazine",    "magazine",          "Cream bg · centered · hero image"],
      ["darkroom",    "darkroom",          "Navy bg · centered · grayscale image"],
      ["terminal",    "terminal",          "Near-black · grid lines · monospace"],
      ["poster",      "poster",            "White · thick sidebar · oversized title"]
    ]
  },

  {"type":"h1",      "text":"Data Visualisation"},
  {"type":"h2",      "text":"Performance Metrics (Chart)"},
  {"type":"body",    "text":"Charts are rendered natively using matplotlib with a color palette derived from the document accent. No external chart services or image files required."},
  {"type":"chart",
    "chart_type": "bar",
    "title":      "Quarterly Performance",
    "labels":     ["Q1", "Q2", "Q3", "Q4"],
    "datasets": [
      {"label": "Revenue",  "values": [120, 145, 132, 178]},
      {"label": "Expenses", "values": [95,  108, 99,  122]}
    ],
    "y_label": "USD (thousands)",
    "caption": "Quarterly revenue vs. expenses"
  },

  {"type":"h2",      "text":"Market Share (Pie Chart)"},
  {"type":"chart",
    "chart_type": "pie",
    "labels":     ["Product A", "Product B", "Product C", "Other"],
    "datasets":   [{"values": [42, 28, 18, 12]}],
    "caption":    "Annual market share by product line"
  },

  {"type":"pagebreak"},

  {"type":"h1",      "text":"Mathematics"},
  {"type":"body",    "text":"Display math is rendered via matplotlib mathtext — no LaTeX binary installation required. Inline references use standard [N] notation in body text."},
  {"type":"math",    "text":"E = mc^2",                              "label":"(1)"},
  {"type":"math",    "text":"\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}", "label":"(2)"},
  {"type":"math",    "text":"\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}", "caption":"Basel problem (Euler, 1734)"},

  {"type":"h1",      "text":"Process Flow"},
  {"type":"body",    "text":"Flowcharts are drawn directly using matplotlib patches — no Graphviz or external tools needed. Supported node shapes: rect, diamond, oval, parallelogram."},
  {"type":"flowchart",
    "nodes": [
      {"id":"start",  "label":"Start",             "shape":"oval"},
      {"id":"input",  "label":"Receive Input",      "shape":"parallelogram"},
      {"id":"valid",  "label":"Valid?",             "shape":"diamond"},
      {"id":"proc",   "label":"Process Data",       "shape":"rect"},
      {"id":"err",    "label":"Return Error",        "shape":"rect"},
      {"id":"out",    "label":"Return Result",       "shape":"parallelogram"},
      {"id":"end",    "label":"End",                "shape":"oval"}
    ],
    "edges": [
      {"from":"start", "to":"input"},
      {"from":"input", "to":"valid"},
      {"from":"valid", "to":"proc",  "label":"Yes"},
      {"from":"valid", "to":"err",   "label":"No"},
      {"from":"proc",  "to":"out"},
      {"from":"err",   "to":"end"},
      {"from":"out",   "to":"end"}
    ],
    "caption": "Data validation and processing flow"
  },

  {"type":"h1",      "text":"Code Example"},
  {"type":"code",    "language":"python",
    "text":"# Design token pipeline\ntokens = palette.build_tokens(\n    title=\"Annual Report\",\n    doc_type=\"report\",\n    author=\"J. Smith\",\n    date=\"March 2026\",\n)\nhtml = cover.render(tokens)\npdf  = render_cover(html)"},

  {"type":"h1",      "text":"Design Principles"},
  {"type":"body",    "text":"The aesthetic system is documented in design/design.md. The core rule: every design decision must be rooted in the document content and purpose. A color chosen because it fits the content will always outperform a color chosen because it seems safe."},
  {"type":"h2",      "text":"Restraint over decoration"},
  {"type":"body",    "text":"The page is done when there is nothing left to remove. Accent color appears on section rules only — not on headings, not on bullets. No card components, no drop shadows."},
  {"type":"callout", "text":"A PDF passes the quality bar when a designer would not be embarrassed to hand it to a client."},

  {"type":"pagebreak"},
  {"type":"bibliography",
    "title": "References",
    "items": [
      {"id":"1","text":"Bringhurst, R. (2004). The Elements of Typographic Style (3rd ed.). Hartley & Marks."},
      {"id":"2","text":"Cairo, A. (2016). The Truthful Art: Data, Charts, and Maps for Communication. New Riders."},
      {"id":"3","text":"Hochuli, J. & Kinross, R. (1996). Designing Books: Practice and Theory. Hyphen Press."}
    ]
  }
]
JSON

  cmd_run \
    --title   "minimax-pdf demo" \
    --type    "report" \
    --author  "minimax-pdf skill" \
    --date    "$(date '+%B %Y')" \
    --subtitle "A demonstration of the token-based design pipeline" \
    --content "$tmpdir/content.json" \
    --out     "demo.pdf"

  rm -rf "$tmpdir"
}

# ── dispatch ───────────────────────────────────────────────────────────────────
main() {
  if [[ $# -lt 1 ]]; then
    bold "minimax-pdf — make.sh"
    echo ""
    echo "Usage: bash make.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo "  check                             Verify default CREATE/REFORMAT dependencies"
    echo "  fix                               Auto-install default deps"
    echo "  run    --title T --type TYPE      CREATE: Node-first pipeline → PDF"
    echo "         [--author A] [--date D] [--subtitle S]"
    echo "         [--abstract A] [--cover-image URL]"
    echo "         [--accent #HEX] [--cover-bg #HEX]"
    echo "         [--content content.json] [--out title_YYYYMMDD_HHMMSS.pdf]"
    echo "  fill   --input f.pdf              FILL: inspect or fill form fields (optional python path)"
    echo "  reformat --input doc.md           REFORMAT: md/txt/json via Node; pdf via optional python parser"
    echo "  demo                              Build a full-featured demo PDF"
    exit 0
  fi

  case "$1" in
    check)    cmd_check ;;
    fix)      cmd_fix   ;;
    run)      shift; cmd_run      "$@" ;;
    fill)     shift; cmd_fill     "$@" ;;
    reformat) shift; cmd_reformat "$@" ;;
    demo)     cmd_demo  ;;
    *)        echo "Unknown command: $1"; exit 1 ;;
  esac
}

main "$@"
