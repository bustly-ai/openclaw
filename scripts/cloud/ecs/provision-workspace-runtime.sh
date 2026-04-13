#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  provision-workspace-runtime.sh \
    --workspace-id <workspace_id> \
    --image <ecr_or_registry_image> \
    [--routing-mode path|host] \
    [--runtime-domain-suffix runtime-staging.bustly.ai] \
    [--aws-profile bustly-staging] \
    [--tf-dir infra/terraform/ecs-fargate] \
    [--gateway-token <token>] \
    [--skip-channels 1] \
    [--skip-cron 1] \
    [--cpu 1024] \
    [--memory 2048] \
    [--desired-count 1] \
    [--bustly-api-base-url <url>] \
    [--bustly-web-base-url <url>] \
    [--bustly-client-id <id>] \
    [--bustly-oauth-state-b64 <base64_json>] \
    [--bustly-user-access-token <token>] \
    [--bustly-login-trace-id <trace_id>]
USAGE
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "missing required command: $cmd" >&2
    exit 1
  fi
}

slug_hash() {
  local input="$1"
  local cleaned
  cleaned="$(echo "$input" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9-')"
  local base
  base="${cleaned:0:12}"
  if [[ -z "$base" ]]; then
    base="workspace"
  fi
  local hash
  hash="$(printf '%s' "$input" | shasum -a 256 | awk '{print $1}' | cut -c1-8)"
  echo "${base}-${hash}"
}

WORKSPACE_ID=""
IMAGE=""
AWS_PROFILE_NAME="${AWS_PROFILE:-bustly-staging}"
TF_DIR="infra/terraform/ecs-fargate"
GATEWAY_TOKEN=""
SKIP_CHANNELS="1"
SKIP_CRON="1"
CPU="1024"
MEMORY="2048"
DESIRED_COUNT="1"
BUSTLY_API_BASE_URL=""
BUSTLY_WEB_BASE_URL=""
BUSTLY_CLIENT_ID=""
BUSTLY_API_BASE_URL_DEFAULT="https://gw.bustly.ai/api/v1"
BUSTLY_WEB_BASE_URL_DEFAULT="https://www.bustly.ai"
BUSTLY_CLIENT_ID_DEFAULT="openclaw-desktop"
BUSTLY_OAUTH_STATE_B64=""
BUSTLY_USER_ACCESS_TOKEN=""
BUSTLY_LOGIN_TRACE_ID=""
ROUTING_MODE="path"
RUNTIME_DOMAIN_SUFFIX="${RUNTIME_DOMAIN_SUFFIX:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --workspace-id)
      WORKSPACE_ID="${2:-}"
      shift 2
      ;;
    --image)
      IMAGE="${2:-}"
      shift 2
      ;;
    --routing-mode)
      ROUTING_MODE="${2:-}"
      shift 2
      ;;
    --runtime-domain-suffix)
      RUNTIME_DOMAIN_SUFFIX="${2:-}"
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
    --gateway-token)
      GATEWAY_TOKEN="${2:-}"
      shift 2
      ;;
    --skip-channels)
      SKIP_CHANNELS="${2:-}"
      shift 2
      ;;
    --skip-cron)
      SKIP_CRON="${2:-}"
      shift 2
      ;;
    --cpu)
      CPU="${2:-}"
      shift 2
      ;;
    --memory)
      MEMORY="${2:-}"
      shift 2
      ;;
    --desired-count)
      DESIRED_COUNT="${2:-}"
      shift 2
      ;;
    --bustly-api-base-url)
      BUSTLY_API_BASE_URL="${2:-}"
      shift 2
      ;;
    --bustly-web-base-url)
      BUSTLY_WEB_BASE_URL="${2:-}"
      shift 2
      ;;
    --bustly-client-id)
      BUSTLY_CLIENT_ID="${2:-}"
      shift 2
      ;;
    --bustly-oauth-state-b64)
      BUSTLY_OAUTH_STATE_B64="${2:-}"
      shift 2
      ;;
    --bustly-user-access-token)
      BUSTLY_USER_ACCESS_TOKEN="${2:-}"
      shift 2
      ;;
    --bustly-login-trace-id)
      BUSTLY_LOGIN_TRACE_ID="${2:-}"
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

if [[ -z "$WORKSPACE_ID" || -z "$IMAGE" ]]; then
  usage
  exit 1
