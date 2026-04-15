/**
 * Bustly OAuth state management (shared between gateway and Electron main process)
 * Manages login state using ~/.bustly/bustlyOauth.json
 */

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import * as os from "node:os";
import { resolve } from "node:path";
import { resolveBustlyAccountApiBaseUrl } from "./bustly/env.js";
import type {
  BustlyOAuthState,
  BustlySearchDataConfig,
  BustlySupabaseConfig,
} from "./config/types.base.js";

const BUSTLY_OAUTH_FILE = resolve(os.homedir(), ".bustly", "bustlyOauth.json");
const SESSION_REFRESH_MARGIN_SECONDS = 60;
const SESSION_REFRESH_FALLBACK_SECONDS = 5 * 60;
let refreshBustlyTokenPromise: Promise<boolean> | null = null;

export type { BustlyOAuthState, BustlySearchDataConfig, BustlySupabaseConfig };

export type BustlyRefreshResponse = {
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  expiresAt?: number;
  bustlySessionId?: string;
  supabaseAccessToken?: string;
  supabaseAccessTokenExpiresAt?: number;
  capabilities?: string[];
  extras?: Record<string, unknown>;
};

type ApiResponseEnvelope<T> = {
  code?: string;
  message?: string;
  status?: string;
  data?: T;
  extra?: Record<string, unknown>;
};

export type BustlyRefreshResult = {
  ok: boolean;
  status: number;
  data?: BustlyRefreshResponse;
  errorText?: string;
};

export type SupabaseRefreshResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  expires_at?: number;
};

export type SupabaseRefreshResult = {
  ok: boolean;
  status: number;
  data?: SupabaseRefreshResponse;
  errorText?: string;
};

