#!/usr/bin/env bash
set -euo pipefail

STATE_DIR="${OPENCLAW_STATE_DIR:-/home/node/.bustly}"
OAUTH_PATH="${BUSTLY_OAUTH_PATH:-${STATE_DIR}/bustlyOauth.json}"
CONFIG_PATH="${OPENCLAW_CONFIG_PATH:-${STATE_DIR}/openclaw.json}"
WORKSPACE_ID="${BUSTLY_WORKSPACE_ID:-}"
OAUTH_STATE_B64="${BUSTLY_OAUTH_STATE_B64:-}"
USER_ACCESS_TOKEN="${BUSTLY_USER_ACCESS_TOKEN:-}"
REFRESH_TOKEN="${BUSTLY_REFRESH_TOKEN:-}"
LEGACY_SUPABASE_REFRESH_TOKEN="${BUSTLY_LEGACY_SUPABASE_REFRESH_TOKEN:-}"
SUPABASE_ACCESS_TOKEN_EXPIRES_AT="${BUSTLY_SUPABASE_ACCESS_TOKEN_EXPIRES_AT:-}"
SESSION_ID="${BUSTLY_SESSION_ID:-}"
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
  OAUTH_PATH="$OAUTH_PATH" \
  BUSTLY_LOGIN_TRACE_ID="$LOGIN_TRACE_ID" \
  BUSTLY_WORKSPACE_ID="$WORKSPACE_ID" \
  BUSTLY_USER_ACCESS_TOKEN="$USER_ACCESS_TOKEN" \
  BUSTLY_REFRESH_TOKEN="$REFRESH_TOKEN" \
  BUSTLY_LEGACY_SUPABASE_REFRESH_TOKEN="$LEGACY_SUPABASE_REFRESH_TOKEN" \
  BUSTLY_SUPABASE_ACCESS_TOKEN_EXPIRES_AT="$SUPABASE_ACCESS_TOKEN_EXPIRES_AT" \
  BUSTLY_SESSION_ID="$SESSION_ID" \
  node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const oauthPath = process.env.OAUTH_PATH;
const loginTraceId = (process.env.BUSTLY_LOGIN_TRACE_ID || "").trim();
const workspaceId = (process.env.BUSTLY_WORKSPACE_ID || "").trim();
const accessToken = (process.env.BUSTLY_USER_ACCESS_TOKEN || "").trim();
const refreshToken = (process.env.BUSTLY_REFRESH_TOKEN || "").trim();
const legacySupabaseRefreshToken = (
  process.env.BUSTLY_LEGACY_SUPABASE_REFRESH_TOKEN || ""
).trim();
const sessionId = (process.env.BUSTLY_SESSION_ID || "").trim();
const expiresAtRaw = (process.env.BUSTLY_SUPABASE_ACCESS_TOKEN_EXPIRES_AT || "").trim();

let expiresAt;
if (expiresAtRaw) {
  const parsed = Number(expiresAtRaw);
  if (Number.isFinite(parsed) && parsed > 0) {
    expiresAt = parsed;
  }
}

const state = {
  loginTraceId,
  user: {
    userAccessToken: accessToken,
    supabaseAccessToken: accessToken,
    workspaceId,
    ...(expiresAt ? { supabaseAccessTokenExpiresAt: expiresAt } : {}),
    ...(refreshToken ? { bustlyRefreshToken: refreshToken } : {}),
    ...(legacySupabaseRefreshToken
      ? { legacySupabaseRefreshToken }
      : {}),
    ...(sessionId ? { bustlySessionId: sessionId } : {}),
  },
};

fs.mkdirSync(path.dirname(oauthPath), { recursive: true });
fs.writeFileSync(oauthPath, JSON.stringify(state, null, 2));
NODE
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
