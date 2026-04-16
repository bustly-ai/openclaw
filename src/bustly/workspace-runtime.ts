import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  getBustlyAccessToken,
  readBustlyOAuthState,
  setActiveWorkspaceId,
} from "../bustly-oauth.js";
import { applyAgentConfig, listAgentEntries } from "../commands/agents.config.js";
import type { OpenClawConfig } from "../config/config.js";
import { resolveConfigPath, resolveStateDir } from "../config/paths.js";
import {
  applyBustlyOnlyConfig,
  BUSTLY_DEFAULT_MODEL_REF,
  syncBustlyConfigFile,
} from "./runtime-config.js";
import { resolveFirstAccessibleBustlyWorkspace } from "./supabase.js";
import {
  buildBustlyWorkspaceAgentId,
  DEFAULT_BUSTLY_AGENT_NAME,
  normalizeBustlyAgentName,
  normalizeBustlyWorkspaceId,
} from "./workspace-agent.js";
import { initializeBustlyWorkspaceBootstrap } from "./workspace-bootstrap.js";

type OpenClawAgentListEntry = NonNullable<NonNullable<OpenClawConfig["agents"]>["list"]>[number];

export type BustlyWorkspaceBinding = {
  agentId: string;
  workspaceDir: string;
};

function stripPerAgentSkipBootstrap(
  entries: OpenClawAgentListEntry[] | undefined,
): OpenClawAgentListEntry[] | undefined {
  if (!entries) {
    return entries;
  }
  return entries.map((entry) => {
    if (!("skipBootstrap" in entry)) {
      return entry;
    }
    const { skipBootstrap: _skipBootstrap, ...rest } = entry as OpenClawAgentListEntry & {
      skipBootstrap?: boolean;
    };
    return rest;
  });
}

function resolveWorkspaceDisplayName(agentName: string, workspaceName?: string): string {
  const normalizedWorkspaceName = workspaceName?.trim();
  if (agentName === DEFAULT_BUSTLY_AGENT_NAME) {
    return "Overview";
  }
  return normalizedWorkspaceName || agentName;
}

function readConfigFromPath(configPath: string): OpenClawConfig {
  const raw = readFileSync(configPath, "utf-8");
  return JSON.parse(raw) as OpenClawConfig;
}

