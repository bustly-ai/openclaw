#!/usr/bin/env bash
set -euo pipefail

STATE_DIR="${OPENCLAW_STATE_DIR:-/home/node/.bustly}"
OAUTH_PATH="${BUSTLY_OAUTH_PATH:-${STATE_DIR}/bustlyOauth.json}"
CONFIG_PATH="${OPENCLAW_CONFIG_PATH:-${STATE_DIR}/openclaw.json}"
WORKSPACE_ID="${BUSTLY_RUNTIME_ACTIVE_WORKSPACE_ID:-${BUSTLY_WORKSPACE_ID:-}}"
OAUTH_STATE_B64="${BUSTLY_OAUTH_STATE_B64:-}"
USER_ACCESS_TOKEN="${BUSTLY_USER_ACCESS_TOKEN:-}"
SUPABASE_ACCESS_TOKEN="${BUSTLY_SUPABASE_ACCESS_TOKEN:-}"
REFRESH_TOKEN="${BUSTLY_REFRESH_TOKEN:-}"
LEGACY_SUPABASE_REFRESH_TOKEN="${BUSTLY_LEGACY_SUPABASE_REFRESH_TOKEN:-}"
SUPABASE_ACCESS_TOKEN_EXPIRES_AT="${BUSTLY_SUPABASE_ACCESS_TOKEN_EXPIRES_AT:-}"
SESSION_ID="${BUSTLY_SESSION_ID:-}"
LOGIN_TRACE_ID="${BUSTLY_LOGIN_TRACE_ID:-}"
USER_ID="${BUSTLY_RUNTIME_USER_ID:-${BUSTLY_USER_ID:-}}"
USER_NAME="${BUSTLY_USER_NAME:-}"
USER_EMAIL="${BUSTLY_USER_EMAIL:-}"
SUPABASE_URL="${BUSTLY_SUPABASE_URL:-}"
SUPABASE_ANON_KEY="${BUSTLY_SUPABASE_ANON_KEY:-}"
CONTROL_UI_ALLOWED_ORIGINS="${BUSTLY_CONTROL_UI_ALLOWED_ORIGINS:-}"
CONTROL_UI_DISABLE_DEVICE_AUTH="${BUSTLY_CONTROL_UI_DISABLE_DEVICE_AUTH:-0}"

if [[ -n "$OAUTH_STATE_B64" ]]; then
  mkdir -p "$(dirname "$OAUTH_PATH")"
  umask 077
  OAUTH_PATH="$OAUTH_PATH" \
  BUSTLY_WORKSPACE_ID="$WORKSPACE_ID" \
  BUSTLY_OAUTH_STATE_B64="$OAUTH_STATE_B64" \
  BUSTLY_LOGIN_TRACE_ID="$LOGIN_TRACE_ID" \
  BUSTLY_USER_ACCESS_TOKEN="$USER_ACCESS_TOKEN" \
  BUSTLY_SUPABASE_ACCESS_TOKEN="$SUPABASE_ACCESS_TOKEN" \
  BUSTLY_REFRESH_TOKEN="$REFRESH_TOKEN" \
  BUSTLY_LEGACY_SUPABASE_REFRESH_TOKEN="$LEGACY_SUPABASE_REFRESH_TOKEN" \
  BUSTLY_SUPABASE_ACCESS_TOKEN_EXPIRES_AT="$SUPABASE_ACCESS_TOKEN_EXPIRES_AT" \
  BUSTLY_SESSION_ID="$SESSION_ID" \
  BUSTLY_USER_ID="$USER_ID" \
  BUSTLY_USER_NAME="$USER_NAME" \
  BUSTLY_USER_EMAIL="$USER_EMAIL" \
  BUSTLY_SUPABASE_URL="$SUPABASE_URL" \
  BUSTLY_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const oauthPath = process.env.OAUTH_PATH;
