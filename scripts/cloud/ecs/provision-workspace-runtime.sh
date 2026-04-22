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
    [--skip-resource-tags 1] \
    [--ephemeral-state 1] \
    [--skip-runtime-mapping-write 1] \
    [--cpu 1024] \
    [--memory 2048] \
    [--desired-count 1] \
    [--bustly-api-base-url <url>] \
    [--bustly-web-base-url <url>] \
    [--bustly-client-id <id>] \
    [--bustly-workspace-template-base-url <url>] \
    [--bustly-profile prod|test|custom] \
    [--disable-local-oauth-fallback 1] \
    [--bustly-supabase-url <url>] \
    [--bustly-supabase-anon-key <key>] \
    [--bustly-user-id <uuid>] \
    [--bustly-user-name <name>] \
    [--bustly-user-email <email>] \
    [--bustly-jwt-secret <secret>] \
    [--bustly-oauth-state-b64 <base64_json>] \
    [--bustly-user-access-token <token>] \
    [--bustly-supabase-access-token <token>] \
    [--bustly-refresh-token <token>] \
    [--bustly-legacy-supabase-refresh-token <token>] \
    [--bustly-supabase-access-token-expires-at <epoch_seconds>] \
    [--bustly-session-id <session_id>] \
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
SKIP_RESOURCE_TAGS="${OPENCLAW_SKIP_AWS_RESOURCE_TAGS:-0}"
EPHEMERAL_STATE="${OPENCLAW_EPHEMERAL_STATE:-0}"
SKIP_RUNTIME_MAPPING_WRITE="${OPENCLAW_SKIP_RUNTIME_MAPPING_WRITE:-0}"
CPU="1024"
MEMORY="2048"
DESIRED_COUNT="1"
BUSTLY_PROFILE="${OPENCLAW_BUSTLY_PROFILE:-prod}"
DISABLE_LOCAL_OAUTH_FALLBACK="${OPENCLAW_DISABLE_LOCAL_OAUTH_FALLBACK:-0}"
BUSTLY_ACCOUNT_API_BASE_URL=""
BUSTLY_ACCOUNT_WEB_BASE_URL=""
BUSTLY_API_BASE_URL=""
BUSTLY_WEB_BASE_URL=""
BUSTLY_CLIENT_ID=""
BUSTLY_WORKSPACE_TEMPLATE_BASE_URL="${BUSTLY_WORKSPACE_TEMPLATE_BASE_URL:-}"
BUSTLY_ACCOUNT_API_BASE_URL_DEFAULT="https://gw.bustly.ai/api/v1"
BUSTLY_ACCOUNT_WEB_BASE_URL_DEFAULT="https://www.bustly.ai"
BUSTLY_API_BASE_URL_DEFAULT="https://gw.bustly.ai/api/v1"
BUSTLY_WEB_BASE_URL_DEFAULT="https://www.bustly.ai"
BUSTLY_CLIENT_ID_DEFAULT="bustly-desktop"
BUSTLY_WORKSPACE_TEMPLATE_BASE_URL_DEFAULT="https://raw.githubusercontent.com/salerio-ai/bustly-prompts/main/openclaw-prompts"
BUSTLY_DEFAULT_ENABLED_SKILLS_JSON="${BUSTLY_DEFAULT_ENABLED_SKILLS_JSON:-}"
BUSTLY_SUPABASE_URL="${BUSTLY_SUPABASE_URL:-}"
BUSTLY_SUPABASE_ANON_KEY="${BUSTLY_SUPABASE_ANON_KEY:-}"
BUSTLY_USER_ID="${BUSTLY_USER_ID:-}"
BUSTLY_USER_NAME="${BUSTLY_USER_NAME:-}"
BUSTLY_USER_EMAIL="${BUSTLY_USER_EMAIL:-}"
BUSTLY_JWT_SECRET="${BUSTLY_JWT_SECRET:-}"
BUSTLY_OAUTH_STATE_B64=""
BUSTLY_USER_ACCESS_TOKEN=""
BUSTLY_SUPABASE_ACCESS_TOKEN="${BUSTLY_SUPABASE_ACCESS_TOKEN:-}"
BUSTLY_REFRESH_TOKEN="${BUSTLY_REFRESH_TOKEN:-}"
BUSTLY_LEGACY_SUPABASE_REFRESH_TOKEN="${BUSTLY_LEGACY_SUPABASE_REFRESH_TOKEN:-}"
BUSTLY_SUPABASE_ACCESS_TOKEN_EXPIRES_AT="${BUSTLY_SUPABASE_ACCESS_TOKEN_EXPIRES_AT:-}"
BUSTLY_SESSION_ID="${BUSTLY_SESSION_ID:-}"
BUSTLY_LOGIN_TRACE_ID=""
BUSTLY_GATEWAY_TOKEN_MODE="${BUSTLY_GATEWAY_TOKEN_MODE:-static}"
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
    --skip-resource-tags)
      SKIP_RESOURCE_TAGS="${2:-}"
      shift 2
      ;;
    --ephemeral-state)
      EPHEMERAL_STATE="${2:-}"
      shift 2
      ;;
    --skip-runtime-mapping-write)
      SKIP_RUNTIME_MAPPING_WRITE="${2:-}"
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
    --bustly-account-api-base-url)
      BUSTLY_ACCOUNT_API_BASE_URL="${2:-}"
      shift 2
      ;;
    --bustly-web-base-url)
      BUSTLY_WEB_BASE_URL="${2:-}"
      shift 2
      ;;
    --bustly-account-web-base-url)
      BUSTLY_ACCOUNT_WEB_BASE_URL="${2:-}"
      shift 2
      ;;
    --bustly-client-id)
      BUSTLY_CLIENT_ID="${2:-}"
      shift 2
      ;;
    --bustly-workspace-template-base-url)
      BUSTLY_WORKSPACE_TEMPLATE_BASE_URL="${2:-}"
      shift 2
      ;;
    --bustly-profile)
      BUSTLY_PROFILE="${2:-}"
      shift 2
      ;;
    --disable-local-oauth-fallback)
      DISABLE_LOCAL_OAUTH_FALLBACK="${2:-}"
      shift 2
      ;;
    --bustly-supabase-url)
      BUSTLY_SUPABASE_URL="${2:-}"
      shift 2
      ;;
    --bustly-supabase-anon-key)
      BUSTLY_SUPABASE_ANON_KEY="${2:-}"
      shift 2
      ;;
    --bustly-user-id)
      BUSTLY_USER_ID="${2:-}"
      shift 2
      ;;
    --bustly-user-name)
      BUSTLY_USER_NAME="${2:-}"
      shift 2
      ;;
    --bustly-user-email)
      BUSTLY_USER_EMAIL="${2:-}"
      shift 2
      ;;
    --bustly-jwt-secret)
      BUSTLY_JWT_SECRET="${2:-}"
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
    --bustly-supabase-access-token)
      BUSTLY_SUPABASE_ACCESS_TOKEN="${2:-}"
      shift 2
      ;;
    --bustly-refresh-token)
      BUSTLY_REFRESH_TOKEN="${2:-}"
      shift 2
      ;;
    --bustly-legacy-supabase-refresh-token)
      BUSTLY_LEGACY_SUPABASE_REFRESH_TOKEN="${2:-}"
      shift 2
      ;;
    --bustly-supabase-access-token-expires-at)
      BUSTLY_SUPABASE_ACCESS_TOKEN_EXPIRES_AT="${2:-}"
      shift 2
      ;;
    --bustly-session-id)
      BUSTLY_SESSION_ID="${2:-}"
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

