import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { BustlyOAuthState } from "../bustly-types.js";
import { resolveElectronIsolatedStateDir } from "../defaults.js";

export type SupabaseUserResponse = {
  id?: string;
  email?: string;
  role?: string;
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
    return JSON.parse(content) as BustlyOAuthState;
  } catch {
    return null;
  }
}

function getSupabaseAuthConfig() {
  const state = readBustlyOAuthState();
  const supabaseUrl = state?.supabase?.url?.trim() ?? "";
  const supabaseAnonKey = state?.supabase?.anonKey?.trim() ?? "";
  const accessToken = state?.user?.userAccessToken?.trim() ?? "";
  const refreshToken = state?.user?.userRefreshToken?.trim() ?? "";
  return { supabaseUrl, supabaseAnonKey, accessToken, refreshToken };
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

  console.log("[Supabase API] Request:", params.method ?? "GET", endpoint);
  return fetch(endpoint, {
    method: params.method ?? "GET",
    headers,
    body: params.body,
  });
}

export async function refreshSupabaseAuth(): Promise<SupabaseRefreshResult> {
  const { supabaseUrl, supabaseAnonKey, refreshToken } = getSupabaseAuthConfig();
  if (!refreshToken) {
    throw new Error("Missing Supabase refresh token");
  }
  if (!supabaseUrl) {
    throw new Error("Missing Supabase URL");
  }
  if (!supabaseAnonKey) {
    throw new Error("Missing Supabase anon key");
  }

  const endpoint = `${supabaseUrl.replace(/\/+$/, "")}/auth/v1/token?grant_type=refresh_token`;
  console.log("[Supabase API] Refresh request:", endpoint);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({
      refresh_token: refreshToken,
    }),
  });

  console.log("[Supabase API] Refresh response:", response.status, response.statusText);
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
  console.log("[Supabase API] Verify auth response:", response.status, response.statusText);
  if (!response.ok) {
    return { ok: false, status: response.status };
  }

  const data = (await response.json()) as SupabaseUserResponse;
  console.log("[Supabase API] Verify auth user:", data.id ?? "unknown");
  return { ok: true, status: response.status, data };
}
