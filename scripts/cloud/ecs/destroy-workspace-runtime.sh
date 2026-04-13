#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  destroy-workspace-runtime.sh \
    --workspace-id <workspace_id> \
    [--aws-profile bustly-staging] \
    [--tf-dir infra/terraform/ecs-fargate]
USAGE
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "missing required command: $cmd" >&2
    exit 1
  fi
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

if [[ ! -d "$TF_DIR" ]]; then
  echo "terraform dir not found: $TF_DIR" >&2
  exit 1
fi

export AWS_PROFILE="$AWS_PROFILE_NAME"

TABLE_NAME="$(terraform -chdir="$TF_DIR" output -raw workspace_runtime_table_name)"
CLUSTER_NAME="$(terraform -chdir="$TF_DIR" output -raw ecs_cluster_name)"
AWS_REGION="$(terraform -chdir="$TF_DIR" output -raw aws_region)"

ITEM_JSON="$(aws dynamodb get-item \
  --region "$AWS_REGION" \
  --table-name "$TABLE_NAME" \
  --key "{\"workspace_id\":{\"S\":\"${WORKSPACE_ID}\"}}" \
  --output json)"

if [[ "$(python3 - <<'PY' "$ITEM_JSON"
import json, sys
payload = json.loads(sys.argv[1])
print('yes' if payload.get('Item') else 'no')
PY
)" != "yes" ]]; then
  echo "workspace mapping not found: ${WORKSPACE_ID}"
  exit 0
fi

FIELDS_RAW="$(python3 - <<'PY' "$ITEM_JSON"
import json, sys
item = json.loads(sys.argv[1]).get('Item', {})
def s(key):
    return item.get(key, {}).get('S', '')
print(s('service_name'))
print(s('listener_rule_arn'))
print(s('target_group_arn'))
print(s('task_definition_arn'))
print(s('efs_access_point_id'))
PY
)"

SERVICE_NAME="$(printf '%s\n' "$FIELDS_RAW" | sed -n '1p')"
RULE_ARN="$(printf '%s\n' "$FIELDS_RAW" | sed -n '2p')"
TG_ARN="$(printf '%s\n' "$FIELDS_RAW" | sed -n '3p')"
TASK_DEF_ARN="$(printf '%s\n' "$FIELDS_RAW" | sed -n '4p')"
AP_ID="$(printf '%s\n' "$FIELDS_RAW" | sed -n '5p')"

if [[ -n "$RULE_ARN" ]]; then
  aws elbv2 delete-rule --region "$AWS_REGION" --rule-arn "$RULE_ARN" || true
fi

if [[ -n "$SERVICE_NAME" ]]; then
  aws ecs update-service --region "$AWS_REGION" --cluster "$CLUSTER_NAME" --service "$SERVICE_NAME" --desired-count 0 >/dev/null || true
  aws ecs delete-service --region "$AWS_REGION" --cluster "$CLUSTER_NAME" --service "$SERVICE_NAME" --force >/dev/null || true
fi

if [[ -n "$TG_ARN" ]]; then
  aws elbv2 delete-target-group --region "$AWS_REGION" --target-group-arn "$TG_ARN" || true
fi

if [[ -n "$TASK_DEF_ARN" ]]; then
  aws ecs deregister-task-definition --region "$AWS_REGION" --task-definition "$TASK_DEF_ARN" >/dev/null || true
fi

if [[ -n "$AP_ID" ]]; then
  aws efs delete-access-point --region "$AWS_REGION" --access-point-id "$AP_ID" || true
fi

aws dynamodb delete-item \
  --region "$AWS_REGION" \
  --table-name "$TABLE_NAME" \
  --key "{\"workspace_id\":{\"S\":\"${WORKSPACE_ID}\"}}" >/dev/null

echo "workspace runtime destroyed"
echo "  workspace_id: ${WORKSPACE_ID}"
