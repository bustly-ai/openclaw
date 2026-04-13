#!/usr/bin/env bash
set -euo pipefail

STATE_DIR="${OPENCLAW_STATE_DIR:-/home/node/.bustly}"
OAUTH_PATH="${BUSTLY_OAUTH_PATH:-${STATE_DIR}/bustlyOauth.json}"
CONFIG_PATH="${OPENCLAW_CONFIG_PATH:-${STATE_DIR}/openclaw.json}"
WORKSPACE_ID="${BUSTLY_WORKSPACE_ID:-}"
OAUTH_STATE_B64="${BUSTLY_OAUTH_STATE_B64:-}"
USER_ACCESS_TOKEN="${BUSTLY_USER_ACCESS_TOKEN:-}"
LOGIN_TRACE_ID="${BUSTLY_LOGIN_TRACE_ID:-}"

if [[ -n "$OAUTH_STATE_B64" ]]; then
  mkdir -p "$(dirname "$OAUTH_PATH")"
  umask 077
  OAUTH_PATH="$OAUTH_PATH" BUSTLY_WORKSPACE_ID="$WORKSPACE_ID" BUSTLY_OAUTH_STATE_B64="$OAUTH_STATE_B64" node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const oauthPath = process.env.OAUTH_PATH;
const workspaceId = (process.env.BUSTLY_WORKSPACE_ID || "").trim();
const encodedState = process.env.BUSTLY_OAUTH_STATE_B64 || "";
const raw = Buffer.from(encodedState, "base64").toString("utf8");
const state = JSON.parse(raw || "{}");

if (workspaceId) {
  state.user = state.user || {};
  state.user.workspaceId = workspaceId;
}

fs.mkdirSync(path.dirname(oauthPath), { recursive: true });
fs.writeFileSync(oauthPath, JSON.stringify(state, null, 2));
NODE
elif [[ -n "$USER_ACCESS_TOKEN" && -n "$WORKSPACE_ID" ]]; then
  if [[ -z "$LOGIN_TRACE_ID" ]]; then
    LOGIN_TRACE_ID="cloud-${WORKSPACE_ID:0:12}"
  fi

  mkdir -p "$(dirname "$OAUTH_PATH")"
  umask 077

  cat >"$OAUTH_PATH" <<JSON
{
  "loginTraceId": "${LOGIN_TRACE_ID}",
  "user": {
    "userAccessToken": "${USER_ACCESS_TOKEN}",
    "workspaceId": "${WORKSPACE_ID}"
  }
}
JSON
fi

if [[ "${OPENCLAW_CLOUD_CONTROL_UI_HOST_FALLBACK:-1}" == "1" ]]; then
  mkdir -p "$(dirname "$CONFIG_PATH")"
  OPENCLAW_CONFIG_PATH="$CONFIG_PATH" BUSTLY_WEB_BASE_URL="${BUSTLY_WEB_BASE_URL:-}" node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const configPath = process.env.OPENCLAW_CONFIG_PATH;
const webBaseUrl = (process.env.BUSTLY_WEB_BASE_URL || "").trim();

let config = {};
try {
  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    config = parsed;
  }
} catch {
  config = {};
}

if (!config.gateway || typeof config.gateway !== "object" || Array.isArray(config.gateway)) {
  config.gateway = {};
}
if (
  !config.gateway.controlUi ||
  typeof config.gateway.controlUi !== "object" ||
  Array.isArray(config.gateway.controlUi)
) {
  config.gateway.controlUi = {};
}

config.gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback = true;

if (webBaseUrl) {
  try {
    const origin = new URL(webBaseUrl).origin;
    if (
      !Array.isArray(config.gateway.controlUi.allowedOrigins) ||
      config.gateway.controlUi.allowedOrigins.length === 0
    ) {
      config.gateway.controlUi.allowedOrigins = [origin];
    }
  } catch {
    // Ignore invalid web url and keep fallback mode enabled.
  }
}

fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
NODE
fi

exec "$@"