function trimToUndefined(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toPositiveFiniteNumber(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function getStoredSupabaseAccessToken(state: BustlyOAuthState | null): string {
  return state?.user?.supabaseAccessToken?.trim() ?? state?.user?.userAccessToken?.trim() ?? "";
}

function getStoredBustlyRefreshToken(state: BustlyOAuthState | null): string {
  return state?.user?.bustlyRefreshToken?.trim() ?? "";
}

function getStoredLegacySupabaseRefreshToken(state: BustlyOAuthState | null): string {
  return (
    state?.user?.legacySupabaseRefreshToken?.trim() ?? state?.user?.userRefreshToken?.trim() ?? ""
  );
}

function getStoredSessionExpiresAt(state: BustlyOAuthState | null): number | null {
  const expiresAt = state?.user?.supabaseAccessTokenExpiresAt;
  if (typeof expiresAt === "number" && Number.isFinite(expiresAt) && expiresAt > 0) {
    return expiresAt;
  }
  const legacyExpiresAt = state?.user?.sessionExpiresAt;
  if (
    typeof legacyExpiresAt === "number" &&
    Number.isFinite(legacyExpiresAt) &&
    legacyExpiresAt > 0
  ) {
    return legacyExpiresAt;
  }
  const expiresIn = state?.user?.sessionExpiresIn;
  const loggedInAt = state?.loggedInAt;
  if (
    typeof expiresIn === "number" &&
    Number.isFinite(expiresIn) &&
    expiresIn > 0 &&
    typeof loggedInAt === "number" &&
    Number.isFinite(loggedInAt) &&
    loggedInAt > 0
  ) {
    return Math.floor(loggedInAt / 1000) + expiresIn;
  }
  return null;
}

function shouldRefreshSession(state: BustlyOAuthState | null, nowMs = Date.now()): boolean {
  const expiresAt = getStoredSessionExpiresAt(state);
  if (!expiresAt) {
    return false;
  }
  const refreshAtSeconds = Math.max(0, expiresAt - SESSION_REFRESH_MARGIN_SECONDS);
  const nowSeconds = Math.floor(nowMs / 1000);
  return nowSeconds >= refreshAtSeconds;
}

function getFallbackSupabaseAccessTokenExpiresAt(
  currentExpiresAt: number | null | undefined,
): number {
  const current = toPositiveFiniteNumber(currentExpiresAt) ?? 0;
  const minimumFuture = Math.floor(Date.now() / 1000) + SESSION_REFRESH_FALLBACK_SECONDS;
  return Math.max(current, minimumFuture);
}

function normalizeBustlyOAuthState(
  state: BustlyOAuthState | null | undefined,
): BustlyOAuthState | null {
  if (!state?.user) {
    return state ?? null;
  }
  const currentUser = state.user;
  const nextSupabaseAccessToken =
    trimToUndefined(currentUser.supabaseAccessToken) ??
    trimToUndefined(currentUser.userAccessToken);
  const nextSupabaseAccessTokenExpiresAt =
    toPositiveFiniteNumber(currentUser.supabaseAccessTokenExpiresAt) ??
    toPositiveFiniteNumber(currentUser.sessionExpiresAt);
  const nextBustlySessionId = trimToUndefined(currentUser.bustlySessionId);
  const nextBustlyRefreshToken = trimToUndefined(currentUser.bustlyRefreshToken);
  const nextLegacySupabaseRefreshToken =
    trimToUndefined(currentUser.legacySupabaseRefreshToken) ??
    trimToUndefined(currentUser.userRefreshToken);
  const nextUserAccessToken = nextSupabaseAccessToken;

  if (
    nextSupabaseAccessToken === currentUser.supabaseAccessToken &&
    nextSupabaseAccessTokenExpiresAt === currentUser.supabaseAccessTokenExpiresAt &&
    nextBustlySessionId === currentUser.bustlySessionId &&
    nextBustlyRefreshToken === currentUser.bustlyRefreshToken &&
    nextLegacySupabaseRefreshToken === currentUser.legacySupabaseRefreshToken &&
    nextUserAccessToken === currentUser.userAccessToken
  ) {
    return state;
  }

  return {
    ...state,
    user: {
      ...currentUser,
      userAccessToken: nextUserAccessToken,
      bustlySessionId: nextBustlySessionId,
      supabaseAccessToken: nextSupabaseAccessToken,
      supabaseAccessTokenExpiresAt: nextSupabaseAccessTokenExpiresAt,
      bustlyRefreshToken: nextBustlyRefreshToken,
      legacySupabaseRefreshToken: nextLegacySupabaseRefreshToken,
    },
  };
}

/**
 * Ensure ~/.bustly directory exists
 */
function ensureConfigDir(): void {
  const dir = resolve(os.homedir(), ".bustly");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

function migrateLegacyOAuthState(state: BustlyOAuthState): BustlyOAuthState {
  const nextState: BustlyOAuthState = {
    ...state,
    user: state.user ? { ...state.user } : undefined,
    supabase: state.supabase ? { ...state.supabase } : undefined,
  };
  const legacySearchData = state.bustlySearchData;
  const legacyAccessToken = legacySearchData?.SEARCH_DATA_SUPABASE_ACCESS_TOKEN?.trim() ?? "";
  const legacyWorkspaceId = legacySearchData?.SEARCH_DATA_WORKSPACE_ID?.trim() ?? "";
  const legacySupabaseUrl = legacySearchData?.SEARCH_DATA_SUPABASE_URL?.trim() ?? "";
  const legacySupabaseAnonKey = legacySearchData?.SEARCH_DATA_SUPABASE_ANON_KEY?.trim() ?? "";
  const currentAccessToken = nextState.user?.userAccessToken?.trim() ?? "";
  const currentWorkspaceId = nextState.user?.workspaceId?.trim() ?? "";
  if (nextState.user && !currentAccessToken && legacyAccessToken) {
    nextState.user.userAccessToken = legacyAccessToken;
  }
  if (nextState.user && !currentWorkspaceId && legacyWorkspaceId) {
    nextState.user.workspaceId = legacyWorkspaceId;
  }
  if (!nextState.supabase && (legacySupabaseUrl || legacySupabaseAnonKey)) {
    nextState.supabase = {
      url: legacySupabaseUrl,
      anonKey: legacySupabaseAnonKey,
    };
  } else if (nextState.supabase) {
    if (!nextState.supabase.url && legacySupabaseUrl) {
      nextState.supabase.url = legacySupabaseUrl;
    }
    if (!nextState.supabase.anonKey && legacySupabaseAnonKey) {
      nextState.supabase.anonKey = legacySupabaseAnonKey;
    }
  }
  delete nextState.bustlySearchData;
  return normalizeBustlyOAuthState(nextState) ?? nextState;
}

/**
 * Generate a random device ID
 */
function generateDeviceId(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Get default callback port
 */
function getDefaultCallbackPort(): number {
  const port = process.env.BUSTLY_OAUTH_CALLBACK_PORT
    ? parseInt(process.env.BUSTLY_OAUTH_CALLBACK_PORT, 10)
    : 18790;
  return port;
}

/**
 * Initialize OAuth flow with device ID
 */
export function initBustlyOAuthFlow(): void {
  ensureConfigDir();

  const existingState = readBustlyOAuthState();
  const deviceId = existingState?.deviceId ?? generateDeviceId();
  const callbackPort = existingState?.callbackPort ?? getDefaultCallbackPort();

  const newState: BustlyOAuthState = {
    ...(existingState ?? { callbackPort }),
    deviceId,
    callbackPort,
  };

  writeBustlyOAuthState(newState);
  console.log("[BustlyOAuth] Initialized OAuth flow with device ID:", deviceId);
}

/**
 * Update OAuth state with new data
 */
export function updateBustlyOAuthState(updates: Partial<BustlyOAuthState>): void {
  const currentState = readBustlyOAuthState();
  if (!currentState) {
    console.warn("[BustlyOAuth] Cannot update state: no existing state");
    return;
  }

  const newState: BustlyOAuthState = {
    ...currentState,
    ...updates,
  };

  writeBustlyOAuthState(newState);
}

/**
 * Set authorization code after callback
 */
export function setBustlyAuthCode(code: string): void {
  updateBustlyOAuthState({ authCode: code });
  console.log("[BustlyOAuth] Authorization code set");
}

/**
 * Write OAuth state to file
 */
function writeBustlyOAuthState(state: BustlyOAuthState): void {
  try {
    ensureConfigDir();
    writeFileSync(BUSTLY_OAUTH_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (error) {
    console.error("[BustlyOAuth] Failed to write state:", error);
  }
}

/**
 * Read Bustly OAuth state from file
 */
export function readBustlyOAuthState(): BustlyOAuthState | null {
  try {
    if (!existsSync(BUSTLY_OAUTH_FILE)) {
      return null;
    }
    const content = readFileSync(BUSTLY_OAUTH_FILE, "utf-8");
    const parsed = JSON.parse(content) as BustlyOAuthState;
    const migrated = migrateLegacyOAuthState(parsed);
    if (JSON.stringify(migrated) !== JSON.stringify(parsed)) {
      writeFileSync(BUSTLY_OAUTH_FILE, JSON.stringify(migrated, null, 2), "utf-8");
      console.log("[BustlyOAuth] Migrated legacy bustlySearchData into user/supabase profile");
    }
    return migrated;
  } catch (error) {
    console.error("[BustlyOAuth] Failed to read state:", error);
    return null;
  }
}

/**
 * Check if user is logged in
 */
export function isBustlyLoggedIn(): boolean {
  const state = readBustlyOAuthState();
  // Single source of truth for gateway JWT.
  return Boolean(getStoredSupabaseAccessToken(state));
}

/**
 * Get current logged-in user info
 */
export function getBustlyUserInfo(): BustlyOAuthState["user"] | null {
  const state = readBustlyOAuthState();
  if (!isBustlyLoggedIn()) {
    return null;
  }
  return state?.user ?? null;
}

/**
 * Logout / clear OAuth state
 */
export function logoutBustly(): void {
  clearBustlyAuthData();
  console.log("[BustlyOAuth] Logged out");
}

/**
 * Complete login - store user info and canonical supabase config.
 * This is the final step after successful token exchange.
 */
export function completeBustlyLogin(params: {
  user: BustlyOAuthState["user"];
  supabase?: BustlySupabaseConfig;
}): void {
  const currentState = readBustlyOAuthState();
  if (!currentState) {
    // Create new state if none exists
    const callbackPort = getDefaultCallbackPort();
    const newState: BustlyOAuthState = {
      deviceId: generateDeviceId(),
      callbackPort,
      user: params.user,
      loggedInAt: Date.now(),
      supabase: params.supabase,
    };
    writeBustlyOAuthState(normalizeBustlyOAuthState(newState) ?? newState);
    console.log("[BustlyOAuth] Login completed for user:", params.user?.userEmail);
    return;
  }

  // Update existing state
  const newState: BustlyOAuthState = {
    ...currentState,
    user: params.user,
    loggedInAt: Date.now(),
    supabase: params.supabase,
    // Clear transient fields
    authCode: undefined,
    expiresAt: undefined,
  };
  delete newState.bustlySearchData;
  writeBustlyOAuthState(normalizeBustlyOAuthState(newState) ?? newState);
  console.log("[BustlyOAuth] Login completed for user:", params.user?.userEmail);
}

export function getBustlyAccessToken(
  state: BustlyOAuthState | null | undefined = readBustlyOAuthState(),
): string {
  return getStoredSupabaseAccessToken(state ?? null);
}

export async function refreshBustlySession(): Promise<BustlyRefreshResult> {
  const apiBaseUrl = resolveBustlyAccountApiBaseUrl();
  const bustlyRefreshToken = getStoredBustlyRefreshToken(readBustlyOAuthState());
  if (!bustlyRefreshToken) {
    throw new Error("Missing Bustly refresh token");
  }

  const endpoint = `${apiBaseUrl}/api/oauth/api/v1/oauth/refresh`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: new URLSearchParams({
      refresh_token: bustlyRefreshToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { ok: false, status: response.status, errorText };
  }

  const envelope = (await response.json()) as ApiResponseEnvelope<BustlyRefreshResponse>;
  if (envelope.status && envelope.status !== "0") {
    return {
      ok: false,
      status: response.status,
      errorText: envelope.message ?? "Bustly refresh failed",
    };
  }

  return { ok: true, status: response.status, data: envelope.data };
}

export async function refreshSupabaseAuth(): Promise<SupabaseRefreshResult> {
  const state = readBustlyOAuthState();
  const supabaseUrl = state?.supabase?.url?.trim() ?? "";
  const supabaseAnonKey = state?.supabase?.anonKey?.trim() ?? "";
  const legacySupabaseRefreshToken = getStoredLegacySupabaseRefreshToken(state);
  if (!legacySupabaseRefreshToken) {
    throw new Error("Missing Supabase refresh token");
  }
  if (!supabaseUrl) {
    throw new Error("Missing Supabase URL");
  }
  if (!supabaseAnonKey) {
    throw new Error("Missing Supabase anon key");
  }

  const endpoint = `${supabaseUrl.replace(/\/+$/, "")}/auth/v1/token?grant_type=refresh_token`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({
      refresh_token: legacySupabaseRefreshToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { ok: false, status: response.status, errorText };
  }

  const data = (await response.json()) as SupabaseRefreshResponse;
  return { ok: true, status: response.status, data };
}

async function refreshBustlyAccessTokenInternal(): Promise<boolean> {
  const state = readBustlyOAuthState();
  const currentUser = state?.user;
  const bustlyRefreshToken = getStoredBustlyRefreshToken(state);
  const legacySupabaseRefreshToken = getStoredLegacySupabaseRefreshToken(state);
  if (!state || !currentUser) {
    return false;
  }
  if (!bustlyRefreshToken && !legacySupabaseRefreshToken) {
    return false;
  }

  if (bustlyRefreshToken) {
    const refreshResult = await refreshBustlySession();
    if (!refreshResult.ok) {
      throw new Error(
        `Bustly refresh failed: ${refreshResult.status}${refreshResult.errorText ? ` ${refreshResult.errorText}` : ""}`,
      );
    }
    const refreshedAccessToken =
      trimToUndefined(refreshResult.data?.supabaseAccessToken) ??
      trimToUndefined(refreshResult.data?.accessToken) ??
      trimToUndefined(
        (refreshResult.data?.extras?.supabase_session as { access_token?: string } | undefined)
          ?.access_token,
      ) ??
      "";
    if (!refreshedAccessToken) {
      throw new Error("Missing Supabase access token in Bustly refresh response");
    }
    const nextRefreshToken =
      trimToUndefined(refreshResult.data?.refreshToken) ?? bustlyRefreshToken;
    state.user = {
      ...currentUser,
      userAccessToken: refreshedAccessToken,
      supabaseAccessToken: refreshedAccessToken,
      supabaseAccessTokenExpiresAt:
        toPositiveFiniteNumber(refreshResult.data?.supabaseAccessTokenExpiresAt) ??
        toPositiveFiniteNumber(refreshResult.data?.expiresAt) ??
        (typeof refreshResult.data?.expiresIn === "number" &&
        Number.isFinite(refreshResult.data.expiresIn) &&
        refreshResult.data.expiresIn > 0
          ? Math.floor(Date.now() / 1000) + refreshResult.data.expiresIn
          : undefined) ??
        getFallbackSupabaseAccessTokenExpiresAt(currentUser.supabaseAccessTokenExpiresAt),
      bustlyRefreshToken: nextRefreshToken,
      bustlySessionId:
        trimToUndefined(refreshResult.data?.bustlySessionId) ?? currentUser.bustlySessionId,
      capabilities: refreshResult.data?.capabilities ?? currentUser.capabilities,
    };
  } else {
    const refreshResult = await refreshSupabaseAuth();
    if (!refreshResult.ok) {
      throw new Error(
        `Supabase refresh failed: ${refreshResult.status}${refreshResult.errorText ? ` ${refreshResult.errorText}` : ""}`,
      );
    }
    const refreshedAccessToken = trimToUndefined(refreshResult.data?.access_token) ?? "";
    if (!refreshedAccessToken) {
      throw new Error("Missing Supabase access token in legacy refresh response");
    }
    state.user = {
      ...currentUser,
      userAccessToken: refreshedAccessToken,
      supabaseAccessToken: refreshedAccessToken,
      supabaseAccessTokenExpiresAt:
        toPositiveFiniteNumber(refreshResult.data?.expires_at) ??
        (typeof refreshResult.data?.expires_in === "number" &&
        Number.isFinite(refreshResult.data.expires_in) &&
        refreshResult.data.expires_in > 0
          ? Math.floor(Date.now() / 1000) + refreshResult.data.expires_in
          : undefined) ??
        getFallbackSupabaseAccessTokenExpiresAt(currentUser.supabaseAccessTokenExpiresAt),
      legacySupabaseRefreshToken:
        trimToUndefined(refreshResult.data?.refresh_token) ?? legacySupabaseRefreshToken,
    };
  }
  state.loggedInAt = Date.now();
  writeBustlyOAuthState(state);
  return true;
}

export async function refreshBustlyAccessToken(): Promise<boolean> {
  if (refreshBustlyTokenPromise) {
    return refreshBustlyTokenPromise;
  }

  refreshBustlyTokenPromise = refreshBustlyAccessTokenInternal()
    .catch((error) => {
      console.error("[BustlyOAuth] Token refresh failed:", error);
      return false;
    })
    .finally(() => {
      refreshBustlyTokenPromise = null;
    });

  return refreshBustlyTokenPromise;
}

export async function readBustlyOAuthStateEnsuringFreshToken(options?: {
  forceRefresh?: boolean;
}): Promise<BustlyOAuthState | null> {
  let state = readBustlyOAuthState();
  if (!state?.user) {
    return state;
  }
  const shouldRefresh = options?.forceRefresh || shouldRefreshSession(state);
  if (shouldRefresh) {
    const refreshed = await refreshBustlyAccessToken();
    if (refreshed) {
      state = readBustlyOAuthState();
    }
  }
  return state;
}

export function setActiveWorkspaceId(workspaceId: string): void {
  const nextWorkspaceId = workspaceId.trim();
  if (!nextWorkspaceId) {
    throw new Error("[BustlyOAuth] Missing workspaceId");
  }
  const state = readBustlyOAuthState();
  if (!state) {
    throw new Error("[BustlyOAuth] No OAuth state found");
  }
  if (state.user) {
    state.user.workspaceId = nextWorkspaceId;
  }
  writeBustlyOAuthState(state);
}

/**
 * Clear user + token info from OAuth state (preserves other fields).
 */
function clearBustlyAuthData(): void {
  const state = readBustlyOAuthState();
  if (!state) {
    return;
  }

  delete state.user;
  delete state.loggedInAt;

  writeBustlyOAuthState(state);
  console.log("[BustlyOAuth] Cleared token and user data");
}
