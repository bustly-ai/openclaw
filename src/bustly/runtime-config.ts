import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { OpenClawConfig } from "../config/config.js";
import { BUSTLY_PROVIDER_ID } from "../agents/bustly-models.js";
import { readBustlyOAuthState } from "../bustly-oauth.js";
import { DEFAULT_BUSTLY_HEARTBEAT_EVERY } from "./heartbeats.js";

export const BUSTLY_PROVIDER_PROFILE_ID = `${BUSTLY_PROVIDER_ID}:default`;
export const BUSTLY_MODEL_GATEWAY_BASE_URL_DEFAULT = "https://gw.bustly.ai/api/v1";
export const BUSTLY_DEFAULT_MODEL_REF = `${BUSTLY_PROVIDER_ID}/chat.standard`;
export const BUSTLY_DEFAULT_HEARTBEAT_MODEL_REF = `${BUSTLY_PROVIDER_ID}/chat.standard`;

export const BUSTLY_ROUTE_MODELS = [
  {
    routeKey: "chat.standard",
    modelRef: "bustly/chat.standard",
    alias: "Standard",
    description: "Fast & efficient for daily tasks.",
    reasoning: false,
  },
  {
    routeKey: "chat.advanced",
    modelRef: "bustly/chat.advanced",
    alias: "Advanced",
    description: "Balanced performance for complex reasoning.",
    reasoning: true,
  },
  {
    routeKey: "chat.ultra",
    modelRef: "bustly/chat.ultra",
    alias: "Ultra",
    description: "Frontier intelligence for critical challenges.",
    reasoning: true,
  },
] as const;

const BUSTLY_MODEL_REF_SET = new Set<string>(BUSTLY_ROUTE_MODELS.map((entry) => entry.modelRef));
const BUSTLY_ROUTE_KEY_SET = new Set<string>(BUSTLY_ROUTE_MODELS.map((entry) => entry.routeKey));

export function normalizeBustlyModelRef(value: unknown): string {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (BUSTLY_MODEL_REF_SET.has(raw)) {
    return raw;
  }
  if (raw.startsWith(`${BUSTLY_PROVIDER_ID}/`)) {
    const routeKey = raw.slice(`${BUSTLY_PROVIDER_ID}/`.length);
    if (BUSTLY_ROUTE_KEY_SET.has(routeKey)) {
      return `${BUSTLY_PROVIDER_ID}/${routeKey}`;
    }
  }
  if (BUSTLY_ROUTE_KEY_SET.has(raw)) {
    return `${BUSTLY_PROVIDER_ID}/${raw}`;
  }
  if (raw === "lite" || raw === "auto") {
    return BUSTLY_DEFAULT_MODEL_REF;
  }
  if (raw === "pro") {
    return "bustly/chat.advanced";
  }
  if (raw === "max") {
    return "bustly/chat.ultra";
  }
  return BUSTLY_DEFAULT_MODEL_REF;
}

function resolveCurrentBustlyModelRef(cfg: OpenClawConfig): string {
  const modelConfig = cfg.agents?.defaults?.model;
  const raw =
    typeof modelConfig === "string"
      ? modelConfig
      : modelConfig && typeof modelConfig === "object"
        ? modelConfig.primary
        : undefined;
  return normalizeBustlyModelRef(raw);
}

export function resolveBustlyProviderUserAgent(params?: {
  defaultUserAgent?: string;
  env?: NodeJS.ProcessEnv;
}): string {
  const env = params?.env ?? process.env;
  const fromEnv = env.BUSTLY_MODEL_GATEWAY_USER_AGENT?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  return params?.defaultUserAgent?.trim() || "openclaw";
}

export function buildBustlyProviderHeaders(params?: {
  workspaceId?: string;
  userAgent?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": resolveBustlyProviderUserAgent({
      defaultUserAgent: params?.userAgent,
    }),
  };
  const workspaceId =
    params?.workspaceId?.trim() ?? readBustlyOAuthState()?.user?.workspaceId?.trim() ?? "";
  if (workspaceId) {
    headers["X-Workspace-Id"] = workspaceId;
  }
  return headers;
}

function buildBustlyProviderModels(headers: Record<string, string>) {
  return BUSTLY_ROUTE_MODELS.map((entry) => ({
    id: entry.routeKey,
    name: entry.alias,
    reasoning: entry.reasoning,
    input: ["text", "image"] as Array<"text" | "image">,
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    },
    contextWindow: 258_000,
    maxTokens: 128_000,
    headers: { ...headers },
  }));
}

