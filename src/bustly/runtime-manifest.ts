import { getBustlyAccessToken, readBustlyOAuthState } from "../bustly-oauth.js";
import { loadEnabledBustlyRemoteAgentPresets } from "./agent-presets.js";
import { ensureBustlyWorkspacePresetAgents } from "./workspace-agents.js";
import type { BustlyWorkspaceBinding } from "./workspace-runtime.js";
import {
  resolveActiveBustlyWorkspaceBinding,
  setActiveBustlyWorkspace,
} from "./workspace-runtime.js";

export type BustlyRuntimePresetAgent = {
  slug: string;
  label: string;
  icon?: string;
  isMain?: boolean;
};

export type BustlyRuntimeManifestApplyParams = {
  workspaceId?: string;
  workspaceName?: string;
  agentName?: string;
  selectedModelInput?: string;
  userAgent?: string;
  baseUrl?: string;
  presetAgents?: BustlyRuntimePresetAgent[];
  allowCreateConfig?: boolean;
  configPath?: string;
  env?: NodeJS.ProcessEnv;
};

export type BustlyRuntimeManifestApplyResult = BustlyWorkspaceBinding & {
  workspaceId: string;
  presetAgentsApplied: number;
};

export type BustlyRuntimeBootstrapParams = BustlyRuntimeManifestApplyParams;

function resolveWorkspaceId(params?: { workspaceId?: string }): string {
  return params?.workspaceId?.trim() || readBustlyOAuthState()?.user?.workspaceId?.trim() || "";
}

export function getBustlyRuntimeHealthSnapshot(): {
  loggedIn: boolean;
  workspaceId: string;
  userId: string;
  userEmail: string;
  hasSupabaseConfig: boolean;
  activeBinding: (BustlyWorkspaceBinding & { workspaceId: string }) | null;
} {
  const state = readBustlyOAuthState();
  const workspaceId = state?.user?.workspaceId?.trim() ?? "";
  const accessToken = getBustlyAccessToken(state).trim();
  return {
    loggedIn: Boolean(accessToken),
    workspaceId,
    userId: state?.user?.userId?.trim() ?? "",
    userEmail: state?.user?.userEmail?.trim() ?? "",
    hasSupabaseConfig: Boolean(state?.supabase?.url?.trim() && state?.supabase?.anonKey?.trim()),
    activeBinding: resolveActiveBustlyWorkspaceBinding(),
  };
}

export async function applyBustlyRuntimeManifest(
  params: BustlyRuntimeManifestApplyParams,
): Promise<BustlyRuntimeManifestApplyResult> {
  const workspaceId = resolveWorkspaceId({
    workspaceId: params.workspaceId,
  });
  if (!workspaceId) {
    throw new Error("workspaceId is required");
  }

  const binding = await setActiveBustlyWorkspace({
    workspaceId,
    workspaceName: params.workspaceName,
    agentName: params.agentName,
    selectedModelInput: params.selectedModelInput,
    userAgent: params.userAgent ?? "openclaw-cloud",
    baseUrl: params.baseUrl,
    allowCreateConfig: params.allowCreateConfig ?? true,
    configPath: params.configPath,
    env: params.env,
  });
  if (!binding) {
    throw new Error("Failed to apply Bustly runtime manifest.");
  }

  const presetAgents = params.presetAgents ?? [];
  if (presetAgents.length > 0) {
    await ensureBustlyWorkspacePresetAgents({
      workspaceId,
      workspaceName: params.workspaceName,
      presets: presetAgents.map((preset) => ({
        slug: preset.slug,
        label: preset.label,
        icon: preset.icon,
        isMain: preset.isMain,
      })),
      allowCreateConfig: params.allowCreateConfig ?? true,
      configPath: params.configPath,
      env: params.env,
    });
  }

  return {
    workspaceId,
    agentId: binding.agentId,
    workspaceDir: binding.workspaceDir,
    presetAgentsApplied: presetAgents.length,
  };
}

export async function bootstrapBustlyRuntime(
  params: BustlyRuntimeBootstrapParams = {},
): Promise<BustlyRuntimeManifestApplyResult> {
  const presetAgents =
    params.presetAgents ??
    (await loadEnabledBustlyRemoteAgentPresets({
      env: params.env,
    }));
  return await applyBustlyRuntimeManifest({
    ...params,
    presetAgents,
  });
}