if [[ "$BUSTLY_PROFILE" != "prod" && "$BUSTLY_PROFILE" != "test" && "$BUSTLY_PROFILE" != "custom" ]]; then
  echo "invalid --bustly-profile: $BUSTLY_PROFILE (expected prod|test|custom)" >&2
  exit 1
fi

if [[ "$BUSTLY_PROFILE" == "test" ]]; then
  BUSTLY_ACCOUNT_API_BASE_URL_DEFAULT="https://test-bustly-account.bustly.ai"
  BUSTLY_ACCOUNT_WEB_BASE_URL_DEFAULT="https://test-bustly-account.bustly.ai"
  BUSTLY_API_BASE_URL_DEFAULT="https://test-bustly-account.bustly.ai"
  BUSTLY_WEB_BASE_URL_DEFAULT="https://test-www.bustly.shop"
  BUSTLY_WORKSPACE_TEMPLATE_BASE_URL_DEFAULT="https://raw.githubusercontent.com/bustly-ai/bustly-prompts/testing/openclaw-prompts"
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

if [[ -n "$BUSTLY_OAUTH_STATE_B64" || -n "$BUSTLY_USER_ACCESS_TOKEN" || -n "$BUSTLY_SUPABASE_URL" || -n "$BUSTLY_SUPABASE_ANON_KEY" || -n "$BUSTLY_USER_ID" || -n "$BUSTLY_JWT_SECRET" ]]; then
  DISABLE_LOCAL_OAUTH_FALLBACK="1"
fi

if [[ -z "$BUSTLY_USER_ACCESS_TOKEN" && -z "$BUSTLY_OAUTH_STATE_B64" && -n "$BUSTLY_JWT_SECRET" && -n "$BUSTLY_USER_ID" ]]; then
  BUSTLY_USER_ACCESS_TOKEN="$(
    python3 - "$BUSTLY_JWT_SECRET" "$BUSTLY_USER_ID" <<'PY'
import base64
import hashlib
import hmac
import json
import sys
import time

secret = sys.argv[1]
user_id = sys.argv[2]
now = int(time.time())
header = {"alg": "HS256", "typ": "JWT"}
payload = {
    "iss": "supabase",
    "sub": user_id,
    "aud": "authenticated",
    "role": "authenticated",
    "email": "",
    "phone": "",
    "app_metadata": {"provider": "email", "providers": ["email"]},
    "user_metadata": {},
    "aal": "aal1",
    "session_id": f"cloud-runtime-{user_id[:12]}",
    "is_anonymous": False,
    "iat": now,
    "exp": now + 3600,
}

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")

signing_input = f"{b64url(json.dumps(header, separators=(',', ':')).encode())}.{b64url(json.dumps(payload, separators=(',', ':')).encode())}"
sig = hmac.new(secret.encode("utf-8"), signing_input.encode("ascii"), hashlib.sha256).digest()
print(f"{signing_input}.{b64url(sig)}")
PY
  )"