const workspaceId = (process.env.BUSTLY_WORKSPACE_ID || "").trim();
const encodedState = process.env.BUSTLY_OAUTH_STATE_B64 || "";
const loginTraceId = (process.env.BUSTLY_LOGIN_TRACE_ID || "").trim();
const accessToken = (process.env.BUSTLY_USER_ACCESS_TOKEN || "").trim();
const supabaseAccessToken =
  (process.env.BUSTLY_SUPABASE_ACCESS_TOKEN || "").trim() || accessToken;
const refreshToken = (process.env.BUSTLY_REFRESH_TOKEN || "").trim();
const legacySupabaseRefreshToken = (
  process.env.BUSTLY_LEGACY_SUPABASE_REFRESH_TOKEN || ""
).trim();
const sessionId = (process.env.BUSTLY_SESSION_ID || "").trim();
const userId = (process.env.BUSTLY_USER_ID || "").trim();
const userName = (process.env.BUSTLY_USER_NAME || "").trim();
const userEmail = (process.env.BUSTLY_USER_EMAIL || "").trim();
const supabaseUrl = (process.env.BUSTLY_SUPABASE_URL || "").trim();
const supabaseAnonKey = (process.env.BUSTLY_SUPABASE_ANON_KEY || "").trim();
const expiresAtRaw = (process.env.BUSTLY_SUPABASE_ACCESS_TOKEN_EXPIRES_AT || "").trim();
const raw = Buffer.from(encodedState, "base64").toString("utf8");
const state = JSON.parse(raw || "{}");

let expiresAt;
if (expiresAtRaw) {
  const parsed = Number(expiresAtRaw);
  if (Number.isFinite(parsed) && parsed > 0) {
    expiresAt = parsed;
  }
}

