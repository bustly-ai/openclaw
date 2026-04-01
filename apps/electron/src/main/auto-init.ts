// @ts-nocheck
/**
 * Automatic onboarding and initialization for the Electron app
 * This module provides a simplified one-call initialization
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFile, execFileSync } from "node:child_process";
import type { PresetConfigOptions } from "../config/default-config.js";
import type { OpenClawConfig } from "../../../../src/config/types";
import { ensureOpenClawAgentEnv, resolveOpenClawAgentDir } from "../../../../src/agents/agent-paths";
import { ensureOpenClawModelsJson } from "../../../../src/agents/models-config";
import { ensurePiAuthJsonFromAuthProfiles } from "../../../../src/agents/pi-auth-json";
import { resolveConfigPath as resolveConfigPathFromSrc } from "../../../../src/config/paths";
import {
  applyAuthProfileConfig,
  applyOpenrouterProviderConfig,
  setOpenrouterApiKey,
} from "../../../../src/commands/onboard-auth";
import { applyPrimaryModel } from "../../../../src/commands/model-picker";
import { resolveOpenClawCliPath } from "./cli-utils.js";
import {
  ELECTRON_DEFAULT_MODEL,
  ELECTRON_OPENCLAW_PROFILE,
  getElectronOpenrouterApiKey,
  resolveElectronIsolatedConfigPath,
  resolveElectronIsolatedStateDir,
} from "./defaults.js";
import { writeMainError, writeMainInfo } from "./logger.js";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
let lastInitializationLogSignature: string | null = null;

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
  const openrouterApiKey = getElectronOpenrouterApiKey();
  const config = JSON.parse(readFileSync(configPath, "utf-8")) as OpenClawConfig;
  const currentModel = config.agents?.defaults?.model;
  const primaryModel = typeof currentModel === "string" ? currentModel : currentModel?.primary;
  let nextConfig = config;

  if (openrouterApiKey) {
    await setOpenrouterApiKey(openrouterApiKey, resolveOpenClawAgentDir());
    nextConfig = applyOpenrouterProviderConfig(nextConfig);
    nextConfig = applyAuthProfileConfig(nextConfig, {
      profileId: "openrouter:default",
      provider: "openrouter",
      mode: "api_key",
    });
    if (!primaryModel?.trim() || primaryModel !== ELECTRON_DEFAULT_MODEL) {
      nextConfig = applyPrimaryModel(nextConfig, ELECTRON_DEFAULT_MODEL);
    }
  }

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

  const currentDmScope = nextConfig.session?.dmScope;
  if (!currentDmScope || currentDmScope === "main") {
    nextConfig = {
      ...nextConfig,
      session: {
        ...(nextConfig.session ?? {}),
        dmScope: "per-account-channel-peer",
      },
    };
  }

  if (JSON.stringify(nextConfig) !== JSON.stringify(config)) {
    writeFileSync(configPath, JSON.stringify(nextConfig, null, 2));
  }

  return nextConfig;
}

async function ensureElectronAgentModelFiles(config: OpenClawConfig): Promise<void> {
  ensureOpenClawAgentEnv();
  const agentDir = resolveOpenClawAgentDir();
  await ensureOpenClawModelsJson(config, agentDir);
  await ensurePiAuthJsonFromAuthProfiles(agentDir);
}

function loadLoginShellEnvironment(): Record<string, string> {
  try {
    const shellPath = process.env.SHELL?.trim() || "/bin/zsh";
    const result = execFileSync(shellPath, ["-lc", "env -0"], {
      encoding: "buffer",
      env: {
        ...process.env,
        HOME: homedir(),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const out = result.toString("utf8");
    const env: Record<string, string> = {};
    for (const entry of out.split("\0")) {
      if (!entry) {
        continue;
      }
      const eq = entry.indexOf("=");
      if (eq <= 0) {
        continue;
      }
      const key = entry.slice(0, eq);
      const value = entry.slice(eq + 1);
      if (!key) {
        continue;
      }
      env[key] = value;
    }
    return env;
  } catch {
    return {};
  }
}

function resolveConfigPathSafe(): string {
  try {
    return resolveElectronIsolatedConfigPath();
  } catch {
    return resolveElectronIsolatedConfigPath();
  }
}

function resolveDefaultWorkspaceDir(explicit?: string): string {
  if (explicit?.trim()) {
    return explicit.trim();
  }
  return join(resolveElectronIsolatedStateDir(), "workspace");
}

async function runCliOnboard(options: InitializationOptions): Promise<void> {
  const cliPath = resolveOpenClawCliPath();
  if (!cliPath) {
    throw new Error("OpenClaw CLI not found. Ensure openclaw.mjs is bundled.");
  }

  const args: string[] = [
    "onboard",
    "--non-interactive",
    "--accept-risk",
    "--skip-channels",
    "--skip-skills",
    "--skip-health",
    "--skip-ui",
    "--json",
  ];

  const workspace = resolveDefaultWorkspaceDir(options.workspace);
  args.push("--workspace", workspace);
  if (options.gatewayPort) {
    args.push("--gateway-port", String(options.gatewayPort));
  }
  if (options.gatewayBind) {
    args.push("--gateway-bind", options.gatewayBind);
  }
  if (options.nodeManager) {
    args.push("--node-manager", options.nodeManager);
  }

  if (options.openrouterApiKey) {
    args.push("--auth-choice", "openrouter-api-key", "--openrouter-api-key", options.openrouterApiKey);
  } else {
    args.push("--auth-choice", "skip");
  }

  const loginShellEnv = loadLoginShellEnvironment();
  const env = {
    ...process.env,
    ...loginShellEnv,
    ELECTRON_RUN_AS_NODE: "1",
    OPENCLAW_LOAD_SHELL_ENV: "1",
    OPENCLAW_PROFILE: ELECTRON_OPENCLAW_PROFILE,
    OPENCLAW_PREFER_BUNDLED_PLUGINS: "1",
    OPENCLAW_STATE_DIR: resolveElectronIsolatedStateDir(),
    OPENCLAW_CONFIG_PATH: resolveElectronIsolatedConfigPath(),
  };

  await new Promise<void>((resolvePromise, rejectPromise) => {
    execFile(process.execPath, [cliPath, ...args], { env }, (error) => {
      if (error) {
        rejectPromise(error);
        return;
      }
      resolvePromise();
    });
  });
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
  openrouterApiKey?: string;
}

export async function initializeOpenClaw(
  options: InitializationOptions = {},
): Promise<InitializationResult> {
  try {
    const { force = false, ...configOptions } = options;
    const configPath = resolveConfigPathSafe();

    if (!force && existsSync(configPath)) {
      writeMainInfo("Configuration already exists, skipping initialization");
    } else {
      writeMainInfo("Initializing OpenClaw via CLI onboarding...");
      await runCliOnboard(configOptions);
      if (!existsSync(configPath)) {
        throw new Error("OpenClaw CLI did not create config file");
      }
    }

    const config = await ensureElectronDefaultConfig(configPath);
    await ensureElectronAgentModelFiles(config);
    const workspaceDir =
      config.agents?.defaults?.workspace || resolveDefaultWorkspaceDir(options.workspace);
    const resolvedWorkspace = workspaceDir.startsWith("~")
      ? join(homedir(), workspaceDir.slice(1))
      : workspaceDir;

    return {
      success: true,
      configPath,
      gatewayPort: config.gateway?.port || 17999,
      gatewayBind: config.gateway?.bind || "loopback",
      gatewayToken: config.gateway?.auth?.token,
      workspace: resolvedWorkspace,
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

export function isInitialized(): boolean {
  try {
    const configPath = resolveConfigPathSafe();
    return existsSync(configPath);
  } catch {
    return false;
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
    const initialized = hasProfiles && hasPrimaryModel;
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
    return resolveConfigPathSafe();
  } catch {
    return null;
  }
}