fi

if [[ -z "$BUSTLY_OAUTH_STATE_B64" && -n "$BUSTLY_USER_ACCESS_TOKEN" && -n "$BUSTLY_SUPABASE_URL" && -n "$BUSTLY_SUPABASE_ANON_KEY" ]]; then
  BUSTLY_OAUTH_STATE_B64="$(
    python3 - "$WORKSPACE_ID" "$BUSTLY_USER_ACCESS_TOKEN" "$BUSTLY_SUPABASE_URL" "$BUSTLY_SUPABASE_ANON_KEY" "$BUSTLY_USER_ID" "$BUSTLY_USER_NAME" "$BUSTLY_USER_EMAIL" "$BUSTLY_REFRESH_TOKEN" "$BUSTLY_LEGACY_SUPABASE_REFRESH_TOKEN" "$BUSTLY_SUPABASE_ACCESS_TOKEN_EXPIRES_AT" "$BUSTLY_SESSION_ID" <<'PY'
import base64
import json
import sys

(
    workspace_id,
    access_token,
    supabase_url,
    supabase_anon_key,
    user_id,
    user_name,
    user_email,
    bustly_refresh_token,
    legacy_supabase_refresh_token,
    supabase_access_token_expires_at,
    bustly_session_id,
) = sys.argv[1:12]

expires_at = None
if supabase_access_token_expires_at.strip():
    try:
        expires_at = int(supabase_access_token_expires_at)
    except Exception:
        expires_at = None
state = {
    "loginTraceId": f"cloud-{workspace_id[:12]}",
    "user": {
        "userId": user_id,
        "userName": user_name,
        "userEmail": user_email,
        "userAccessToken": access_token,
        "supabaseAccessToken": access_token,
        "supabaseAccessTokenExpiresAt": expires_at,
        "bustlyRefreshToken": bustly_refresh_token or None,
        "legacySupabaseRefreshToken": legacy_supabase_refresh_token or None,
        "bustlySessionId": bustly_session_id or None,
        "workspaceId": workspace_id,
    },
    "supabase": {
        "url": supabase_url,
        "anonKey": supabase_anon_key,
    },
}
print(base64.b64encode(json.dumps(state, ensure_ascii=False, separators=(",", ":")).encode("utf-8")).decode("ascii"))
PY
  )"
fi

LOCAL_OAUTH_PATH="${HOME}/.bustly/bustlyOauth.json"
if [[ "$DISABLE_LOCAL_OAUTH_FALLBACK" != "1" && -z "$BUSTLY_OAUTH_STATE_B64" && -f "$LOCAL_OAUTH_PATH" ]]; then
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
token = ((user.get("supabaseAccessToken") or user.get("userAccessToken")) or "").strip()
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
        "supabaseAccessToken": token,
        "supabaseAccessTokenExpiresAt": user.get("supabaseAccessTokenExpiresAt"),
        "bustlyRefreshToken": user.get("bustlyRefreshToken"),
        "legacySupabaseRefreshToken": user.get("legacySupabaseRefreshToken") or user.get("userRefreshToken"),
        "bustlySessionId": user.get("bustlySessionId"),
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
user = state.get("user") or {}
print(((user.get("supabaseAccessToken") or user.get("userAccessToken")) or "").strip())
PY
  )"
fi

if [[ -z "$BUSTLY_LOGIN_TRACE_ID" ]]; then
  BUSTLY_LOGIN_TRACE_ID="cloud-${WORKSPACE_ID:0:12}"
fi

if [[ -z "$BUSTLY_ACCOUNT_API_BASE_URL" ]]; then
  BUSTLY_ACCOUNT_API_BASE_URL="$BUSTLY_ACCOUNT_API_BASE_URL_DEFAULT"
fi
if [[ -z "$BUSTLY_ACCOUNT_WEB_BASE_URL" ]]; then
  BUSTLY_ACCOUNT_WEB_BASE_URL="$BUSTLY_ACCOUNT_WEB_BASE_URL_DEFAULT"
fi
if [[ -z "$BUSTLY_API_BASE_URL" ]]; then
  BUSTLY_API_BASE_URL="$BUSTLY_ACCOUNT_API_BASE_URL"
fi
if [[ -z "$BUSTLY_WEB_BASE_URL" ]]; then
  BUSTLY_WEB_BASE_URL="$BUSTLY_WEB_BASE_URL_DEFAULT"
fi
if [[ -z "$BUSTLY_CLIENT_ID" ]]; then
  BUSTLY_CLIENT_ID="$BUSTLY_CLIENT_ID_DEFAULT"
fi
if [[ -z "$BUSTLY_WORKSPACE_TEMPLATE_BASE_URL" ]]; then
  BUSTLY_WORKSPACE_TEMPLATE_BASE_URL="$BUSTLY_WORKSPACE_TEMPLATE_BASE_URL_DEFAULT"
fi