fi

if [[ "$ROUTING_MODE" != "path" && "$ROUTING_MODE" != "host" ]]; then
  echo "invalid --routing-mode: $ROUTING_MODE (expected path|host)" >&2
  exit 1
fi

if [[ "$ROUTING_MODE" == "host" ]]; then
  RUNTIME_DOMAIN_SUFFIX="$(echo "$RUNTIME_DOMAIN_SUFFIX" | tr '[:upper:]' '[:lower:]' | sed 's/^[.]*//;s/[.]*$//')"
  if [[ -z "$RUNTIME_DOMAIN_SUFFIX" ]]; then
    echo "--runtime-domain-suffix is required when --routing-mode host" >&2
    exit 1
  fi
fi

require_cmd aws
require_cmd terraform
require_cmd python3
require_cmd shasum
require_cmd openssl

if [[ ! -d "$TF_DIR" ]]; then
  echo "terraform dir not found: $TF_DIR" >&2
  exit 1
fi

export AWS_PROFILE="$AWS_PROFILE_NAME"

if [[ -z "$GATEWAY_TOKEN" ]]; then
  GATEWAY_TOKEN="$(openssl rand -hex 24)"
fi

LOCAL_OAUTH_PATH="${HOME}/.bustly/bustlyOauth.json"
if [[ -z "$BUSTLY_OAUTH_STATE_B64" && -f "$LOCAL_OAUTH_PATH" ]]; then
  BUSTLY_OAUTH_STATE_B64="$(
    python3 - "$LOCAL_OAUTH_PATH" "$WORKSPACE_ID" <<'PY'
import json
import base64
import sys
path = sys.argv[1]
workspace_id = sys.argv[2]
try:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
except Exception:
    print("")
    raise SystemExit(0)
user = data.get("user") or {}
supabase = data.get("supabase") or {}
token = (user.get("userAccessToken") or "").strip()
if not token:
    print("")
    raise SystemExit(0)
minimal = {
    "loginTraceId": data.get("loginTraceId") or f"cloud-{workspace_id[:12]}",
    "user": {
        "userId": user.get("userId") or "",
        "userName": user.get("userName") or "",
        "userEmail": user.get("userEmail") or "",
        "userAccessToken": token,
        "workspaceId": workspace_id,
    },
    "supabase": {
        "url": (supabase.get("url") or "").strip(),
        "anonKey": (supabase.get("anonKey") or "").strip(),
    },
}
encoded = base64.b64encode(
    json.dumps(minimal, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
).decode("ascii")
print(encoded)
PY
  )"
fi

if [[ -z "$BUSTLY_USER_ACCESS_TOKEN" && -n "$BUSTLY_OAUTH_STATE_B64" ]]; then
  BUSTLY_USER_ACCESS_TOKEN="$(
    python3 - "$BUSTLY_OAUTH_STATE_B64" <<'PY'
import base64
import json
import sys
try:
    raw = base64.b64decode(sys.argv[1].encode("ascii")).decode("utf-8")
    state = json.loads(raw)
except Exception:
    print("")
    raise SystemExit(0)
print((((state.get("user") or {}).get("userAccessToken")) or "").strip())
PY
  )"
fi

if [[ -z "$BUSTLY_LOGIN_TRACE_ID" ]]; then
  BUSTLY_LOGIN_TRACE_ID="cloud-${WORKSPACE_ID:0:12}"
fi

if [[ -z "$BUSTLY_API_BASE_URL" ]]; then
  BUSTLY_API_BASE_URL="$BUSTLY_API_BASE_URL_DEFAULT"
fi
if [[ -z "$BUSTLY_WEB_BASE_URL" ]]; then
  BUSTLY_WEB_BASE_URL="$BUSTLY_WEB_BASE_URL_DEFAULT"
fi
if [[ -z "$BUSTLY_CLIENT_ID" ]]; then
  BUSTLY_CLIENT_ID="$BUSTLY_CLIENT_ID_DEFAULT"
fi

NAME_SUFFIX="$(slug_hash "$WORKSPACE_ID")"
SERVICE_NAME="oc-${NAME_SUFFIX}"
TARGET_GROUP_NAME="oc-${NAME_SUFFIX}"
FAMILY_NAME="oc-${NAME_SUFFIX}"
WORKSPACE_HOST=""

