#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  bootstrap-shared-infra.sh \
    [--aws-profile bustly-staging] \
    [--tf-dir infra/terraform/ecs-fargate] \
    [--auto-approve]
USAGE
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "missing required command: $cmd" >&2
    exit 1
  fi
}

AWS_PROFILE_NAME="${AWS_PROFILE:-bustly-staging}"
TF_DIR="infra/terraform/ecs-fargate"
AUTO_APPROVE="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --aws-profile)
      AWS_PROFILE_NAME="${2:-}"
      shift 2
      ;;
    --tf-dir)
      TF_DIR="${2:-}"
      shift 2
      ;;
    --auto-approve)
      AUTO_APPROVE="1"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "unknown arg: $1" >&2
      usage
      exit 1
      ;;
  esac
done

require_cmd terraform

if [[ ! -d "$TF_DIR" ]]; then
  echo "terraform dir not found: $TF_DIR" >&2
  exit 1
fi

if [[ ! -f "$TF_DIR/terraform.tfvars" ]]; then
  echo "missing $TF_DIR/terraform.tfvars" >&2
  echo "copy from terraform.tfvars.example first" >&2
  exit 1
fi

export AWS_PROFILE="$AWS_PROFILE_NAME"

terraform -chdir="$TF_DIR" init
terraform -chdir="$TF_DIR" plan
if [[ "$AUTO_APPROVE" == "1" ]]; then
  terraform -chdir="$TF_DIR" apply -auto-approve
else
  terraform -chdir="$TF_DIR" apply
fi

echo "shared infra ready"
