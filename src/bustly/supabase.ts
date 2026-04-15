import { readBustlyOAuthState } from "../bustly-oauth.js";

export type BustlyAccessibleWorkspace = {
  id: string;
  name: string;
  status: string;
};

type BustlyAccessibleWorkspaceRow = {
  id?: unknown;
  name?: unknown;
  status?: unknown;
};

export type BustlySupabaseAuthConfig = {
  url: string;
  anonKey: string;
  accessToken: string;
  workspaceId: string;
  userId: string;
  userEmail: string;
  userName: string;
};

export type BustlySupabaseFetchParams = {
  path: string;
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: BodyInit;
  timeoutMs?: number;
};

export function getBustlySupabaseAuthConfig(): BustlySupabaseAuthConfig | null {
  const state = readBustlyOAuthState();
  const supabaseUrl = state?.supabase?.url?.trim() ?? "";
  const anonKey = state?.supabase?.anonKey?.trim() ?? "";
  const accessToken = state?.user?.userAccessToken?.trim() ?? "";
  const workspaceId = state?.user?.workspaceId?.trim() ?? "";
  const userId = state?.user?.userId?.trim() ?? "";
  const userEmail = state?.user?.userEmail?.trim() ?? "";
  const userName = state?.user?.userName?.trim() ?? "";
  if (!supabaseUrl || !anonKey || !accessToken) {
    return null;
  }
  return {
    url: supabaseUrl,
    anonKey,
    accessToken,
    workspaceId,
    userId,
    userEmail,
    userName,
  };
}

export async function bustlySupabaseFetch(
  params: BustlySupabaseFetchParams,
): Promise<Response> {
  const config = getBustlySupabaseAuthConfig();
  if (!config) {
    throw new Error("Missing Bustly Supabase auth config");
  }
  const path = params.path.trim();
  if (!path) {
    throw new Error("Missing Bustly Supabase path");
  }
  const controller = new AbortController();
  const timeoutMs =
    typeof params.timeoutMs === "number" && Number.isFinite(params.timeoutMs)
      ? Math.max(1_000, params.timeoutMs)
      : 30_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(
      `${config.url.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`,
      {
        method: params.method ?? "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${config.accessToken}`,
          apikey: config.anonKey,
          ...params.headers,
        },
        body: params.body,
        signal: controller.signal,
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function listAccessibleBustlyWorkspaces(limit = 20): Promise<BustlyAccessibleWorkspace[]> {
  const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, Math.floor(limit))) : 20;
  const query = new URLSearchParams({
    select: "id,name,status",
    status: "eq.ACTIVE",
    order: "created_at.desc",
    limit: String(normalizedLimit),
  });
  const response = await bustlySupabaseFetch({
    path: `rest/v1/workspaces?${query.toString()}`,
  });
  if (!response.ok) {
    throw new Error(`Failed to list accessible Bustly workspaces (${response.status})`);
  }
  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload
    .filter((entry): entry is BustlyAccessibleWorkspaceRow => typeof entry === "object" && entry !== null)
    .map((entry) => ({
      id: typeof entry.id === "string" ? entry.id.trim() : "",
      name: typeof entry.name === "string" ? entry.name.trim() : "",
      status: typeof entry.status === "string" ? entry.status.trim() : "",
    }))
    .filter((entry) => Boolean(entry.id && entry.name));
}

export async function resolveFirstAccessibleBustlyWorkspace(): Promise<BustlyAccessibleWorkspace | null> {
  const workspaces = await listAccessibleBustlyWorkspaces(1);
  return workspaces[0] ?? null;
}