if [[ "$ROUTING_MODE" == "host" ]]; then
  WORKSPACE_HOST="ws-${NAME_SUFFIX}.${RUNTIME_DOMAIN_SUFFIX}"
fi

CLUSTER_NAME="$(terraform -chdir="$TF_DIR" output -raw ecs_cluster_name)"
VPC_ID="$(terraform -chdir="$TF_DIR" output -raw vpc_id)"
SUBNETS_CSV="$(terraform -chdir="$TF_DIR" output -raw public_subnet_ids_csv)"
RUNTIME_SG_ID="$(terraform -chdir="$TF_DIR" output -raw runtime_security_group_id)"
EFS_ID="$(terraform -chdir="$TF_DIR" output -raw efs_file_system_id)"
EXEC_ROLE_ARN="$(terraform -chdir="$TF_DIR" output -raw ecs_task_execution_role_arn)"
TASK_ROLE_ARN="$(terraform -chdir="$TF_DIR" output -raw ecs_task_role_arn)"
LOG_GROUP="$(terraform -chdir="$TF_DIR" output -raw cloudwatch_log_group_name)"
TABLE_NAME="$(terraform -chdir="$TF_DIR" output -raw workspace_runtime_table_name)"
LISTENER_ARN="$(terraform -chdir="$TF_DIR" output -raw alb_listener_arn_for_rules)"
ALB_DNS="$(terraform -chdir="$TF_DIR" output -raw alb_dns_name)"
WS_SCHEME="$(terraform -chdir="$TF_DIR" output -raw ws_scheme)"
CONTAINER_PORT="$(terraform -chdir="$TF_DIR" output -raw container_port)"
AWS_REGION="$(terraform -chdir="$TF_DIR" output -raw aws_region)"

AP_ID="$(aws efs create-access-point \
  --region "$AWS_REGION" \
  --file-system-id "$EFS_ID" \
  --posix-user Uid=1000,Gid=1000 \
  --root-directory "Path=/workspaces/${WORKSPACE_ID},CreationInfo={OwnerUid=1000,OwnerGid=1000,Permissions=0750}" \
  --tags "Key=Name,Value=${SERVICE_NAME}" "Key=workspace_id,Value=${WORKSPACE_ID}" \
  --query 'AccessPointId' --output text)"

TASK_DEF_FILE="$(mktemp)"
SERVICE_FILE="$(mktemp)"
trap 'rm -f "$TASK_DEF_FILE" "$SERVICE_FILE"' EXIT

cat >"$TASK_DEF_FILE" <<JSON
{
  "family": "${FAMILY_NAME}",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "${CPU}",
  "memory": "${MEMORY}",
  "executionRoleArn": "${EXEC_ROLE_ARN}",
  "taskRoleArn": "${TASK_ROLE_ARN}",
  "volumes": [
    {
      "name": "runtime-data",
      "efsVolumeConfiguration": {
        "fileSystemId": "${EFS_ID}",
        "transitEncryption": "ENABLED",
        "authorizationConfig": {
          "accessPointId": "${AP_ID}",
          "iam": "DISABLED"
        }
      }
    }
  ],
  "containerDefinitions": [
    {
      "name": "openclaw",
      "image": "${IMAGE}",
      "essential": true,
      "command": ["bash", "scripts/cloud/ecs/runtime-entrypoint.sh", "node", "dist/index.js", "gateway", "run", "--cloud", "--allow-unconfigured", "--bind", "lan", "--port", "${CONTAINER_PORT}", "--verbose"],
      "portMappings": [
        {
          "containerPort": ${CONTAINER_PORT},
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "OPENCLAW_GATEWAY_TOKEN", "value": "${GATEWAY_TOKEN}"},
        {"name": "OPENCLAW_SKIP_CHANNELS", "value": "${SKIP_CHANNELS}"},
        {"name": "OPENCLAW_SKIP_CRON", "value": "${SKIP_CRON}"},
        {"name": "OPENCLAW_STATE_DIR", "value": "/home/node/.bustly"},
        {"name": "OPENCLAW_CONFIG_PATH", "value": "/home/node/.bustly/openclaw.json"},
        {"name": "BUSTLY_WORKSPACE_ID", "value": "${WORKSPACE_ID}"},
        {"name": "BUSTLY_OAUTH_STATE_B64", "value": "${BUSTLY_OAUTH_STATE_B64}"},
        {"name": "BUSTLY_USER_ACCESS_TOKEN", "value": "${BUSTLY_USER_ACCESS_TOKEN}"},
        {"name": "BUSTLY_LOGIN_TRACE_ID", "value": "${BUSTLY_LOGIN_TRACE_ID}"},
        {"name": "BUSTLY_API_BASE_URL", "value": "${BUSTLY_API_BASE_URL}"},
        {"name": "BUSTLY_WEB_BASE_URL", "value": "${BUSTLY_WEB_BASE_URL}"},
        {"name": "BUSTLY_CLIENT_ID", "value": "${BUSTLY_CLIENT_ID}"}
      ],
      "mountPoints": [
        {
          "sourceVolume": "runtime-data",
          "containerPath": "/home/node/.bustly",
          "readOnly": false
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "${LOG_GROUP}",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "${SERVICE_NAME}"
        }
      }
    }
  ]
}
JSON