AUTH_TOKEN_RESOLUTION="$(
  WORKSPACE_ID="$WORKSPACE_ID" \
  BUSTLY_OAUTH_STATE_B64="$BUSTLY_OAUTH_STATE_B64" \
  BUSTLY_USER_ACCESS_TOKEN="$BUSTLY_USER_ACCESS_TOKEN" \
  BUSTLY_SUPABASE_ACCESS_TOKEN="$BUSTLY_SUPABASE_ACCESS_TOKEN" \
  BUSTLY_REFRESH_TOKEN="$BUSTLY_REFRESH_TOKEN" \
  BUSTLY_LEGACY_SUPABASE_REFRESH_TOKEN="$BUSTLY_LEGACY_SUPABASE_REFRESH_TOKEN" \
  BUSTLY_SUPABASE_ACCESS_TOKEN_EXPIRES_AT="$BUSTLY_SUPABASE_ACCESS_TOKEN_EXPIRES_AT" \
  BUSTLY_SESSION_ID="$BUSTLY_SESSION_ID" \
  BUSTLY_USER_ID="$BUSTLY_USER_ID" \
  BUSTLY_USER_NAME="$BUSTLY_USER_NAME" \
  BUSTLY_USER_EMAIL="$BUSTLY_USER_EMAIL" \
  BUSTLY_SUPABASE_URL="$BUSTLY_SUPABASE_URL" \
  BUSTLY_SUPABASE_ANON_KEY="$BUSTLY_SUPABASE_ANON_KEY" \
  BUSTLY_LOGIN_TRACE_ID="$BUSTLY_LOGIN_TRACE_ID" \
  BUSTLY_ACCOUNT_API_BASE_URL="$BUSTLY_ACCOUNT_API_BASE_URL" \
  python3 - <<'PY'
import base64
import json
import os
import shlex
import sys
import urllib.error
import urllib.parse
import urllib.request


def text(value):
    if value is None:
        return ""
    return str(value).strip()


def pick(*values):
    for value in values:
        normalized = text(value)
        if normalized:
            return normalized
    return ""


def decode_oauth_state(encoded):
    payload = text(encoded)
    if not payload:
        return {}
    try:
        raw = base64.b64decode(payload).decode("utf-8")
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        return {}
    return {}


def decode_jwt_claims(token):
    raw = text(token)
    if not raw:
        return {}
    parts = raw.split(".")
    if len(parts) < 2:
        return {}
    body = parts[1]
    body += "=" * ((4 - len(body) % 4) % 4)
    try:
        decoded = base64.urlsafe_b64decode(body.encode("ascii")).decode("utf-8")
        parsed = json.loads(decoded)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        return {}
    return {}


def request_json(url, method="GET", headers=None, body=None):
    data = None
    if body is not None:
        if isinstance(body, (dict, list)):
            data = json.dumps(body).encode("utf-8")
        elif isinstance(body, str):
            data = body.encode("utf-8")
        else:
            data = body
    req = urllib.request.Request(url, data=data, method=method)
    for key, value in (headers or {}).items():
        if value is not None:
            req.add_header(key, value)

    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            status = int(resp.getcode() or 0)
            payload = resp.read().decode("utf-8", errors="replace")
            return status, payload, ""
    except urllib.error.HTTPError as err:
        payload = err.read().decode("utf-8", errors="replace")
        return int(err.code or 0), payload, ""
    except Exception as err:
        return 0, "", str(err)


def parse_json_object(raw):
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        return {}
    return {}


def verify_supabase_token(supabase_url, supabase_anon_key, access_token):
    url = f"{supabase_url.rstrip('/')}/auth/v1/user"
    status, payload, transport_error = request_json(
        url,
        method="GET",
        headers={
            "Authorization": f"Bearer {access_token}",
            "apikey": supabase_anon_key,
            "Accept": "application/json",
        },
    )
    if status == 200:
        return True, status, ""
    reason = payload.strip() or transport_error or "unknown error"
    return False, status, reason[:320]


