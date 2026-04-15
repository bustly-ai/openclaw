import { resolveBustlyAccountWebBaseUrl } from "./env.js";

export type BustlyLinkKind =
  | "settings"
  | "workspace-settings"
  | "workspace-invite"
  | "workspace-manage"
  | "workspace-pricing"
  | "workspace-create";

export function resolveBustlyWebBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return resolveBustlyAccountWebBaseUrl(env);
}

export function buildBustlyAdminUrl(params: {
  query?: Record<string, string | null | undefined>;
  path?: string;
  env?: NodeJS.ProcessEnv;
}): string {
  const pathSuffix = params.path ?? "";
  const baseUrl = resolveBustlyWebBaseUrl(params.env);
  const url = new URL(`${baseUrl}/admin${pathSuffix}`);
  for (const [key, value] of Object.entries(params.query ?? {})) {
    if (value?.trim()) {
      url.searchParams.set(key, value.trim());
    }
  }
  return url.toString();
}

function resolveWorkspaceScopedLink(kind: BustlyLinkKind, workspaceId: string): string {
  switch (kind) {
    case "workspace-settings":
      return buildBustlyAdminUrl({
        query: {
          setting_modal: "workspace-settings",
          workspace_id: workspaceId,
        },
      });
    case "workspace-invite":
      return buildBustlyAdminUrl({
        query: {
          setting_modal: "members",
          workspace_id: workspaceId,
        },
      });
    case "workspace-manage":
      return buildBustlyAdminUrl({
        query: {
          setting_modal: "billing",
          workspace_id: workspaceId,
        },
      });
    case "workspace-pricing":
      return buildBustlyAdminUrl({
        query: {
          payment_modal: "pricing",
          workspace_id: workspaceId,
        },
      });
    default:
      throw new Error(`Unsupported workspace link kind: ${kind}`);
  }
}

export function resolveBustlyAdminLink(params: {
  kind: BustlyLinkKind;
  workspaceId?: string;
  env?: NodeJS.ProcessEnv;
}): string {
  if (params.kind === "settings") {
    return buildBustlyAdminUrl({
      query: { setting_modal: "profile" },
      env: params.env,
    });
  }
  if (params.kind === "workspace-create") {
    return buildBustlyAdminUrl({
      query: { workspace_id: params.workspaceId?.trim() || undefined },
      path: "/onboarding",
      env: params.env,
    });
  }
  const workspaceId = params.workspaceId?.trim();
  if (!workspaceId) {
    throw new Error("workspaceId is required");
  }
  return resolveWorkspaceScopedLink(params.kind, workspaceId);
}