export function resolveBustlyGatewayBaseUrl(
  cfg: OpenClawConfig,
  params?: { baseUrl?: string; env?: NodeJS.ProcessEnv },
): string {
  const env = params?.env ?? process.env;
  const explicitBaseUrl = params?.baseUrl?.trim();
  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }
  const envBaseUrl = env.BUSTLY_MODEL_GATEWAY_BASE_URL?.trim();
  if (envBaseUrl) {
    return envBaseUrl;
  }
  const configured = cfg.models?.providers?.[BUSTLY_PROVIDER_ID]?.baseUrl?.trim();
  if (configured) {
    return configured;
  }
  return BUSTLY_MODEL_GATEWAY_BASE_URL_DEFAULT;
}

export function applyBustlyOnlyConfig(
  cfg: OpenClawConfig,
  options?: {
    selectedModelInput?: string;
    workspaceId?: string;
    userAgent?: string;
    baseUrl?: string;
    env?: NodeJS.ProcessEnv;
  },
): OpenClawConfig {
  const selectedModel = options?.selectedModelInput?.trim()
    ? normalizeBustlyModelRef(options.selectedModelInput)
    : resolveCurrentBustlyModelRef(cfg);
  const bustlyHeaders = buildBustlyProviderHeaders({
    workspaceId: options?.workspaceId,
    userAgent: options?.userAgent,
  });
  const nextAgentModels: Record<string, { alias?: string }> = {};
  for (const entry of BUSTLY_ROUTE_MODELS) {
    nextAgentModels[entry.modelRef] = { alias: entry.alias };
  }
  const existingDefaults = cfg.agents?.defaults ?? {};
  const existingHeartbeatConfig = existingDefaults.heartbeat;
  const heartbeatModel =
    existingHeartbeatConfig?.model?.trim() || BUSTLY_DEFAULT_HEARTBEAT_MODEL_REF;
  const normalizedAgentList = cfg.agents?.list?.map((entry) => {
    if (!entry.id.startsWith("bustly-") || !entry.heartbeat) {
      return entry;
    }
    return {
      ...entry,
      heartbeat: {
        ...entry.heartbeat,
        every: DEFAULT_BUSTLY_HEARTBEAT_EVERY,
        target: entry.heartbeat.target ?? "none",
      },
    };
  });
  const existingModelConfig = existingDefaults.model;
  const preservedFallbacks =
    typeof existingModelConfig === "object" &&
    existingModelConfig !== null &&
    Array.isArray((existingModelConfig as { fallbacks?: unknown }).fallbacks)
      ? (existingModelConfig as { fallbacks?: string[] }).fallbacks
      : undefined;

  return {
    ...cfg,
    auth: {
      ...cfg.auth,
      profiles: {
        [BUSTLY_PROVIDER_PROFILE_ID]: {
          provider: BUSTLY_PROVIDER_ID,
          mode: "token",
        },
      },
      order: {
        [BUSTLY_PROVIDER_ID]: [BUSTLY_PROVIDER_PROFILE_ID],
      },
    },
    agents: {
      ...cfg.agents,
      defaults: {
        ...existingDefaults,
        heartbeat: {
          ...existingHeartbeatConfig,
          every: DEFAULT_BUSTLY_HEARTBEAT_EVERY,
          model: heartbeatModel,
        },
        model: {
          ...(preservedFallbacks ? { fallbacks: preservedFallbacks } : {}),
          primary: selectedModel,
        },
        models: nextAgentModels,
      },
      ...(normalizedAgentList ? { list: normalizedAgentList } : {}),
    },
    models: {
      ...cfg.models,
      providers: {
        [BUSTLY_PROVIDER_ID]: {
          baseUrl: resolveBustlyGatewayBaseUrl(cfg, {
            baseUrl: options?.baseUrl,
            env: options?.env,
          }),
          auth: "token",
          api: "openai-completions",
          headers: bustlyHeaders,
          models: buildBustlyProviderModels(bustlyHeaders),
        },
      },
    },
  };
}

export function syncBustlyConfigFile(
  configPath: string,
  options?: {
    selectedModelInput?: string;
    workspaceId?: string;
    userAgent?: string;
    baseUrl?: string;
    env?: NodeJS.ProcessEnv;
  },
): { changed: boolean; config: OpenClawConfig | null } {
  if (!existsSync(configPath)) {
    return { changed: false, config: null };
  }
  const raw = readFileSync(configPath, "utf-8");
  const config = JSON.parse(raw) as OpenClawConfig;
  const nextConfig = applyBustlyOnlyConfig(config, options);
  if (JSON.stringify(nextConfig) !== JSON.stringify(config)) {
    writeFileSync(configPath, JSON.stringify(nextConfig, null, 2));
    return { changed: true, config: nextConfig };
  }
  return { changed: false, config: config };
}
