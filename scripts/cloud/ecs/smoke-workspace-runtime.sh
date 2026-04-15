#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  smoke-workspace-runtime.sh \
    --workspace-id <workspace_id> \
    [--aws-profile bustly-staging] \
    [--tf-dir infra/terraform/ecs-fargate]

This script reads ws_url and token from DynamoDB mapping, then runs gateway RPC smoke checks.
USAGE
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "missing required command: $cmd" >&2
    exit 1
  fi
}

read_value_from_env_or_tf_output() {
  local env_key="$1"
  local tf_output_name="$2"
  local value="${!env_key:-}"

  if [[ -n "$value" ]]; then
    printf '%s' "$value"
    return 0
  fi

  terraform -chdir="$TF_DIR" output -raw "$tf_output_name"
}

WORKSPACE_ID=""
AWS_PROFILE_NAME="${AWS_PROFILE:-bustly-staging}"
TF_DIR="infra/terraform/ecs-fargate"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --workspace-id)
      WORKSPACE_ID="${2:-}"
      shift 2
      ;;
    --aws-profile)
      AWS_PROFILE_NAME="${2:-}"
      shift 2
      ;;
    --tf-dir)
      TF_DIR="${2:-}"
      shift 2
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

if [[ -z "$WORKSPACE_ID" ]]; then
  usage
  exit 1
fi

require_cmd aws
require_cmd terraform
require_cmd python3
require_cmd node

if [[ ! -d "$TF_DIR" ]]; then
  echo "terraform dir not found: $TF_DIR" >&2
  exit 1
fi

export AWS_PROFILE="$AWS_PROFILE_NAME"

TABLE_NAME="$(read_value_from_env_or_tf_output OPENCLAW_WORKSPACE_RUNTIME_TABLE_NAME workspace_runtime_table_name)"
AWS_REGION="$(read_value_from_env_or_tf_output OPENCLAW_AWS_REGION aws_region)"

ITEM_JSON="$(aws dynamodb get-item \
  --region "$AWS_REGION" \
  --table-name "$TABLE_NAME" \
  --key "{\"workspace_id\":{\"S\":\"${WORKSPACE_ID}\"}}" \
  --output json)"

FIELDS_RAW="$(python3 - <<'PY' "$ITEM_JSON"
import json, sys
item = json.loads(sys.argv[1]).get('Item', {})
def s(key):
    return item.get(key, {}).get('S', '')
print(s('ws_url'))
print(s('ws_scheme'))
print(s('alb_dns'))
print(s('workspace_path'))
print(s('gateway_token'))
print(s('target_group_arn'))
PY
)"

WS_URL="$(printf '%s\n' "$FIELDS_RAW" | sed -n '1p')"
WS_SCHEME="$(printf '%s\n' "$FIELDS_RAW" | sed -n '2p')"
ALB_DNS="$(printf '%s\n' "$FIELDS_RAW" | sed -n '3p')"
WORKSPACE_PATH="$(printf '%s\n' "$FIELDS_RAW" | sed -n '4p')"
GATEWAY_TOKEN="$(printf '%s\n' "$FIELDS_RAW" | sed -n '5p')"
TARGET_GROUP_ARN="$(printf '%s\n' "$FIELDS_RAW" | sed -n '6p')"

if [[ -z "$WS_URL" ]]; then
  if [[ -z "$WS_SCHEME" || -z "$ALB_DNS" || -z "$WORKSPACE_PATH" ]]; then
    echo "workspace mapping missing ws endpoint fields" >&2
    exit 1
  fi
  WS_URL="${WS_SCHEME}://${ALB_DNS}${WORKSPACE_PATH}"
fi

if [[ -z "$GATEWAY_TOKEN" ]]; then
  echo "workspace mapping missing gateway_token" >&2
  exit 1
fi

echo "smoke target: ${WS_URL}"

wait_target_healthy() {
  # ALB health checks run every 30s and require multiple consecutive successes.
  # After a recreate, runtime bootstrap + 5 healthy checks can easily exceed 2 minutes.
  local attempts=48
  local sleep_seconds=5
  local state=""
  local reason=""
  local desc=""

  if [[ -z "$TARGET_GROUP_ARN" ]]; then
    echo "warning: target_group_arn missing in mapping; skip ALB health wait"
    return 0
  fi

  echo "waiting for ALB target health..."
  for i in $(seq 1 "$attempts"); do
    state="$(aws elbv2 describe-target-health \
      --region "$AWS_REGION" \
      --target-group-arn "$TARGET_GROUP_ARN" \
      --query 'TargetHealthDescriptions[0].TargetHealth.State' \
      --output text 2>/dev/null || true)"
    reason="$(aws elbv2 describe-target-health \
      --region "$AWS_REGION" \
      --target-group-arn "$TARGET_GROUP_ARN" \
      --query 'TargetHealthDescriptions[0].TargetHealth.Reason' \
      --output text 2>/dev/null || true)"
    desc="$(aws elbv2 describe-target-health \
      --region "$AWS_REGION" \
      --target-group-arn "$TARGET_GROUP_ARN" \
      --query 'TargetHealthDescriptions[0].TargetHealth.Description' \
      --output text 2>/dev/null || true)"

    echo "  attempt ${i}/${attempts}: state=${state:-unknown} reason=${reason:-none}"
    if [[ "$state" == "healthy" ]]; then
      return 0
    fi
    sleep "$sleep_seconds"
  done

  echo "target did not become healthy in time: state=${state:-unknown} reason=${reason:-none} desc=${desc:-none}" >&2
  return 1
}

wait_target_healthy

run_gateway_call() {
  local method="$1"
  local params="${2:-{}}"
  if [[ "$WS_URL" == ws://* || "$WS_URL" == wss://* ]]; then
    node scripts/cloud/ecs/raw-gateway-call.mjs \
      --url "$WS_URL" \
      --token "$GATEWAY_TOKEN" \
      --method "$method" \
      --params "$params"
    return
  fi
  pnpm openclaw gateway call "$method" --url "$WS_URL" --token "$GATEWAY_TOKEN" --params "$params"
}

echo "[1/2] health"
HEALTH_JSON="$(run_gateway_call health "{}")"
echo "$HEALTH_JSON"

python3 - <<'PY' "$HEALTH_JSON" "$WORKSPACE_ID"
import json, sys
health = json.loads(sys.argv[1])
workspace_id = sys.argv[2]
prefix = workspace_id.split("-", 1)[0][:8]
default_agent_id = (health or {}).get("defaultAgentId") or ""
if not default_agent_id.startswith(f"bustly-{prefix}"):
    raise SystemExit(
        f"unexpected defaultAgentId={default_agent_id!r}, expected prefix bustly-{prefix}"
    )
PY

echo "[2/2] workspace.get-active"
set +e
WORKSPACE_GET_ACTIVE_OUTPUT="$(run_gateway_call bustly.workspace.get-active "{}" 2>&1)"
WORKSPACE_GET_ACTIVE_EXIT=$?
set -e
if [[ $WORKSPACE_GET_ACTIVE_EXIT -eq 0 ]]; then
  echo "$WORKSPACE_GET_ACTIVE_OUTPUT"
else
  if grep -q "missing scope: operator.read" <<<"$WORKSPACE_GET_ACTIVE_OUTPUT"; then
    echo "workspace.get-active skipped for device-less smoke auth (operator.read scope required)"
  else
    echo "$WORKSPACE_GET_ACTIVE_OUTPUT" >&2
    exit $WORKSPACE_GET_ACTIVE_EXIT
  fi
fi

echo "smoke check passed"
