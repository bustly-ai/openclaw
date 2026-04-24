import { randomBytes } from "node:crypto";
import { ensureOpenClawModelsJson } from "../agents/models-config.js";
import { ensurePiAuthJsonFromAuthProfiles } from "../agents/pi-auth-json.js";
import { createConfigIO, type GatewayBindMode, type OpenClawConfig } from "../config/config.js";
import { DEFAULT_GATEWAY_PORT, resolveConfigPath, resolveStateDir } from "../config/paths.js";
import { DEFAULT_AGENT_ID } from "../routing/session-key.js";
import { resolveUserPath } from "../utils.js";
import { synchronizeBustlyWorkspaceContext } from "./workspace-runtime.js";

export type GatewayRuntimeNodeManager = "npm" | "pnpm" | "bun";
export type GatewayRuntimeBind = GatewayBindMode;

export interface GatewayRuntimeInitOptions {
  workspaceId: string;
  workspaceName?: string;
  agentName?: string;
  selectedModelInput?: string;
  configPath?: string;
  gatewayPort?: number;
  gatewayBind?: GatewayRuntimeBind;
  gatewayToken?: string;
  nodeManager?: GatewayRuntimeNodeManager;
  userAgent?: string;
  baseUrl?: string;
  env?: NodeJS.ProcessEnv;
  deferPresetAgentsSync?: boolean;
}

export interface GatewayRuntimeInitResult {
  success: boolean;
  configPath: string;
  gatewayPort: number;
  gatewayToken?: string;
  gatewayBind: GatewayBindMode;
  workspace: string;
  workspaceId: string;
  agentId: string;
  error?: string;
}

function resolveGatewayRuntimeConfigPath(options?: {
  configPath?: string;
  env?: NodeJS.ProcessEnv;
}): string {
  if (options?.configPath?.trim()) {
    return options.configPath.trim();
  }
  const env = options?.env ?? process.env;
  return resolveConfigPath(env, resolveStateDir(env));
}

function resolveGatewayRuntimeAgentDir(env: NodeJS.ProcessEnv): string {
  const override = env.OPENCLAW_AGENT_DIR?.trim() || env.PI_CODING_AGENT_DIR?.trim();
  if (override) {
    return resolveUserPath(override);
  }
  return resolveUserPath(`${resolveStateDir(env)}/agents/${DEFAULT_AGENT_ID}/agent`);
}

function normalizeGatewayPort(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  return fallback;
}

function resolveGatewayBind(value: unknown, fallback: GatewayBindMode): GatewayBindMode {
  const raw = typeof value === "string" ? value.trim() : "";
  switch (raw) {
    case "auto":
    case "lan":
    case "loopback":
    case "custom":
    case "tailnet":
      return raw;
    default:
      return fallback;
  }
}

function resolveGatewayToken(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw || randomBytes(24).toString("hex");
}

function applyGatewayRuntimeBaseConfig(
  config: OpenClawConfig,
  options: {
    gatewayPort?: number;
    gatewayBind?: GatewayRuntimeBind;
    gatewayToken?: string;
    nodeManager?: GatewayRuntimeNodeManager;
  },
): {
  config: OpenClawConfig;
  gatewayPort: number;
  gatewayBind: GatewayBindMode;
  gatewayToken: string;
} {
  const gatewayPort = normalizeGatewayPort(
    options.gatewayPort,
    normalizeGatewayPort(config.gateway?.port, DEFAULT_GATEWAY_PORT),
  );
  const gatewayBind = resolveGatewayBind(
    options.gatewayBind,
    resolveGatewayBind(config.gateway?.bind, "loopback"),
  );
  const gatewayToken = resolveGatewayToken(options.gatewayToken ?? config.gateway?.auth?.token);

  const nextConfig: OpenClawConfig = {
    ...config,
    gateway: {
      ...config.gateway,
      mode: "local",
      port: gatewayPort,
      bind: gatewayBind,
      auth: {
        ...config.gateway?.auth,
        mode: "token",
        token: gatewayToken,
      },
    },
    session: {
      ...config.session,
      dmScope:
        config.session?.dmScope && config.session.dmScope !== "main"
          ? config.session.dmScope
          : "per-account-channel-peer",
    },
  };

  if (!options.nodeManager) {
    return {
      config: nextConfig,
      gatewayPort,
      gatewayBind,
      gatewayToken,
    };
  }

  return {
    config: {
      ...nextConfig,
      skills: {
        ...nextConfig.skills,
        install: {
          ...nextConfig.skills?.install,
          nodeManager: options.nodeManager,
        },
      },
    },
    gatewayPort,
    gatewayBind,
    gatewayToken,
  };
}

const pendingPresetAgentWarmups = new Map<string, Promise<void>>();

async function warmBustlyWorkspacePresetAgents(params: {
  workspaceId: string;
  workspaceName?: string;
  configPath: string;
  env: NodeJS.ProcessEnv;
}): Promise<void> {
  const { loadEnabledBustlyWorkspaceBootstrapAgents } = await import("./workspace-bootstrap.js");
  const { ensureBustlyWorkspacePresetAgents } = await import("./workspace-agents.js");
  const presetAgents = await loadEnabledBustlyWorkspaceBootstrapAgents({ env: params.env });
  await ensureBustlyWorkspacePresetAgents({
    workspaceId: params.workspaceId,
    workspaceName: params.workspaceName,
    presets: presetAgents.map((preset) => ({
      slug: preset.slug,
      label: preset.label,
      icon: preset.icon,
      isMain: preset.isMain,
      bootstrapMetadata: preset.bootstrapMetadata,
    })),
    configPath: params.configPath,
    allowCreateConfig: true,
    env: params.env,
  });
}