TASK_DEF_ARN="$(aws ecs register-task-definition \
  --region "$AWS_REGION" \
  --cli-input-json "file://${TASK_DEF_FILE}" \
  --query 'taskDefinition.taskDefinitionArn' --output text)"

HEALTH_CHECK_PATH="/runtime/${WORKSPACE_ID}/ui"
if [[ "$ROUTING_MODE" == "host" ]]; then
  HEALTH_CHECK_PATH="/ui"
fi

TG_ARN="$(aws elbv2 create-target-group \
  --region "$AWS_REGION" \
  --name "$TARGET_GROUP_NAME" \
  --protocol HTTP \
  --port "$CONTAINER_PORT" \
  --vpc-id "$VPC_ID" \
  --target-type ip \
  --health-check-protocol HTTP \
  --health-check-path "$HEALTH_CHECK_PATH" \
  --matcher HttpCode=200-499 \
  --query 'TargetGroups[0].TargetGroupArn' --output text)"

IFS=',' read -r -a SUBNET_ARRAY <<< "$SUBNETS_CSV"
SUBNET_JSON="$(printf '"%s",' "${SUBNET_ARRAY[@]}")"
SUBNET_JSON="[${SUBNET_JSON%,}]"

cat >"$SERVICE_FILE" <<JSON
{
  "cluster": "${CLUSTER_NAME}",
  "serviceName": "${SERVICE_NAME}",
  "taskDefinition": "${TASK_DEF_ARN}",
  "desiredCount": ${DESIRED_COUNT},
  "healthCheckGracePeriodSeconds": 180,
  "launchType": "FARGATE",
  "enableExecuteCommand": true,
  "networkConfiguration": {
    "awsvpcConfiguration": {
      "subnets": ${SUBNET_JSON},
      "securityGroups": ["${RUNTIME_SG_ID}"],
      "assignPublicIp": "ENABLED"
    }
  },
  "loadBalancers": [
    {
      "targetGroupArn": "${TG_ARN}",
      "containerName": "openclaw",
      "containerPort": ${CONTAINER_PORT}
    }
  ],
  "propagateTags": "SERVICE",
  "tags": [
    {"key": "workspace_id", "value": "${WORKSPACE_ID}"},
    {"key": "service", "value": "${SERVICE_NAME}"}
  ]
}
JSON

EXISTING_PRIORITIES="$(aws elbv2 describe-rules \
  --region "$AWS_REGION" \
  --listener-arn "$LISTENER_ARN" \
  --query 'Rules[].Priority' --output text)"

PRIORITY=100
for p in $EXISTING_PRIORITIES; do
  if [[ "$p" =~ ^[0-9]+$ ]] && (( p >= PRIORITY )); then
    PRIORITY=$((p + 1))
  fi
done

RULE_CONDITIONS="Field=path-pattern,Values=/runtime/${WORKSPACE_ID},/runtime/${WORKSPACE_ID}/*"
if [[ "$ROUTING_MODE" == "host" ]]; then
  RULE_CONDITIONS="Field=host-header,Values=${WORKSPACE_HOST}"
fi