def refresh_supabase_legacy(supabase_url, supabase_anon_key, refresh_token):
    url = f"{supabase_url.rstrip('/')}/auth/v1/token?grant_type=refresh_token"
    status, payload, transport_error = request_json(
        url,
        method="POST",
        headers={
            "apikey": supabase_anon_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        body={"refresh_token": refresh_token},
    )
    if status != 200:
        reason = payload.strip() or transport_error or "unknown error"
        return False, {}, f"Supabase refresh failed ({status}): {reason[:320]}"

    data = parse_json_object(payload)
    access_token = text(data.get("access_token"))
    if not access_token:
        return False, {}, "Supabase refresh returned no access_token"
    return (
        True,
        {
            "access_token": access_token,
            "refresh_token": text(data.get("refresh_token")),
            "expires_at": text(data.get("expires_at")),
            "session_id": text(decode_jwt_claims(access_token).get("session_id")),
        },
        "",
    )


def refresh_bustly(account_api_base_url, refresh_token):
    endpoint = f"{account_api_base_url.rstrip('/')}/api/oauth/api/v1/oauth/refresh"
    status, payload, transport_error = request_json(
        endpoint,
        method="POST",
        headers={
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body=urllib.parse.urlencode({"refresh_token": refresh_token}),
    )
    if status != 200:
        reason = payload.strip() or transport_error or "unknown error"
        return False, {}, f"Bustly refresh failed ({status}): {reason[:320]}"

    envelope = parse_json_object(payload)
    if not envelope:
        return False, {}, "Bustly refresh returned invalid JSON"
    envelope_status = text(envelope.get("status"))
    if envelope_status and envelope_status != "0":
        return False, {}, f"Bustly refresh rejected: {text(envelope.get('message'))[:320]}"

    data = envelope.get("data")
    if not isinstance(data, dict):
        data = {}
    extras = data.get("extras")
    if not isinstance(extras, dict):
        extras = {}
    supabase_session = extras.get("supabase_session")
    if not isinstance(supabase_session, dict):
        supabase_session = {}

    access_token = pick(
        data.get("supabaseAccessToken"),
        data.get("accessToken"),
        supabase_session.get("access_token"),
    )
    if not access_token:
        return False, {}, "Bustly refresh returned no Supabase access token"

    return (
        True,
        {
            "access_token": access_token,
            "bustly_refresh_token": text(data.get("refreshToken")),
            "legacy_supabase_refresh_token": pick(
                data.get("legacySupabaseRefreshToken"),
                data.get("userRefreshToken"),
                supabase_session.get("refresh_token"),
            ),
            "expires_at": pick(
                data.get("supabaseAccessTokenExpiresAt"),
                data.get("expiresAt"),
            ),
            "session_id": pick(
                data.get("bustlySessionId"),
                decode_jwt_claims(access_token).get("session_id"),
            ),
        },
        "",
    )


def shell_export(name, value):
    return f"{name}={shlex.quote(text(value))}"


state = decode_oauth_state(os.environ.get("BUSTLY_OAUTH_STATE_B64"))
state_user = state.get("user") if isinstance(state.get("user"), dict) else {}
state_supabase = state.get("supabase") if isinstance(state.get("supabase"), dict) else {}

workspace_id = text(os.environ.get("WORKSPACE_ID"))
login_trace_id = pick(os.environ.get("BUSTLY_LOGIN_TRACE_ID"), state.get("loginTraceId"), f"cloud-{workspace_id[:12]}")
supabase_access_token = pick(
    os.environ.get("BUSTLY_USER_ACCESS_TOKEN"),
    os.environ.get("BUSTLY_SUPABASE_ACCESS_TOKEN"),
    state_user.get("supabaseAccessToken"),
    state_user.get("userAccessToken"),
)
user_access_token = pick(
    os.environ.get("BUSTLY_USER_ACCESS_TOKEN"),
    supabase_access_token,
    state_user.get("userAccessToken"),
)
bustly_refresh_token = pick(
    os.environ.get("BUSTLY_REFRESH_TOKEN"),
    state_user.get("bustlyRefreshToken"),
)
legacy_supabase_refresh_token = pick(
    os.environ.get("BUSTLY_LEGACY_SUPABASE_REFRESH_TOKEN"),
    state_user.get("legacySupabaseRefreshToken"),
    state_user.get("userRefreshToken"),
)
supabase_access_token_expires_at = pick(
    os.environ.get("BUSTLY_SUPABASE_ACCESS_TOKEN_EXPIRES_AT"),
    state_user.get("supabaseAccessTokenExpiresAt"),
)
session_id = pick(
    os.environ.get("BUSTLY_SESSION_ID"),
    state_user.get("bustlySessionId"),
    decode_jwt_claims(supabase_access_token or user_access_token).get("session_id"),
)
user_id = pick(os.environ.get("BUSTLY_USER_ID"), state_user.get("userId"))
user_name = pick(os.environ.get("BUSTLY_USER_NAME"), state_user.get("userName"))
user_email = pick(os.environ.get("BUSTLY_USER_EMAIL"), state_user.get("userEmail"))
supabase_url = pick(os.environ.get("BUSTLY_SUPABASE_URL"), state_supabase.get("url"))
supabase_anon_key = pick(os.environ.get("BUSTLY_SUPABASE_ANON_KEY"), state_supabase.get("anonKey"))
account_api_base_url = text(os.environ.get("BUSTLY_ACCOUNT_API_BASE_URL"))

if supabase_access_token and supabase_url and supabase_anon_key:
    valid, status, reason = verify_supabase_token(
        supabase_url, supabase_anon_key, supabase_access_token
    )
    if not valid:
        refreshed = False
        refresh_errors = []

        if legacy_supabase_refresh_token:
            ok, payload, error = refresh_supabase_legacy(
                supabase_url, supabase_anon_key, legacy_supabase_refresh_token
            )
            if ok:
                supabase_access_token = payload.get("access_token", supabase_access_token)
                user_access_token = supabase_access_token
                if payload.get("refresh_token"):
                    legacy_supabase_refresh_token = payload.get("refresh_token", legacy_supabase_refresh_token)
                if payload.get("expires_at"):
                    supabase_access_token_expires_at = payload.get("expires_at", supabase_access_token_expires_at)
                if payload.get("session_id"):
                    session_id = payload.get("session_id", session_id)
                refreshed = True
            elif error:
                refresh_errors.append(error)

        if not refreshed and bustly_refresh_token and account_api_base_url:
            ok, payload, error = refresh_bustly(account_api_base_url, bustly_refresh_token)
            if ok:
                supabase_access_token = payload.get("access_token", supabase_access_token)
                user_access_token = supabase_access_token
                if payload.get("bustly_refresh_token"):
                    bustly_refresh_token = payload.get("bustly_refresh_token", bustly_refresh_token)
                if payload.get("legacy_supabase_refresh_token"):
                    legacy_supabase_refresh_token = payload.get(
                        "legacy_supabase_refresh_token", legacy_supabase_refresh_token
                    )
                if payload.get("expires_at"):
                    supabase_access_token_expires_at = payload.get("expires_at", supabase_access_token_expires_at)
                if payload.get("session_id"):
                    session_id = payload.get("session_id", session_id)
                refreshed = True
            elif error:
                refresh_errors.append(error)

        if not refreshed:
            context = f"supabase token validation failed ({status})"
            if reason:
                context = f"{context}: {reason}"
            if refresh_errors:
                context = f"{context}; refresh attempts: {' | '.join(refresh_errors)}"
            print(f"error: {context}", file=sys.stderr)
            sys.exit(1)

        valid, status, reason = verify_supabase_token(
            supabase_url, supabase_anon_key, supabase_access_token
        )
        if not valid:
            context = f"refreshed supabase token validation failed ({status})"
            if reason:
                context = f"{context}: {reason}"
            print(f"error: {context}", file=sys.stderr)
            sys.exit(1)

for line in [
    shell_export("BUSTLY_LOGIN_TRACE_ID", login_trace_id),
    shell_export("BUSTLY_USER_ACCESS_TOKEN", user_access_token),
    shell_export("BUSTLY_SUPABASE_ACCESS_TOKEN", supabase_access_token),
    shell_export("BUSTLY_REFRESH_TOKEN", bustly_refresh_token),
    shell_export("BUSTLY_LEGACY_SUPABASE_REFRESH_TOKEN", legacy_supabase_refresh_token),
    shell_export("BUSTLY_SUPABASE_ACCESS_TOKEN_EXPIRES_AT", supabase_access_token_expires_at),
    shell_export("BUSTLY_SESSION_ID", session_id),
    shell_export("BUSTLY_USER_ID", user_id),
    shell_export("BUSTLY_USER_NAME", user_name),
    shell_export("BUSTLY_USER_EMAIL", user_email),
    shell_export("BUSTLY_SUPABASE_URL", supabase_url),
    shell_export("BUSTLY_SUPABASE_ANON_KEY", supabase_anon_key),
]:
    print(line)
PY
)"
eval "$AUTH_TOKEN_RESOLUTION"
if [[ -z "$BUSTLY_USER_ACCESS_TOKEN" ]]; then
  BUSTLY_USER_ACCESS_TOKEN="$BUSTLY_SUPABASE_ACCESS_TOKEN"
fi
if [[ -z "$BUSTLY_SUPABASE_ACCESS_TOKEN" ]]; then
  BUSTLY_SUPABASE_ACCESS_TOKEN="$BUSTLY_USER_ACCESS_TOKEN"
fi

if [[ -z "$BUSTLY_DEFAULT_ENABLED_SKILLS_JSON" ]]; then
  DEFAULT_ENABLED_SKILLS_PATH="${OPENCLAW_DEFAULT_ENABLED_SKILLS_PATH:-${PWD}/bustly-skills/skills/.bustly-default-enabled.json}"
  if [[ -f "$DEFAULT_ENABLED_SKILLS_PATH" ]]; then
    BUSTLY_DEFAULT_ENABLED_SKILLS_JSON="$(
      python3 - "$DEFAULT_ENABLED_SKILLS_PATH" <<'PY'
import json
import sys

path = sys.argv[1]
try:
    with open(path, "r", encoding="utf-8") as f:
        payload = json.load(f)
except Exception:
    print("")
    raise SystemExit(0)

if not isinstance(payload, dict):
    print("")
    raise SystemExit(0)

default_enabled = payload.get("defaultEnabled")
if not isinstance(default_enabled, list):
    print("")
    raise SystemExit(0)

normalized = [entry.strip() for entry in default_enabled if isinstance(entry, str) and entry.strip()]
if not normalized:
    print("")
    raise SystemExit(0)

print(json.dumps(normalized, ensure_ascii=False, separators=(",", ":")))
PY
    )"
  fi
