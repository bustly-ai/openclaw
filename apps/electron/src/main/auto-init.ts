// @ts-nocheck
/**
 * Automatic onboarding and initialization for the Electron app
 * This module provides a simplified one-call initialization
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { OpenClawConfig } from "../../../../src/config/types";
import { readBustlyOAuthState } from "../../../../src/bustly-oauth.js";
import {
  ensureGatewayRuntimeInit,
  getGatewayRuntimeConfigPath,
  isGatewayRuntimeFullyInitialized,
} from "../../../../src/bustly/gateway-runtime-init.js";
import { resolveOpenClawCliPath } from "./cli-utils.js";
import {
  ELECTRON_OPENCLAW_PROFILE,
  resolveElectronIsolatedConfigPath,
  resolveElectronIsolatedStateDir,
} from "./defaults.js";
import { writeMainError, writeMainInfo } from "./logger.js";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
let lastInitializationLogSignature: string | null = null;

export interface PresetConfigOptions {
  gatewayPort?: number;
  gatewayBind?: "loopback" | "lan" | "auto";
  workspace?: string;
  nodeManager?: "npm" | "pnpm" | "bun";
}

function resolveOpenClawRootFromCliPath(cliPath: string): string {
  if (cliPath.endsWith("openclaw.mjs")) {
    return dirname(cliPath);
  }
  if (cliPath.endsWith("dist/cli.js")) {
    return resolve(dirname(cliPath), "..");
  }
  return dirname(cliPath);
}

function isBundledExtension(extensionId: string): boolean {
  const cliPath = resolveOpenClawCliPath();
  const candidates = new Set<string>();

  if (cliPath) {
    const root = resolveOpenClawRootFromCliPath(cliPath);
    candidates.add(resolve(root, "extensions", extensionId));
  }

  candidates.add(resolve(process.resourcesPath, "extensions", extensionId));
  candidates.add(resolve(__dirname, `../../../extensions/${extensionId}`));
  candidates.add(resolve(__dirname, `../../../../extensions/${extensionId}`));

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return true;
    }
  }
  return false;
}

async function ensureElectronDefaultConfig(configPath: string): Promise<OpenClawConfig> {
  const config = JSON.parse(readFileSync(configPath, "utf-8")) as OpenClawConfig;
  let nextConfig = config;

  const hasWeixinPlugin = isBundledExtension("openclaw-weixin");
  const hasFeishuPlugin = isBundledExtension("openclaw-lark");
  const pluginEntries = { ...(nextConfig.plugins?.entries ?? {}) } as Record<string, unknown>;
  const channels = { ...(nextConfig.channels ?? {}) } as Record<string, unknown>;
  let configMutated = false;

  if (hasWeixinPlugin) {
    const currentWeixinEntry =
      (pluginEntries["openclaw-weixin"] as { enabled?: boolean } | undefined) ?? {};
    if (currentWeixinEntry.enabled !== true) {
      pluginEntries["openclaw-weixin"] = { ...currentWeixinEntry, enabled: true };
      configMutated = true;
    }
  } else {
    if (Object.prototype.hasOwnProperty.call(pluginEntries, "openclaw-weixin")) {
      delete pluginEntries["openclaw-weixin"];
      configMutated = true;
    }
    if (Object.prototype.hasOwnProperty.call(channels, "openclaw-weixin")) {
      delete channels["openclaw-weixin"];
      configMutated = true;
    }
  }

  if (hasFeishuPlugin) {
    const currentLarkEntry =
      (pluginEntries["openclaw-lark"] as { enabled?: boolean } | undefined) ?? {};
    if (currentLarkEntry.enabled !== true) {
      pluginEntries["openclaw-lark"] = { ...currentLarkEntry, enabled: true };
      configMutated = true;
    }
    if (Object.prototype.hasOwnProperty.call(pluginEntries, "feishu")) {
      delete pluginEntries.feishu;
      configMutated = true;
    }
    const currentFeishuChannel =
      (channels.feishu as { enabled?: boolean } | undefined) ?? {};
    if (currentFeishuChannel.enabled !== true) {
      channels.feishu = { ...currentFeishuChannel, enabled: true };
      configMutated = true;
    }
  } else {
    if (Object.prototype.hasOwnProperty.call(pluginEntries, "openclaw-lark")) {
      delete pluginEntries["openclaw-lark"];
      configMutated = true;
    }
    if (Object.prototype.hasOwnProperty.call(pluginEntries, "feishu")) {
      delete pluginEntries.feishu;
      configMutated = true;
    }
    if (Object.prototype.hasOwnProperty.call(channels, "feishu")) {
      delete channels.feishu;
      configMutated = true;
    }
  }
  if (configMutated) {
    nextConfig = {
      ...nextConfig,
      channels,
      plugins: {
        ...(nextConfig.plugins ?? {}),
        entries: pluginEntries,
      },
    };
  }

  if (JSON.stringify(nextConfig) !== JSON.stringify(config)) {
    writeFileSync(configPath, JSON.stringify(nextConfig, null, 2));
  }

  return nextConfig;
}

function resolveConfigPathSafe(): string {
  try {
    return resolveElectronIsolatedConfigPath();
  } catch {
    return resolveElectronIsolatedConfigPath();
  }
}

export interface InitializationResult {
  success: boolean;
  configPath: string;
  gatewayPort: number;
  gatewayToken?: string;
  gatewayBind: string;
  workspace: string;
  error?: string;
}

export interface InitializationOptions extends PresetConfigOptions {
  force?: boolean;
  workspace?: string;
}

export async function initializeOpenClaw(
  options: InitializationOptions = {},
): Promise<InitializationResult> {
  try {
    const configPath = resolveConfigPathSafe();
    const workspaceId = readBustlyOAuthState()?.user?.workspaceId?.trim() ?? "";
    if (!workspaceId) {
      throw new Error("Missing Bustly workspaceId in OAuth state");
    }

    const runtimeEnv = {
      ...process.env,
      OPENCLAW_PROFILE: ELECTRON_OPENCLAW_PROFILE,
      OPENCLAW_PREFER_BUNDLED_PLUGINS: "1",
      OPENCLAW_STATE_DIR: resolveElectronIsolatedStateDir(),
      OPENCLAW_CONFIG_PATH: resolveElectronIsolatedConfigPath(),
    };
    writeMainInfo("Initializing Bustly gateway runtime...");
    const result = await ensureGatewayRuntimeInit({
      workspaceId,
      gatewayPort: options.gatewayPort,
      gatewayBind: options.gatewayBind,
      nodeManager: options.nodeManager,
      userAgent: "bustly-desktop",
      configPath,
      env: runtimeEnv,
    });
    const config = await ensureElectronDefaultConfig(configPath);

    return {
      success: true,
      configPath,
      gatewayPort: config.gateway?.port || result.gatewayPort || 17999,
      gatewayBind: config.gateway?.bind || result.gatewayBind || "loopback",
      gatewayToken: config.gateway?.auth?.token || result.gatewayToken,
      workspace: config.agents?.defaults?.workspace || result.workspace,
    };
  } catch (error) {
    writeMainError("Initialization failed:", error);
    return {
      success: false,
      configPath: "",
      gatewayPort: 17999,
      gatewayBind: "loopback",
      workspace: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function isFullyInitialized(): boolean {
  try {
    const configPath = resolveConfigPathSafe();
    if (!existsSync(configPath)) {
      const signature = `missing:${configPath}`;
      if (lastInitializationLogSignature !== signature) {
        lastInitializationLogSignature = signature;
        writeMainInfo(`[Init] Config file not found at ${configPath}`);
      }
      return false;
    }
    const initialized = isGatewayRuntimeFullyInitialized({
      configPath,
      env: {
        ...process.env,
        OPENCLAW_STATE_DIR: resolveElectronIsolatedStateDir(),
        OPENCLAW_CONFIG_PATH: resolveElectronIsolatedConfigPath(),
      },
    });
    const raw = readFileSync(configPath, "utf-8");
    const config = JSON.parse(raw) as {
      auth?: { profiles?: Record<string, unknown> };
      agents?: { defaults?: { model?: { primary?: string } | string } };
    };
    const hasProfiles =
      Boolean(config.auth?.profiles) && Object.keys(config.auth?.profiles ?? {}).length > 0;
    const model = config.agents?.defaults?.model;
    const primary = typeof model === "string" ? model : model?.primary;
    const hasPrimaryModel = typeof primary === "string" && primary.trim().length > 0;
    const signature = [
      configPath,
      initialized ? "ready" : "not-ready",
      hasProfiles ? "profiles" : "no-profiles",
      hasPrimaryModel ? `primary:${primary ?? ""}` : "no-primary",
    ].join("|");
    if (lastInitializationLogSignature !== signature) {
      lastInitializationLogSignature = signature;
      writeMainInfo(
        `[Init] config=${configPath} initialized=${initialized} hasProfiles=${hasProfiles} hasPrimaryModel=${hasPrimaryModel} primary=${primary ?? ""}`,
      );
    }
    return initialized;
  } catch {
    return false;
  }
}

export function getConfigPath(): string | null {
  try {
    return getGatewayRuntimeConfigPath({
      configPath: resolveConfigPathSafe(),
      env: {
        ...process.env,
        OPENCLAW_STATE_DIR: resolveElectronIsolatedStateDir(),
        OPENCLAW_CONFIG_PATH: resolveElectronIsolatedConfigPath(),
      },
    });
  } catch {
    return null;
  }
}