state.user = state.user || {};
if (loginTraceId) {
  state.loginTraceId = loginTraceId;
}
if (workspaceId) {
  state.user.workspaceId = workspaceId;
}
if (userId) {
  state.user.userId = userId;
}
if (userName) {
  state.user.userName = userName;
}
if (userEmail) {
  state.user.userEmail = userEmail;
}
if (supabaseAccessToken) {
  state.user.userAccessToken = supabaseAccessToken;
  state.user.supabaseAccessToken = supabaseAccessToken;
} else if (accessToken) {
  state.user.userAccessToken = accessToken;
}
if (typeof expiresAt === "number") {
  state.user.supabaseAccessTokenExpiresAt = expiresAt;
}
if (refreshToken) {
  state.user.bustlyRefreshToken = refreshToken;
}
if (legacySupabaseRefreshToken) {
  state.user.legacySupabaseRefreshToken = legacySupabaseRefreshToken;
}
if (sessionId) {
  state.user.bustlySessionId = sessionId;
}
if (supabaseUrl || supabaseAnonKey) {
  state.supabase = state.supabase && typeof state.supabase === "object" ? state.supabase : {};
  if (supabaseUrl) {
    state.supabase.url = supabaseUrl;
  }
  if (supabaseAnonKey) {
    state.supabase.anonKey = supabaseAnonKey;
  }
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
  BUSTLY_SUPABASE_ACCESS_TOKEN="$SUPABASE_ACCESS_TOKEN" \
  BUSTLY_REFRESH_TOKEN="$REFRESH_TOKEN" \
  BUSTLY_LEGACY_SUPABASE_REFRESH_TOKEN="$LEGACY_SUPABASE_REFRESH_TOKEN" \
  BUSTLY_SUPABASE_ACCESS_TOKEN_EXPIRES_AT="$SUPABASE_ACCESS_TOKEN_EXPIRES_AT" \
  BUSTLY_SESSION_ID="$SESSION_ID" \
  BUSTLY_USER_ID="$USER_ID" \
  BUSTLY_USER_NAME="$USER_NAME" \
  BUSTLY_USER_EMAIL="$USER_EMAIL" \
  BUSTLY_SUPABASE_URL="$SUPABASE_URL" \
  BUSTLY_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const oauthPath = process.env.OAUTH_PATH;
const loginTraceId = (process.env.BUSTLY_LOGIN_TRACE_ID || "").trim();
const workspaceId = (process.env.BUSTLY_WORKSPACE_ID || "").trim();
const accessToken = (process.env.BUSTLY_USER_ACCESS_TOKEN || "").trim();
const supabaseAccessToken =
  (process.env.BUSTLY_SUPABASE_ACCESS_TOKEN || "").trim() || accessToken;
const refreshToken = (process.env.BUSTLY_REFRESH_TOKEN || "").trim();
const legacySupabaseRefreshToken = (
  process.env.BUSTLY_LEGACY_SUPABASE_REFRESH_TOKEN || ""
).trim();
const sessionId = (process.env.BUSTLY_SESSION_ID || "").trim();
const userId = (process.env.BUSTLY_USER_ID || "").trim();
const userName = (process.env.BUSTLY_USER_NAME || "").trim();
const userEmail = (process.env.BUSTLY_USER_EMAIL || "").trim();
const supabaseUrl = (process.env.BUSTLY_SUPABASE_URL || "").trim();
const supabaseAnonKey = (process.env.BUSTLY_SUPABASE_ANON_KEY || "").trim();
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
    ...(supabaseUrl || supabaseAnonKey
    ? {
        supabase: {
          ...(supabaseUrl ? { url: supabaseUrl } : {}),
          ...(supabaseAnonKey ? { anonKey: supabaseAnonKey } : {}),
        },
      }
    : {}),
    user: {
      ...(userId ? { userId } : {}),
      ...(userName ? { userName } : {}),
      ...(userEmail ? { userEmail } : {}),
      userAccessToken: supabaseAccessToken,
      supabaseAccessToken,
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
  OPENCLAW_CONFIG_PATH="$CONFIG_PATH" \
  BUSTLY_ACCOUNT_WEB_BASE_URL="${BUSTLY_ACCOUNT_WEB_BASE_URL:-}" \
  BUSTLY_WEB_BASE_URL="${BUSTLY_WEB_BASE_URL:-}" \
  BUSTLY_CONTROL_UI_ALLOWED_ORIGINS="${CONTROL_UI_ALLOWED_ORIGINS:-}" \
  BUSTLY_CONTROL_UI_DISABLE_DEVICE_AUTH="${CONTROL_UI_DISABLE_DEVICE_AUTH:-0}" \
  node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const configPath = process.env.OPENCLAW_CONFIG_PATH;
const explicitAllowedOrigins = (process.env.BUSTLY_CONTROL_UI_ALLOWED_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const disableDeviceAuth = process.env.BUSTLY_CONTROL_UI_DISABLE_DEVICE_AUTH === "1";
const webBaseUrl = (process.env.BUSTLY_WEB_BASE_URL || process.env.BUSTLY_ACCOUNT_WEB_BASE_URL || "").trim();

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
if (disableDeviceAuth) {
  config.gateway.controlUi.dangerouslyDisableDeviceAuth = true;
}

const allowedOrigins = [];

for (const origin of explicitAllowedOrigins) {
  try {
    allowedOrigins.push(new URL(origin).origin);
  } catch {
    // Ignore invalid explicit origin.
  }
}

if (webBaseUrl) {
  try {
    allowedOrigins.push(new URL(webBaseUrl).origin);
  } catch {
    // Ignore invalid web url and keep fallback mode enabled.
  }
}

if (allowedOrigins.length > 0) {
  const existing = Array.isArray(config.gateway.controlUi.allowedOrigins)
    ? config.gateway.controlUi.allowedOrigins.filter((value) => typeof value === "string")
    : [];
  config.gateway.controlUi.allowedOrigins = Array.from(new Set([...existing, ...allowedOrigins]));
}

fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
NODE
fi

exec "$@"
