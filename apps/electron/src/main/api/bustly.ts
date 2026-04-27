import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeBustlyOAuthState, type BustlyOAuthState } from "../bustly-types.js";
import { resolveElectronIsolatedStateDir } from "../defaults.js";
import { mainHttpFetch } from "../http-client.js";
import { resolveBustlyAccountApiBaseUrl } from "../../../../../src/bustly/env.js";

export type SupabaseUserMetadata = {
  avatar_url?: string;
  picture?: string;
  full_name?: string;
  name?: string;
  display_name?: string;
  preferred_username?: string;
  username?: string;
  user_name?: string;
};

export type SupabaseUserResponse = {
  id?: string;
  email?: string;
  role?: string;
  user_metadata?: SupabaseUserMetadata;
};

export type SupabaseVerifyResult = {
  ok: boolean;
  status: number;
  data?: SupabaseUserResponse;
};

export type SupabaseRefreshResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  expires_at?: number;
  user?: SupabaseUserResponse;
};

export type SupabaseRefreshResult = {
  ok: boolean;
  status: number;
  data?: SupabaseRefreshResponse;
  errorText?: string;
};

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

export type ApiResponseEnvelope<T> = {
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

export type SupabaseFetchParams = {
  path: string;
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: BodyInit;
};

function resolveStateDir(): string {
  return resolveElectronIsolatedStateDir();
}

function resolveBustlyOauthFile(): string {
  return resolve(resolveStateDir(), "bustlyOauth.json");
}

function readBustlyOAuthState(): BustlyOAuthState | null {
  try {
    const oauthFile = resolveBustlyOauthFile();
    if (!existsSync(oauthFile)) {
      return null;
    }
    const content = readFileSync(oauthFile, "utf-8");
    return normalizeBustlyOAuthState(JSON.parse(content) as BustlyOAuthState);
  } catch {
    return null;
  }
}

function getSupabaseAuthConfig() {
  const state = readBustlyOAuthState();
  const supabaseUrl = state?.supabase?.url?.trim() ?? "";
  const supabaseAnonKey = state?.supabase?.anonKey?.trim() ?? "";
  const accessToken = state?.user?.supabaseAccessToken?.trim() ?? state?.user?.userAccessToken?.trim() ?? "";
  const bustlyRefreshToken = state?.user?.bustlyRefreshToken?.trim() ?? "";
  const legacySupabaseRefreshToken =
    state?.user?.legacySupabaseRefreshToken?.trim() ?? state?.user?.userRefreshToken?.trim() ?? "";
  return { supabaseUrl, supabaseAnonKey, accessToken, bustlyRefreshToken, legacySupabaseRefreshToken };
}

export async function supabaseFetch(params: SupabaseFetchParams): Promise<Response> {
  const { supabaseUrl, supabaseAnonKey, accessToken } = getSupabaseAuthConfig();
  if (!accessToken) {
    throw new Error("Missing Supabase access token");
  }
  if (!supabaseUrl) {
    throw new Error("Missing Supabase URL");
  }
  if (!supabaseAnonKey) {
    throw new Error("Missing Supabase anon key");
  }
  if (!params.path) {
    throw new Error("Missing Supabase path");
  }
  const endpoint = `${supabaseUrl.replace(/\/+$/, "")}/${params.path.replace(/^\/+/, "")}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
    apikey: supabaseAnonKey,
    ...params.headers,
  };

  return mainHttpFetch(endpoint, {
    label: `Bustly Supabase ${params.method ?? "GET"} ${params.path}`,
    timeoutMs: 30_000,
    method: params.method ?? "GET",
    headers,
    body: params.body,
  });
}

export async function refreshBustlySession(): Promise<BustlyRefreshResult> {
  const apiBaseUrl = resolveBustlyAccountApiBaseUrl();
  const { bustlyRefreshToken } = getSupabaseAuthConfig();
  if (!bustlyRefreshToken) {
    throw new Error("Missing Bustly refresh token");
  }

  const endpoint = `${apiBaseUrl}/api/oauth/api/v1/oauth/refresh`;
  const response = await mainHttpFetch(endpoint, {
    label: "Bustly Session Refresh",
    timeoutMs: 30_000,
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
  const { supabaseUrl, supabaseAnonKey, legacySupabaseRefreshToken } = getSupabaseAuthConfig();
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
  const response = await mainHttpFetch(endpoint, {
    label: "Bustly Supabase Refresh",
    timeoutMs: 30_000,
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

export async function verifySupabaseAuth(): Promise<SupabaseVerifyResult> {
  const response = await supabaseFetch({
    path: "/auth/v1/user",
    method: "GET",
  });
  if (!response.ok) {
    return { ok: false, status: response.status };
  }

  const data = (await response.json()) as SupabaseUserResponse;
  return { ok: true, status: response.status, data };
}