function scheduleDeferredPresetAgentWarmup(params: {
  workspaceId: string;
  workspaceName?: string;
  configPath: string;
  env: NodeJS.ProcessEnv;
}): void {
  const warmupKey = `${params.configPath}:${params.workspaceId}`;
  if (pendingPresetAgentWarmups.has(warmupKey)) {
    return;
  }
  const warmupPromise = Promise.resolve()
    .then(async () => {
      await warmBustlyWorkspacePresetAgents(params);
    })
    .catch((error) => {
      console.warn("[BustlyWorkspace] Deferred preset agent warmup failed", {
        workspaceId: params.workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
    })
    .finally(() => {
      pendingPresetAgentWarmups.delete(warmupKey);
    });
  pendingPresetAgentWarmups.set(warmupKey, warmupPromise);
}

export async function ensureGatewayRuntimeInit(
  options: GatewayRuntimeInitOptions,
): Promise<GatewayRuntimeInitResult> {
  const workspaceId = options.workspaceId.trim();
  if (!workspaceId) {
    throw new Error("Missing Bustly workspaceId for gateway runtime initialization.");
  }

  const env = options.env ?? process.env;
  const configPath = resolveGatewayRuntimeConfigPath({
    configPath: options.configPath,
    env,
  });
  const io = createConfigIO({ configPath, env });
  const { snapshot, writeOptions } = await io.readConfigFileSnapshotForWrite();
  const baseConfig = snapshot.valid ? snapshot.config : {};
  const runtimeBase = applyGatewayRuntimeBaseConfig(baseConfig, {
    gatewayPort: options.gatewayPort,
    gatewayBind: options.gatewayBind,
    gatewayToken: options.gatewayToken,
    nodeManager: options.nodeManager,
  });

  await io.writeConfigFile(runtimeBase.config, writeOptions);

  const binding = await synchronizeBustlyWorkspaceContext({
    workspaceId,
    workspaceName: options.workspaceName,
    agentName: options.agentName,
    selectedModelInput: options.selectedModelInput,
    configPath,
    allowCreateConfig: true,
    userAgent: options.userAgent,
    baseUrl: options.baseUrl,
    env,
  });
  if (!binding) {
    throw new Error("Failed to initialize Bustly workspace binding.");
  }
  if (!options.deferPresetAgentsSync) {
    // Keep explicit runtime init paths synchronous so they preserve the existing
    // "all preset agents ready before return" contract.
    await warmBustlyWorkspacePresetAgents({
      workspaceId,
      workspaceName: options.workspaceName,
      configPath,
      env,
    });
  }

  const finalSnapshot = await io.readConfigFileSnapshot();
  const finalConfig = finalSnapshot.valid ? finalSnapshot.config : runtimeBase.config;
  const agentDir = resolveGatewayRuntimeAgentDir(env);
  await ensureOpenClawModelsJson(finalConfig, agentDir);
  await ensurePiAuthJsonFromAuthProfiles(agentDir);
  if (options.deferPresetAgentsSync) {
    // Cloud startup only needs the active workspace binding ready. Preset agents
    // can hydrate in the background without blocking health.
    scheduleDeferredPresetAgentWarmup({
      workspaceId,
      workspaceName: options.workspaceName,
      configPath,
      env,
    });
  }

  return {
    success: true,
    configPath,
    gatewayPort: normalizeGatewayPort(finalConfig.gateway?.port, runtimeBase.gatewayPort),
    gatewayBind: resolveGatewayBind(finalConfig.gateway?.bind, runtimeBase.gatewayBind),
    gatewayToken:
      typeof finalConfig.gateway?.auth?.token === "string"
        ? finalConfig.gateway.auth.token
        : runtimeBase.gatewayToken,
    workspace: binding.workspaceDir,
    workspaceId,
    agentId: binding.agentId,
  };
}

export function isGatewayRuntimeFullyInitialized(options?: {
  configPath?: string;
  env?: NodeJS.ProcessEnv;
}): boolean {
  try {
    const configPath = resolveGatewayRuntimeConfigPath(options);
    const io = createConfigIO({ configPath, env: options?.env ?? process.env });
    const config = io.loadConfig();
    const hasProfiles =
      Boolean(config.auth?.profiles) && Object.keys(config.auth?.profiles ?? {}).length > 0;
    const model = config.agents?.defaults?.model;
    const primary = typeof model === "string" ? model : model?.primary;
    const hasPrimaryModel = typeof primary === "string" && primary.trim().length > 0;
    return hasProfiles && hasPrimaryModel;
  } catch {
    return false;
  }
}

export function getGatewayRuntimeConfigPath(options?: {
  configPath?: string;
  env?: NodeJS.ProcessEnv;
}): string {
  return resolveGatewayRuntimeConfigPath(options);
}
