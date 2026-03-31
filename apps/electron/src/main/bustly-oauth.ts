/**
 * Bustly OAuth state management
 * Manages login state using $OPENCLAW_STATE_DIR/bustlyOauth.json
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { hostname } from "node:os";
import { resolve } from "node:path";
import type { BustlyOAuthState, BustlySupabaseConfig } from "./bustly-types.js";
import { refreshSupabaseAuth, verifySupabaseAuth, type SupabaseUserResponse } from "./api/bustly.js";
import { resolveElectronIsolatedStateDir } from "./defaults.js";
import { writeMainError, writeMainInfo, writeMainWarn } from "./logger.js";

function resolveStateDir(): string {
  return resolveElectronIsolatedStateDir();
}

function resolveBustlyOauthFile(): string {
  return resolve(resolveStateDir(), "bustlyOauth.json");
}
const DEFAULT_CALLBACK_PORT = 17900;
const SESSION_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes for auth code
const SESSION_REFRESH_MARGIN_SECONDS = 60;
let refreshBustlyTokenPromise: Promise<boolean> | null = null;

/**
 * Ensure state directory exists
 */
function ensureConfigDir(): void {
  const dir = resolveStateDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

function getStoredSupabaseAccessToken(state: BustlyOAuthState | null): string {
  return state?.user?.userAccessToken?.trim() ?? "";
}

function getStoredSupabaseRefreshToken(state: BustlyOAuthState | null): string {
  return state?.user?.userRefreshToken?.trim() ?? "";
}

function getStoredSessionExpiresAt(state: BustlyOAuthState | null): number | null {
  const expiresAt = state?.user?.sessionExpiresAt;
  if (typeof expiresAt === "number" && Number.isFinite(expiresAt) && expiresAt > 0) {
    return expiresAt;
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

function extractSupabaseUserAvatarUrl(user: SupabaseUserResponse | null | undefined): string | undefined {
  const avatarUrl = user?.user_metadata?.avatar_url?.trim();
  const picture = user?.user_metadata?.picture?.trim();
  return avatarUrl || picture || undefined;
}

function extractSupabaseUserName(user: SupabaseUserResponse | null | undefined): string | undefined {
  const fullName = user?.user_metadata?.full_name?.trim();
  return fullName || undefined;
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

async function refreshBustlyAccessTokenInternal(): Promise<boolean> {
  const state = readBustlyOAuthState();
  const currentUser = state?.user;
  const refreshToken = getStoredSupabaseRefreshToken(state);
  if (!state || !currentUser) {
    writeMainWarn("[BustlyOAuth] Refresh skipped (no OAuth state/user)");
    return false;
  }
  if (!refreshToken) {
    writeMainWarn("[BustlyOAuth] Refresh skipped (no refresh token)");
    return false;
  }
  writeMainInfo(
    `[BustlyOAuth] Refreshing Supabase session user=${currentUser.userEmail} workspace=${currentUser.workspaceId}`,
  );

  const refreshResult = await refreshSupabaseAuth();
  if (!refreshResult.ok) {
    throw new Error(
      `Supabase refresh failed: ${refreshResult.status}${refreshResult.errorText ? ` ${refreshResult.errorText}` : ""}`,
    );
  }

  const refreshedAccessToken = refreshResult.data?.access_token?.trim() ?? "";
  if (!refreshedAccessToken) {
    throw new Error("Missing Supabase access token in refresh response");
  }
  const nextRefreshToken = refreshResult.data?.refresh_token?.trim() || refreshToken;
  const refreshedUserId = refreshResult.data?.user?.id?.trim() ?? currentUser.userId;
  const refreshedUserEmail = refreshResult.data?.user?.email?.trim() ?? currentUser.userEmail;
  const refreshedUserName = extractSupabaseUserName(refreshResult.data?.user) ?? currentUser.userName;
  const refreshedUserAvatarUrl =
    extractSupabaseUserAvatarUrl(refreshResult.data?.user) ?? currentUser.userAvatarUrl;
  state.user = {
    ...currentUser,
    userId: refreshedUserId,
    userName: refreshedUserName,
    userEmail: refreshedUserEmail,
    userAvatarUrl: refreshedUserAvatarUrl,
    userAccessToken: refreshedAccessToken,
    userRefreshToken: nextRefreshToken,
    sessionExpiresIn: refreshResult.data?.expires_in,
    sessionExpiresAt:
      typeof refreshResult.data?.expires_at === "number" ? refreshResult.data.expires_at : undefined,
    sessionTokenType: refreshResult.data?.token_type,
  };
  state.loggedInAt = Date.now();
  writeBustlyOAuthState(state);
  writeMainInfo(
    `[BustlyOAuth] Token refresh succeeded user=${state.user.userEmail} workspace=${state.user.workspaceId}`,
  );
  return true;
}

export async function refreshBustlyAccessToken(): Promise<boolean> {
  if (refreshBustlyTokenPromise) {
    return refreshBustlyTokenPromise;
  }

  refreshBustlyTokenPromise = refreshBustlyAccessTokenInternal()
    .catch((error) => {
      writeMainError("[BustlyOAuth] Token refresh failed:", error);
      return false;
    })
    .finally(() => {
      refreshBustlyTokenPromise = null;
    });

  return refreshBustlyTokenPromise;
}

/**
 * Generate device ID for OAuth
 */
function generateDeviceId(): string {
  const deviceHostname = hostname();
  // Generate a persistent device ID based on hostname
  const randomPart = Buffer.from(deviceHostname).toString("base64").slice(0, 16);
  return Buffer.from(`${deviceHostname}-${randomPart}`).toString("base64");
}

/**
 * Read Bustly OAuth state from file
 */
export function readBustlyOAuthState(): BustlyOAuthState | null {
  try {
    const oauthFile = resolveBustlyOauthFile();
    if (!existsSync(oauthFile)) {
      return null;
    }
    const content = readFileSync(oauthFile, "utf-8");
    return JSON.parse(content) as BustlyOAuthState;
  } catch (error) {
    writeMainError("[BustlyOAuth] Failed to read state:", error);
    return null;
  }
}

/**
 * Write Bustly OAuth state to file
 */
export function writeBustlyOAuthState(state: BustlyOAuthState): void {
  try {
    ensureConfigDir();
    const oauthFile = resolveBustlyOauthFile();
    writeFileSync(oauthFile, JSON.stringify(state, null, 2), "utf-8");
  } catch (error) {
    writeMainError("[BustlyOAuth] Failed to write state:", error);
    throw error;
  }
}

/**
 * Check if user is logged in
 * Login state is determined by user.userAccessToken.
 */
export async function isBustlyLoggedIn(): Promise<boolean> {
  const state = readBustlyOAuthState();
  const accessToken = getStoredSupabaseAccessToken(state);
  return Boolean(accessToken);
}

/**
 * Get current logged-in user info
 */
export async function getBustlyUserInfo(): Promise<BustlyOAuthState["user"] | null> {
  const state = readBustlyOAuthState();
  if (!(await isBustlyLoggedIn())) {
    return null;
  }
  const currentUser = state?.user ?? null;
  if (!currentUser) {
    return null;
  }
  if (currentUser.userAvatarUrl?.trim()) {
    return currentUser;
  }

  try {
    const verifyResult = await verifySupabaseAuth();
    if (!verifyResult.ok || !verifyResult.data || !state?.user) {
      return currentUser;
    }
    const nextUserName = extractSupabaseUserName(verifyResult.data) ?? currentUser.userName;
    const nextUserEmail = verifyResult.data.email?.trim() ?? currentUser.userEmail;
    const nextUserAvatarUrl = extractSupabaseUserAvatarUrl(verifyResult.data) ?? currentUser.userAvatarUrl;
    if (
      nextUserName === currentUser.userName &&
      nextUserEmail === currentUser.userEmail &&
      nextUserAvatarUrl === currentUser.userAvatarUrl
    ) {
      return currentUser;
    }
    state.user = {
      ...currentUser,
      userName: nextUserName,
      userEmail: nextUserEmail,
      userAvatarUrl: nextUserAvatarUrl,
    };
    writeBustlyOAuthState(state);
    return state.user;
  } catch {
    return currentUser;
  }
}

/**
 * Verify login state against API. Only call on explicit refresh.
 */
export async function verifyBustlyLoginStatus(): Promise<boolean> {
  const state = readBustlyOAuthState();
  const accessToken = getStoredSupabaseAccessToken(state);
  if (!accessToken) {
    return false;
  }

  const workspaceId = state?.user?.workspaceId?.trim() ?? "";

  if (!workspaceId) {
    writeMainWarn("[BustlyOAuth] Missing workspaceId; skipping verify check");
    return true;
  }

  try {
    if (shouldRefreshSession(state)) {
      const refreshed = await refreshBustlyAccessToken();
      if (!refreshed) {
        writeMainWarn("[BustlyOAuth] Pre-verify refresh failed; clearing user/token");
        clearBustlyAuthData();
        return false;
      }
    }

    let verifyResult = await verifySupabaseAuth();

    if (verifyResult.status === 400 || verifyResult.status === 401 || verifyResult.status === 403) {
      writeMainWarn(
        `[BustlyOAuth] Token expired/invalid (status=${verifyResult.status}); attempting refresh`,
      );
      const refreshed = await refreshBustlyAccessToken();
      if (!refreshed) {
        writeMainWarn("[BustlyOAuth] Refresh failed; clearing user/token");
        clearBustlyAuthData();
        return false;
      }

      verifyResult = await verifySupabaseAuth();
      if (verifyResult.status === 400 || verifyResult.status === 401 || verifyResult.status === 403) {
        writeMainWarn(
          `[BustlyOAuth] Refreshed token still invalid (status=${verifyResult.status}); clearing user/token`,
        );
        clearBustlyAuthData();
        return false;
      }
    }

    if (!verifyResult.ok) {
      writeMainWarn(
        `[BustlyOAuth] Verify failed (status=${verifyResult.status}); keeping cached login state`,
      );
      return true;
    }

    return true;
  } catch (error) {
    writeMainError("[BustlyOAuth] Verify error; keeping cached login state:", error);
    return true;
  }
}

/**
 * Initialize OAuth flow - create state with login trace ID
 */
export function initBustlyOAuthFlow(port?: number): BustlyOAuthState {
  // Clear any existing state first
  clearBustlyOAuthState();

  const loginTraceId = generateLoginTraceId();
  const callbackPort = port ?? DEFAULT_CALLBACK_PORT;
  const deviceId = generateDeviceId();

  const state: BustlyOAuthState = {
    loginTraceId,
    deviceId,
    callbackPort,
    expiresAt: Date.now() + SESSION_EXPIRY_MS,
  };

  writeBustlyOAuthState(state);
  return state;
}

/**
 * Generate a login trace ID for tracking the login flow
 * Returns a UUID v4 format string
 */
export function generateLoginTraceId(): string {
  return crypto.randomUUID();
}

/**
 * Update state with authorization code (callback received)
 */
export function setBustlyAuthCode(code: string): void {
  const state = readBustlyOAuthState();
  if (!state) {
    throw new Error("[BustlyOAuth] No active OAuth flow found");
  }

  state.authCode = code;
  state.expiresAt = Date.now() + SESSION_EXPIRY_MS;
  writeBustlyOAuthState(state);
}

/**
 * Get stored authorization code (for token exchange)
 */
export function getBustlyAuthCode(): string | null {
  const state = readBustlyOAuthState();
  if (!state || !state.authCode) {
    return null;
  }
  const expiresAt = typeof state.expiresAt === "number" ? state.expiresAt : 0;
  if (!expiresAt) {
    clearBustlyOAuthState();
    return null;
  }
  // Check expiry
  if (Date.now() > expiresAt) {
    clearBustlyOAuthState();
    return null;
  }
  return state.authCode;
}

/**
 * Get and clear the stored authorization code so a single login attempt
 * cannot exchange the same code more than once.
 */
export function consumeBustlyAuthCode(): string | null {
  const state = readBustlyOAuthState();
  if (!state || !state.authCode) {
    return null;
  }
  const expiresAt = typeof state.expiresAt === "number" ? state.expiresAt : 0;
  if (!expiresAt || Date.now() > expiresAt) {
    clearBustlyOAuthState();
    return null;
  }

  const code = state.authCode;
  delete state.authCode;
  writeBustlyOAuthState(state);
  return code;
}

/**
 * Complete login - store user info and canonical supabase config.
 * All configuration is stored in bustlyOauth.json.
 */
export function completeBustlyLogin(params: {
  user: {
    userId: string;
    userName: string;
    userEmail: string;
    userAvatarUrl?: string;
    userAccessToken?: string;
    userRefreshToken?: string;
    sessionExpiresIn?: number;
    sessionExpiresAt?: number;
    sessionTokenType?: string;
    workspaceId: string;
    skills: string[];
  };
  supabase?: BustlySupabaseConfig;
}): void {
  const state = readBustlyOAuthState();
  if (!state) {
    throw new Error("[BustlyOAuth] No active OAuth flow found");
  }
  const previousAccessToken = getStoredSupabaseAccessToken(state);
  const previousWorkspaceId = state.user?.workspaceId?.trim() ?? "";

  // Update state with user info and supabase config.
  state.user = params.user;
  state.supabase = params.supabase;
  state.loggedInAt = Date.now();

  // Clear transient fields
  delete state.authCode;
  delete state.expiresAt;

  writeBustlyOAuthState(state);
  const nextAccessToken = getStoredSupabaseAccessToken(state);
  const tokenChanged = previousAccessToken !== nextAccessToken;
  writeMainInfo(
    `[BustlyOAuth] Login completed user=${params.user.userEmail} workspace=${params.user.workspaceId} previousWorkspace=${previousWorkspaceId || "(none)"} tokenChanged=${tokenChanged}`,
  );
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
  writeMainInfo(`[BustlyOAuth] Active workspace updated: ${nextWorkspaceId}`);
}

/**
 * Logout / clear OAuth state
 */
export function logoutBustly(): void {
  clearBustlyAuthData();
  writeMainInfo("[BustlyOAuth] Logged out");
}

/**
 * Clear OAuth state file
 */
export function clearBustlyOAuthState(): void {
  try {
    const oauthFile = resolveBustlyOauthFile();
    if (existsSync(oauthFile)) {
      unlinkSync(oauthFile);
      writeMainInfo("[BustlyOAuth] State cleared");
    }
  } catch (error) {
    writeMainError("[BustlyOAuth] Failed to clear state:", error);
  }
}

/**
 * Clear user + token info from OAuth state (preserves other fields).
 */
export function clearBustlyAuthData(): void {
  const state = readBustlyOAuthState();
  if (!state) {
    return;
  }

  delete state.user;
  delete state.loggedInAt;

  writeBustlyOAuthState(state);
  writeMainInfo("[BustlyOAuth] Cleared token and user data");
}

/**
 * Get callback port from state or default
 */
export function getBustlyCallbackPort(): number {
  const state = readBustlyOAuthState();
  return state?.callbackPort ?? DEFAULT_CALLBACK_PORT;
}
