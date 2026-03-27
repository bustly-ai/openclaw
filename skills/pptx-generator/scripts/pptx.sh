#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
STARTER_DIR="$BASE_DIR/assets/deck-starter"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/pptx.sh init <target-dir>
  bash scripts/pptx.sh compile <deck-dir> [output-file]
  bash scripts/pptx.sh read <presentation.pptx>
EOF
}

require_arg() {
  local value="${1:-}"
  local label="${2:-argument}"
  if [[ -z "$value" ]]; then
    echo "Missing $label."
    usage
    exit 1
  fi
}

cmd_init() {
  local target_dir="${1:-}"
  require_arg "$target_dir" "target directory"
  mkdir -p "$target_dir"
  rsync -a "$STARTER_DIR"/ "$target_dir"/
  mkdir -p "$target_dir/output" "$target_dir/slides/imgs"
  echo "Initialized PPTX starter in $target_dir"
  echo "Next:"
  echo "  cd \"$target_dir\""
  echo "  npm install"
  echo "  bash \"$BASE_DIR/scripts/pptx.sh\" compile ."
}

cmd_compile() {
  local deck_dir="${1:-}"
  local output_file="${2:-}"
  require_arg "$deck_dir" "deck directory"

  if [[ ! -f "$deck_dir/compile.js" ]]; then
    echo "Missing compile.js in $deck_dir"
    exit 1
  fi

  if [[ ! -d "$deck_dir/node_modules/pptxgenjs" ]]; then
    echo "pptxgenjs is not installed in $deck_dir."
    echo "Run: cd \"$deck_dir\" && npm install"
    exit 1
  fi

  if [[ -n "$output_file" ]]; then
    (cd "$deck_dir" && node compile.js "$output_file")
  else
    (cd "$deck_dir" && node compile.js)
  fi
}

cmd_read() {
  local input_file="${1:-}"
  require_arg "$input_file" "input file"

  if command -v markitdown >/dev/null 2>&1; then
    local output=""
    local status=0
    set +e
    output="$(markitdown "$input_file" 2>&1)"
    status=$?
    set -e
    if [[ $status -eq 0 ]]; then
      printf '%s\n' "$output"
      exit 0
    fi
    if printf '%s' "$output" | grep -q "MissingDependencyException"; then
      if command -v uvx >/dev/null 2>&1; then
        exec uvx --from 'markitdown[pptx]' markitdown "$input_file"
      fi
      if command -v uv >/dev/null 2>&1; then
        exec uv tool run --from 'markitdown[pptx]' markitdown "$input_file"
      fi
      printf '%s\n' "$output" >&2
      echo "Installed markitdown is missing the [pptx] extra." >&2
      echo "Fix: uv tool install 'markitdown[pptx]' --force" >&2
      exit 1
    fi
    printf '%s\n' "$output" >&2
    exit "$status"
  fi

  if python3 -m markitdown --help >/dev/null 2>&1; then
    exec python3 -m markitdown "$input_file"
  fi

  if command -v uvx >/dev/null 2>&1; then
    exec uvx --from 'markitdown[pptx]' markitdown "$input_file"
  fi

  if command -v uv >/dev/null 2>&1; then
    exec uv tool run --from 'markitdown[pptx]' markitdown "$input_file"
  fi

  echo "markitdown is not installed."
  echo "Install with: uv tool install 'markitdown[pptx]'"
  exit 1
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

case "$1" in
  init)
    shift
    cmd_init "$@"
    ;;
  compile)
    shift
    cmd_compile "$@"
    ;;
  read)
    shift
    cmd_read "$@"
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    echo "Unknown command: $1"
    usage
    exit 1
    ;;
esac