function writeConfigToPath(configPath: string, config: OpenClawConfig): void {
  mkdirSync(dirname(configPath), { recursive: true, mode: 0o700 });
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function resolveConfigPathForEnv(env: NodeJS.ProcessEnv): string {
  const stateDir = resolveStateDir(env);
  return resolveConfigPath(env, stateDir);
}

function ensureConfigExists(configPath: string): void {
  if (existsSync(configPath)) {
    return;
  }
  writeConfigToPath(configPath, {});
}

export function resolveBustlyWorkspaceIdFromOAuthState(): string {
  return readBustlyOAuthState()?.user?.workspaceId?.trim() ?? "";
}

export function resolveBustlyWorkspaceAgentWorkspaceDir(
  workspaceId: string,
  agentName: string = DEFAULT_BUSTLY_AGENT_NAME,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const stateDir = resolveStateDir(env);
  const normalizedWorkspaceId = normalizeBustlyWorkspaceId(workspaceId);
  const normalizedAgentName = normalizeBustlyAgentName(agentName);
  return join(stateDir, "workspaces", normalizedWorkspaceId, "agents", normalizedAgentName);
}

export function resolveActiveBustlyWorkspaceBinding(params?: {
  agentName?: string;
  env?: NodeJS.ProcessEnv;
}): (BustlyWorkspaceBinding & { workspaceId: string }) | null {
  const workspaceId = resolveBustlyWorkspaceIdFromOAuthState();
  if (!workspaceId) {
    return null;
  }
  const agentName = normalizeBustlyAgentName(params?.agentName);
  return {
    workspaceId,
    agentId: buildBustlyWorkspaceAgentId(workspaceId, agentName),
    workspaceDir: resolveBustlyWorkspaceAgentWorkspaceDir(
      workspaceId,
      agentName,
      params?.env ?? process.env,
    ),
  };
}

export async function ensureBustlyWorkspaceAgentConfig(params: {
  workspaceId: string;
  workspaceName?: string;
  agentName?: string;
  selectedModelInput?: string;
  configPath?: string;
  allowCreateConfig?: boolean;
  userAgent?: string;
  baseUrl?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<BustlyWorkspaceBinding> {
  const env = params.env ?? process.env;
  const workspaceId = params.workspaceId.trim();
  if (!workspaceId) {
    throw new Error("Bustly workspaceId is required.");
  }
  const agentName = normalizeBustlyAgentName(params.agentName);
  const configPath = params.configPath ?? resolveConfigPathForEnv(env);
  if (!existsSync(configPath)) {
    if (!params.allowCreateConfig) {
      throw new Error(`OpenClaw config not found at ${configPath}`);
    }
    ensureConfigExists(configPath);
  }
  const workspaceDir = resolveBustlyWorkspaceAgentWorkspaceDir(workspaceId, agentName, env);
  const agentId = buildBustlyWorkspaceAgentId(workspaceId, agentName);
  const config = readConfigFromPath(configPath);
  const workspaceExists = existsSync(workspaceDir);

  const configWithoutMain = listAgentEntries(config).some((entry) => entry.id === "main")
    ? {
        ...config,
        agents: {
          ...config.agents,
          list: listAgentEntries(config).filter((entry) => entry.id !== "main"),
        },
      }
    : config;
  const nextName = resolveWorkspaceDisplayName(agentName, params.workspaceName);
  const updated = applyAgentConfig(configWithoutMain, {
    agentId,
    name: nextName,
    workspace: workspaceDir,
  });
  const currentList = listAgentEntries(updated);
  const nextList = currentList.map((entry) => ({
    ...entry,
    default: entry.id === agentId,
  }));
  const normalizedNextList = nextList.some((entry) => entry.id === agentId)
    ? nextList
    : [...nextList, { id: agentId, name: nextName, workspace: workspaceDir, default: true }];
  const nextConfig = applyBustlyOnlyConfig(
    {
      ...updated,
      agents: {
        ...updated.agents,
        defaults: {
          ...updated.agents?.defaults,
          workspace: workspaceDir,
          skipBootstrap: true,
          model: updated.agents?.defaults?.model ?? {
            primary: BUSTLY_DEFAULT_MODEL_REF,
          },
        },
        list: stripPerAgentSkipBootstrap(normalizedNextList),
      },
    },
    {
      selectedModelInput: params.selectedModelInput,
      workspaceId,
      userAgent: params.userAgent,
      baseUrl: params.baseUrl,
      env,
    },
  );
  if (!workspaceExists) {
    await initializeBustlyWorkspaceBootstrap({
      workspaceDir,
      workspaceId,
      workspaceName: params.workspaceName,
      agentName,
      requireAgentMetadata: agentName === DEFAULT_BUSTLY_AGENT_NAME,
    });
  }

  if (JSON.stringify(nextConfig) !== JSON.stringify(config)) {
    writeConfigToPath(configPath, nextConfig);
  } else {
    syncBustlyConfigFile(configPath, {
      selectedModelInput: params.selectedModelInput,
      workspaceId,
      userAgent: params.userAgent,
      baseUrl: params.baseUrl,
      env,
    });
  }

  return { agentId, workspaceDir };
}

export async function synchronizeBustlyWorkspaceContext(params?: {
  workspaceId?: string;
  workspaceName?: string;
  agentName?: string;
  selectedModelInput?: string;
  configPath?: string;
  allowCreateConfig?: boolean;
  userAgent?: string;
  baseUrl?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<(BustlyWorkspaceBinding & { workspaceId: string }) | null> {
  const workspaceId = params?.workspaceId?.trim() || resolveBustlyWorkspaceIdFromOAuthState();
  if (!workspaceId) {
    return null;
  }
  const binding = await ensureBustlyWorkspaceAgentConfig({
    workspaceId,
    workspaceName: params?.workspaceName,
    agentName: params?.agentName,
    selectedModelInput: params?.selectedModelInput,
    configPath: params?.configPath,
    allowCreateConfig: params?.allowCreateConfig,
    userAgent: params?.userAgent,
    baseUrl: params?.baseUrl,
    env: params?.env,
  });
  return {
    workspaceId,
    ...binding,
  };
}

export async function setActiveBustlyWorkspace(params: {
  workspaceId: string;
  workspaceName?: string;
  agentName?: string;
  selectedModelInput?: string;
  configPath?: string;
  allowCreateConfig?: boolean;
  userAgent?: string;
  baseUrl?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<(BustlyWorkspaceBinding & { workspaceId: string }) | null> {
  const nextWorkspaceId = params.workspaceId.trim();
  if (!nextWorkspaceId) {
    throw new Error("Missing workspaceId");
  }
  const currentWorkspaceId = resolveBustlyWorkspaceIdFromOAuthState();
  let binding: (BustlyWorkspaceBinding & { workspaceId: string }) | null;
  try {
    binding = await synchronizeBustlyWorkspaceContext({
      workspaceId: nextWorkspaceId,
      workspaceName: params.workspaceName,
      agentName: params.agentName,
      selectedModelInput: params.selectedModelInput,
      configPath: params.configPath,
      allowCreateConfig: params.allowCreateConfig,
      userAgent: params.userAgent,
      baseUrl: params.baseUrl,
      env: params.env,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/not found for bootstrap/i.test(message)) {
      throw error;
    }
    const fallbackWorkspace = await resolveFirstAccessibleBustlyWorkspace();
    if (!fallbackWorkspace || fallbackWorkspace.id === nextWorkspaceId) {
      throw error;
    }
    binding = await synchronizeBustlyWorkspaceContext({
      workspaceId: fallbackWorkspace.id,
      workspaceName: fallbackWorkspace.name,
      agentName: params.agentName,
      selectedModelInput: params.selectedModelInput,
      configPath: params.configPath,
      allowCreateConfig: params.allowCreateConfig,
      userAgent: params.userAgent,
      baseUrl: params.baseUrl,
      env: params.env,
    });
  }
  const resolvedWorkspaceId = binding?.workspaceId?.trim() ?? "";
  if (binding && resolvedWorkspaceId && currentWorkspaceId !== resolvedWorkspaceId) {
    setActiveWorkspaceId(resolvedWorkspaceId);
  }
  return binding;
}

export async function ensureBustlyCloudReady(params?: {
  configPath?: string;
  env?: NodeJS.ProcessEnv;
  userAgent?: string;
  baseUrl?: string;
  gatewayPort?: number;
  gatewayBind?: "loopback" | "lan" | "auto";
  gatewayToken?: string;
  nodeManager?: "npm" | "pnpm" | "bun";
}): Promise<BustlyWorkspaceBinding & { workspaceId: string }> {
  const env = params?.env ?? process.env;
  const state = readBustlyOAuthState();
  const userAccessToken = getBustlyAccessToken(state).trim();
  const workspaceId = state?.user?.workspaceId?.trim() ?? "";
  if (!userAccessToken) {
    throw new Error(
      "No Bustly token found in ~/.bustly/bustlyOauth.json (user.supabaseAccessToken). Please sign in first.",
    );
  }
  if (!workspaceId) {
    throw new Error(
      "No Bustly workspace found in ~/.bustly/bustlyOauth.json (user.workspaceId). Please sign in first.",
    );
  }
  // Use a lazy import to avoid a static cycle: gateway-runtime-init depends on
  // workspace-runtime for workspace binding and bootstrap helpers.
  const { ensureGatewayRuntimeInit } = await import("./gateway-runtime-init.js");
  const runtime = await ensureGatewayRuntimeInit({
    workspaceId,
    configPath: params?.configPath,
    gatewayPort: params?.gatewayPort,
    gatewayBind: params?.gatewayBind,
    gatewayToken: params?.gatewayToken,
    nodeManager: params?.nodeManager,
    userAgent: params?.userAgent ?? "openclaw-cloud",
    baseUrl: params?.baseUrl,
    env,
  });
  return {
    workspaceId,
    agentId: runtime.agentId,
    workspaceDir: runtime.workspace,
  };
}