fi

NAME_SUFFIX="$(slug_hash "$WORKSPACE_ID")"
SERVICE_NAME="oc-${NAME_SUFFIX}"
TARGET_GROUP_NAME="oc-${NAME_SUFFIX}"
FAMILY_NAME="oc-${NAME_SUFFIX}"
WORKSPACE_HOST=""

if [[ "$ROUTING_MODE" == "host" ]]; then
  WORKSPACE_HOST="ws-${NAME_SUFFIX}.${RUNTIME_DOMAIN_SUFFIX}"
fi

CLUSTER_NAME="$(read_value_from_env_or_tf_output OPENCLAW_ECS_CLUSTER_NAME ecs_cluster_name)"
VPC_ID="$(read_value_from_env_or_tf_output OPENCLAW_VPC_ID vpc_id)"
SUBNETS_CSV="$(read_value_from_env_or_tf_output OPENCLAW_PUBLIC_SUBNET_IDS_CSV public_subnet_ids_csv)"
RUNTIME_SG_ID="$(read_value_from_env_or_tf_output OPENCLAW_RUNTIME_SECURITY_GROUP_ID runtime_security_group_id)"
EXEC_ROLE_ARN="$(read_value_from_env_or_tf_output OPENCLAW_ECS_TASK_EXECUTION_ROLE_ARN ecs_task_execution_role_arn)"
TASK_ROLE_ARN="$(read_value_from_env_or_tf_output OPENCLAW_ECS_TASK_ROLE_ARN ecs_task_role_arn)"
LOG_GROUP="$(read_value_from_env_or_tf_output OPENCLAW_CLOUDWATCH_LOG_GROUP_NAME cloudwatch_log_group_name)"
TABLE_NAME="$(read_value_from_env_or_tf_output OPENCLAW_WORKSPACE_RUNTIME_TABLE_NAME workspace_runtime_table_name)"
LISTENER_ARN="$(read_value_from_env_or_tf_output OPENCLAW_ALB_LISTENER_ARN_FOR_RULES alb_listener_arn_for_rules)"
ALB_DNS="$(read_value_from_env_or_tf_output OPENCLAW_ALB_DNS_NAME alb_dns_name)"
WS_SCHEME="$(read_value_from_env_or_tf_output OPENCLAW_WS_SCHEME ws_scheme)"
CONTAINER_PORT="$(read_value_from_env_or_tf_output OPENCLAW_CONTAINER_PORT container_port)"
AWS_REGION="$(read_value_from_env_or_tf_output OPENCLAW_AWS_REGION aws_region)"

