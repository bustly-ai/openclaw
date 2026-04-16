import type { GatewayAuthSurface } from "../gateway/auth.js";

export type BustlyControlPlaneRuntimeIdentity = {
  baseUrl: string;
  workspaceId: string;
  userId: string;
  runtimeId: string;
  runtimeToken: string;
};

type FetchLike = typeof fetch;

export function resolveBustlyControlPlaneRuntimeIdentity(
  env: NodeJS.ProcessEnv = process.env,
): BustlyControlPlaneRuntimeIdentity | null {
  const baseUrl = env.BUSTLY_CONTROL_PLANE_BASE_URL?.trim() ?? "";
  const workspaceId = env.BUSTLY_RUNTIME_WORKSPACE_ID?.trim() ?? "";
  const userId = env.BUSTLY_RUNTIME_USER_ID?.trim() ?? "";
  const runtimeId = env.BUSTLY_RUNTIME_ID?.trim() ?? "";
  const runtimeToken = env.BUSTLY_RUNTIME_TOKEN?.trim() ?? "";

  if (!baseUrl || !workspaceId || !userId || !runtimeId || !runtimeToken) {
    return null;
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    workspaceId,
    userId,
    runtimeId,
    runtimeToken,
  };
}

export function hasBustlyControlPlaneRuntimeIdentity(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return resolveBustlyControlPlaneRuntimeIdentity(env) !== null;
}

export async function verifyBustlyGatewayTokenWithControlPlane(params: {
  gatewayToken: string;
  authSurface: GatewayAuthSurface;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: FetchLike;
}): Promise<{ ok: true; expiresAt?: string } | { ok: false; reason: string }> {
  const identity = resolveBustlyControlPlaneRuntimeIdentity(params.env);
  if (!identity) {
    return { ok: false, reason: "control_plane_identity_missing" };
  }

  const fetchImpl = params.fetchImpl ?? fetch;
  let response: Response;

  try {
    response = await fetchImpl(`${identity.baseUrl}/runtime/gateway-token/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Auth-Surface": params.authSurface,
      },
      body: JSON.stringify({
        workspaceId: identity.workspaceId,
        userId: identity.userId,
        runtimeId: identity.runtimeId,
        runtimeToken: identity.runtimeToken,
        gatewayToken: params.gatewayToken,
      }),
    });
  } catch {
    return { ok: false, reason: "control_plane_unavailable" };
  }

  if (response.status === 401) {
    return { ok: false, reason: "token_mismatch" };
  }
  if (response.status === 404) {
    return { ok: false, reason: "token_missing_config" };
  }
  if (!response.ok) {
    return { ok: false, reason: "control_plane_unavailable" };
  }

  const payload = (await response.json()) as {
    valid?: boolean;
    expiresAt?: string;
  };
  if (payload.valid !== true) {
    return { ok: false, reason: "token_mismatch" };
  }

  return { ok: true, expiresAt: payload.expiresAt };
}

export async function fetchBustlyRuntimeManifest(params?: {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: FetchLike;
}) {
  const identity = resolveBustlyControlPlaneRuntimeIdentity(params?.env);
  if (!identity) {
    throw new Error("control_plane_identity_missing");
  }

  const fetchImpl = params?.fetchImpl ?? fetch;
  const url = new URL(`${identity.baseUrl}/runtime/manifest`);
  url.searchParams.set("workspaceId", identity.workspaceId);
  url.searchParams.set("userId", identity.userId);
  url.searchParams.set("runtimeId", identity.runtimeId);
  url.searchParams.set("runtimeToken", identity.runtimeToken);

  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`runtime_manifest_fetch_failed:${response.status}`);
  }

  const payload = (await response.json()) as {
    workspaceId?: string;
    runtimeId?: string;
    manifestRevision?: string | null;
    manifest?: Record<string, unknown>;
  };

  return {
    workspaceId: payload.workspaceId?.trim() || identity.workspaceId,
    runtimeId: payload.runtimeId?.trim() || identity.runtimeId,
    manifestRevision: payload.manifestRevision ?? null,
    manifest: payload.manifest && typeof payload.manifest === "object" ? payload.manifest : {},
  };
}