RULE_ARN="$(aws elbv2 create-rule \
  --region "$AWS_REGION" \
  --listener-arn "$LISTENER_ARN" \
  --priority "$PRIORITY" \
  --conditions "$RULE_CONDITIONS" \
  --actions "Type=forward,TargetGroupArn=${TG_ARN}" \
  --query 'Rules[0].RuleArn' --output text)"

create_service_with_retry() {
  local max_attempts=30
  local sleep_seconds=10
  local attempt=1
  local output

  while (( attempt <= max_attempts )); do
    if output="$(aws ecs create-service --region "$AWS_REGION" --cli-input-json "file://${SERVICE_FILE}" 2>&1)"; then
      return 0
    fi

    if grep -q "still Draining" <<<"$output"; then
      echo "service name is still draining; waiting before retry (${attempt}/${max_attempts})..." >&2
      sleep "$sleep_seconds"
      attempt=$((attempt + 1))
      continue
    fi

    echo "$output" >&2
    return 1
  done

  echo "timed out waiting for ECS service name to leave draining state: ${SERVICE_NAME}" >&2
  return 1
}

create_service_with_retry
aws ecs wait services-stable --region "$AWS_REGION" --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME"

CREATED_AT="$(date +%s)"
EXPIRES_AT="$((CREATED_AT + 31536000))"
WORKSPACE_PATH="/runtime/${WORKSPACE_ID}"
if [[ "$ROUTING_MODE" == "host" ]]; then
  WORKSPACE_PATH="/"
fi

WS_URL="${WS_SCHEME}://${ALB_DNS}${WORKSPACE_PATH}"
if [[ "$ROUTING_MODE" == "host" ]]; then
  WS_URL="${WS_SCHEME}://${WORKSPACE_HOST}"
fi
HTTP_SCHEME="http"
if [[ "$WS_SCHEME" == "wss" ]]; then
  HTTP_SCHEME="https"
fi
HTTP_BASE_URL="${HTTP_SCHEME}://${ALB_DNS}${WORKSPACE_PATH}"
if [[ "$ROUTING_MODE" == "host" ]]; then
  HTTP_BASE_URL="${HTTP_SCHEME}://${WORKSPACE_HOST}"
fi

WORKSPACE_HOST_VALUE="$WORKSPACE_HOST"
if [[ -z "$WORKSPACE_HOST_VALUE" ]]; then
  WORKSPACE_HOST_VALUE="$ALB_DNS"
fi

aws dynamodb put-item \
  --region "$AWS_REGION" \
  --table-name "$TABLE_NAME" \
  --item "{
    \"workspace_id\": {\"S\": \"${WORKSPACE_ID}\"},
    \"service_name\": {\"S\": \"${SERVICE_NAME}\"},
    \"task_definition_arn\": {\"S\": \"${TASK_DEF_ARN}\"},
    \"target_group_arn\": {\"S\": \"${TG_ARN}\"},
    \"listener_rule_arn\": {\"S\": \"${RULE_ARN}\"},
    \"efs_access_point_id\": {\"S\": \"${AP_ID}\"},
    \"gateway_token\": {\"S\": \"${GATEWAY_TOKEN}\"},
    \"alb_dns\": {\"S\": \"${ALB_DNS}\"},
    \"ws_scheme\": {\"S\": \"${WS_SCHEME}\"},
    \"routing_mode\": {\"S\": \"${ROUTING_MODE}\"},
    \"workspace_host\": {\"S\": \"${WORKSPACE_HOST_VALUE}\"},
    \"workspace_path\": {\"S\": \"${WORKSPACE_PATH}\"},
    \"http_base_url\": {\"S\": \"${HTTP_BASE_URL}\"},
    \"ws_url\": {\"S\": \"${WS_URL}\"},
    \"created_at\": {\"N\": \"${CREATED_AT}\"},
    \"expires_at\": {\"N\": \"${EXPIRES_AT}\"}
  }" >/dev/null

echo "workspace runtime created"
echo "  workspace_id: ${WORKSPACE_ID}"
echo "  service_name: ${SERVICE_NAME}"
echo "  routing_mode: ${ROUTING_MODE}"
if [[ "$ROUTING_MODE" == "host" ]]; then
  echo "  workspace_host: ${WORKSPACE_HOST}"
fi
echo "  http_base_url: ${HTTP_BASE_URL}"
echo "  ws_url: ${WS_URL}"
echo "  gateway_token: ${GATEWAY_TOKEN}"
