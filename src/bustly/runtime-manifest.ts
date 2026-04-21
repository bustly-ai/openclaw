import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { listAgentEntries } from "../commands/agents.config.js";
import type { OpenClawConfig } from "../config/config.js";
import { resolveConfigPath, resolveStateDir } from "../config/paths.js";
import { normalizeAgentId } from "../routing/session-key.js";
import {
  getBustlyAccessToken,
  readBustlyOAuthState,
  readBustlyOAuthStateEnsuringFreshToken,
} from "../bustly-oauth.js";
import { resolveBustlyHeartbeatWorkspaceContext } from "./heartbeats.js";
import { requestHeartbeatNow } from "../infra/heartbeat-wake.js";
import { ensureBustlyWorkspacePresetAgents } from "./workspace-agents.js";
import type { BustlyWorkspaceBinding } from "./workspace-runtime.js";
import {
  resolveActiveBustlyWorkspaceBinding,
  setActiveBustlyWorkspace,
} from "./workspace-runtime.js";
import { normalizeBustlyWorkspaceId } from "./workspace-agent.js";

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

async function resolveWorkspaceId(params?: { workspaceId?: string }): Promise<string> {
  const explicitWorkspaceId = params?.workspaceId?.trim();
  if (explicitWorkspaceId) {
    return explicitWorkspaceId;
  }
  return (await readBustlyOAuthStateEnsuringFreshToken())?.user?.workspaceId?.trim() || "";
}

function resolveConfigPathForEnv(configPath?: string, env: NodeJS.ProcessEnv = process.env): string {
  if (configPath?.trim()) {
    return configPath.trim();
  }
  const stateDir = resolveStateDir(env);
  return resolveConfigPath(env, stateDir);
}

function readConfig(configPath: string): OpenClawConfig {
  if (!existsSync(configPath)) {
    return {};
  }
  return JSON.parse(readFileSync(configPath, "utf-8")) as OpenClawConfig;
}

function hasWorkspaceHeartbeatState(workspaceId: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const normalizedWorkspaceId = normalizeBustlyWorkspaceId(workspaceId);
  if (!normalizedWorkspaceId) {
    return false;
  }
  const heartbeatDir = path.join(
    resolveStateDir(env),
    "workspaces",
    normalizedWorkspaceId,
    "heartbeats",
  );
  return (
    existsSync(heartbeatDir) &&
    readdirSync(heartbeatDir, { withFileTypes: true }).some(
      (entry) => entry.isFile() && entry.name.endsWith(".json"),
    )
  );
}

function queueInitialWorkspaceHeartbeats(params: {
  workspaceId: string;
  configPath?: string;
  env?: NodeJS.ProcessEnv;
}) {
  const workspaceId = normalizeBustlyWorkspaceId(params.workspaceId);
  if (!workspaceId || hasWorkspaceHeartbeatState(workspaceId, params.env)) {
    return;
  }
  const cfg = readConfig(resolveConfigPathForEnv(params.configPath, params.env));
  const agentIds = listAgentEntries(cfg)
    .filter((entry) => {
      if (!entry.heartbeat) {
        return false;
      }
      const workspaceDir = entry.workspace?.trim();
      if (!workspaceDir) {
        return false;
      }
      return (
        resolveBustlyHeartbeatWorkspaceContext({
          workspaceDir,
          env: params.env,
        })?.workspaceId === workspaceId
      );
    })
    .map((entry) => normalizeAgentId(entry.id))
    .filter(Boolean);
  for (const agentId of agentIds) {
    requestHeartbeatNow({
      reason: "wake",
      coalesceMs: 0,
      agentId,
    });
  }
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

export async function getBustlyRuntimeHealthSnapshotEnsuringFreshToken(): Promise<{
  loggedIn: boolean;
  workspaceId: string;
  userId: string;
  userEmail: string;
  hasSupabaseConfig: boolean;
  activeBinding: (BustlyWorkspaceBinding & { workspaceId: string }) | null;
}> {
  const state = await readBustlyOAuthStateEnsuringFreshToken();
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
  const workspaceId = await resolveWorkspaceId({
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

  const presetAgentsApplied = await ensureBustlyWorkspacePresetAgents({
    workspaceId,
    workspaceName: params.workspaceName,
    ...(params.presetAgents
      ? {
          presets: params.presetAgents.map((preset) => ({
            slug: preset.slug,
            label: preset.label,
            icon: preset.icon,
            isMain: preset.isMain,
          })),
        }
      : {}),
    allowCreateConfig: params.allowCreateConfig ?? true,
    configPath: params.configPath,
    env: params.env,
  });
  queueInitialWorkspaceHeartbeats({
    workspaceId,
    configPath: params.configPath,
    env: params.env,
  });

  return {
    workspaceId,
    agentId: binding.agentId,
    workspaceDir: binding.workspaceDir,
    presetAgentsApplied,
  };
}

export async function bootstrapBustlyRuntime(
  params: BustlyRuntimeBootstrapParams = {},
): Promise<BustlyRuntimeManifestApplyResult> {
  return await applyBustlyRuntimeManifest(params);
}