AP_ID=""
VOLUMES_JSON='[]'
MOUNT_POINTS_JSON='[]'
if [[ "$EPHEMERAL_STATE" != "1" ]]; then
  EFS_ID="$(read_value_from_env_or_tf_output OPENCLAW_EFS_FILE_SYSTEM_ID efs_file_system_id)"

  ACCESS_POINT_ARGS=(
    --region "$AWS_REGION"
    --file-system-id "$EFS_ID"
    --posix-user Uid=1000,Gid=1000
    --root-directory "Path=/workspaces/${WORKSPACE_ID},CreationInfo={OwnerUid=1000,OwnerGid=1000,Permissions=0750}"
  )

  if [[ "$SKIP_RESOURCE_TAGS" != "1" ]]; then
    ACCESS_POINT_ARGS+=(--tags "Key=Name,Value=${SERVICE_NAME}" "Key=workspace_id,Value=${WORKSPACE_ID}")
  fi

  AP_ID="$(aws efs create-access-point \
    "${ACCESS_POINT_ARGS[@]}" \
    --query 'AccessPointId' --output text)"

  VOLUMES_JSON="$(cat <<JSON
[
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
]
JSON
)"

  MOUNT_POINTS_JSON="$(cat <<JSON
[
  {
    "sourceVolume": "runtime-data",
    "containerPath": "/home/node/.bustly",
    "readOnly": false
  }
]
JSON
)"
fi

TASK_DEF_FILE="$(mktemp)"
SERVICE_FILE="$(mktemp)"
trap 'rm -f "$TASK_DEF_FILE" "$SERVICE_FILE"' EXIT

# Ensure the task environment JSON below sees the resolved shell variables.
export GATEWAY_TOKEN
export SKIP_CHANNELS
export SKIP_CRON
export WORKSPACE_ID
export BUSTLY_OAUTH_STATE_B64
export BUSTLY_USER_ACCESS_TOKEN
export BUSTLY_SUPABASE_ACCESS_TOKEN
export BUSTLY_REFRESH_TOKEN
export BUSTLY_LEGACY_SUPABASE_REFRESH_TOKEN
export BUSTLY_SUPABASE_ACCESS_TOKEN_EXPIRES_AT
export BUSTLY_SESSION_ID
export BUSTLY_USER_ID
export BUSTLY_USER_NAME
export BUSTLY_USER_EMAIL
export BUSTLY_SUPABASE_URL
export BUSTLY_SUPABASE_ANON_KEY
export BUSTLY_LOGIN_TRACE_ID
export BUSTLY_ACCOUNT_API_BASE_URL
export BUSTLY_ACCOUNT_WEB_BASE_URL
export BUSTLY_API_BASE_URL
export BUSTLY_WEB_BASE_URL
export BUSTLY_CLIENT_ID
export BUSTLY_WORKSPACE_TEMPLATE_BASE_URL
export BUSTLY_GATEWAY_TOKEN_MODE
export BUSTLY_DEFAULT_ENABLED_SKILLS_JSON

ENVIRONMENT_JSON="$(
  python3 - <<'PY'
import json
import os

env = [
    {"name": "OPENCLAW_GATEWAY_TOKEN", "value": os.environ.get("GATEWAY_TOKEN", "")},
    {"name": "OPENCLAW_SKIP_CHANNELS", "value": os.environ.get("SKIP_CHANNELS", "")},
    {"name": "OPENCLAW_SKIP_CRON", "value": os.environ.get("SKIP_CRON", "")},
    {"name": "OPENCLAW_STATE_DIR", "value": "/home/node/.bustly"},
    {"name": "OPENCLAW_CONFIG_PATH", "value": "/home/node/.bustly/openclaw.json"},
    {"name": "BUSTLY_WORKSPACE_ID", "value": os.environ.get("WORKSPACE_ID", "")},
    {"name": "BUSTLY_OAUTH_STATE_B64", "value": os.environ.get("BUSTLY_OAUTH_STATE_B64", "")},
    {"name": "BUSTLY_USER_ACCESS_TOKEN", "value": os.environ.get("BUSTLY_USER_ACCESS_TOKEN", "")},
    {"name": "BUSTLY_SUPABASE_ACCESS_TOKEN", "value": os.environ.get("BUSTLY_SUPABASE_ACCESS_TOKEN", "")},
    {"name": "BUSTLY_REFRESH_TOKEN", "value": os.environ.get("BUSTLY_REFRESH_TOKEN", "")},
    {
        "name": "BUSTLY_LEGACY_SUPABASE_REFRESH_TOKEN",
        "value": os.environ.get("BUSTLY_LEGACY_SUPABASE_REFRESH_TOKEN", ""),
    },
    {
        "name": "BUSTLY_SUPABASE_ACCESS_TOKEN_EXPIRES_AT",
        "value": os.environ.get("BUSTLY_SUPABASE_ACCESS_TOKEN_EXPIRES_AT", ""),
    },
    {"name": "BUSTLY_SESSION_ID", "value": os.environ.get("BUSTLY_SESSION_ID", "")},
    {"name": "BUSTLY_USER_ID", "value": os.environ.get("BUSTLY_USER_ID", "")},
    {"name": "BUSTLY_USER_NAME", "value": os.environ.get("BUSTLY_USER_NAME", "")},
    {"name": "BUSTLY_USER_EMAIL", "value": os.environ.get("BUSTLY_USER_EMAIL", "")},
    {"name": "BUSTLY_SUPABASE_URL", "value": os.environ.get("BUSTLY_SUPABASE_URL", "")},
    {"name": "BUSTLY_SUPABASE_ANON_KEY", "value": os.environ.get("BUSTLY_SUPABASE_ANON_KEY", "")},
    {"name": "BUSTLY_LOGIN_TRACE_ID", "value": os.environ.get("BUSTLY_LOGIN_TRACE_ID", "")},
    {"name": "BUSTLY_ACCOUNT_API_BASE_URL", "value": os.environ.get("BUSTLY_ACCOUNT_API_BASE_URL", "")},
    {"name": "BUSTLY_ACCOUNT_WEB_BASE_URL", "value": os.environ.get("BUSTLY_ACCOUNT_WEB_BASE_URL", "")},
    {"name": "BUSTLY_API_BASE_URL", "value": os.environ.get("BUSTLY_API_BASE_URL", "")},
    {"name": "BUSTLY_WEB_BASE_URL", "value": os.environ.get("BUSTLY_WEB_BASE_URL", "")},
    {"name": "BUSTLY_CLIENT_ID", "value": os.environ.get("BUSTLY_CLIENT_ID", "")},
    {
        "name": "BUSTLY_WORKSPACE_TEMPLATE_BASE_URL",
        "value": os.environ.get("BUSTLY_WORKSPACE_TEMPLATE_BASE_URL", ""),
    },
    {"name": "BUSTLY_GATEWAY_TOKEN_MODE", "value": os.environ.get("BUSTLY_GATEWAY_TOKEN_MODE", "static")},
    {
        "name": "BUSTLY_DEFAULT_ENABLED_SKILLS_JSON",
        "value": os.environ.get("BUSTLY_DEFAULT_ENABLED_SKILLS_JSON", ""),
    },
]

print(json.dumps(env))
PY
)"

cat >"$TASK_DEF_FILE" <<JSON
{
  "family": "${FAMILY_NAME}",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "${CPU}",
  "memory": "${MEMORY}",
  "executionRoleArn": "${EXEC_ROLE_ARN}",
  "taskRoleArn": "${TASK_ROLE_ARN}",
  "volumes": ${VOLUMES_JSON},
  "containerDefinitions": [
    {
      "name": "openclaw",
      "image": "${IMAGE}",
      "essential": true,
      "command": ["bash", "scripts/cloud/ecs/runtime-entrypoint.sh", "node", "dist/index.js", "gateway", "run", "--cloud", "--allow-unconfigured", "--bind", "lan", "--port", "${CONTAINER_PORT}", "--token", "${GATEWAY_TOKEN}", "--verbose"],
      "portMappings": [
        {
          "containerPort": ${CONTAINER_PORT},
          "protocol": "tcp"
        }
      ],
      "environment": ${ENVIRONMENT_JSON},
      "mountPoints": ${MOUNT_POINTS_JSON},
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

HEALTH_CHECK_PATH="/runtime/${WORKSPACE_ID}/"
if [[ "$ROUTING_MODE" == "host" ]]; then
  HEALTH_CHECK_PATH="/"
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
  "tags": $(if [[ "$SKIP_RESOURCE_TAGS" == "1" ]]; then echo '[]'; else echo "[{\"key\": \"workspace_id\", \"value\": \"${WORKSPACE_ID}\"},{\"key\": \"service\", \"value\": \"${SERVICE_NAME}\"}]"; fi)
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

if [[ "$SKIP_RUNTIME_MAPPING_WRITE" != "1" ]]; then
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
fi

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
echo "  bustly_workspace_template_base_url: ${BUSTLY_WORKSPACE_TEMPLATE_BASE_URL}"
