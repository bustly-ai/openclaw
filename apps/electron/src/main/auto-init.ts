// @ts-nocheck
/**
 * Automatic onboarding and initialization for the Electron app
 * This module provides a simplified one-call initialization
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
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
import { resolveElectronRunAsNodeExecPath, resolveOpenClawCliPath } from "./cli-utils.js";
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
const BLOCKED_BUNDLED_SKILL_TOKENS = new Set(["skill-eval-ops"]);
const BUNDLED_DEFAULT_ENABLED_MANIFEST_NAME = ".bustly-default-enabled.json";
const DEFAULT_BUNDLED_SKILL_ALLOWLIST = [
  "ads-core-ops",
  "clawhub",
  "coding-agent",
  "commerce-core-ops",
  "discord",
  "gamma",
  "gog",
  "hubspot",
  "meta-ads",
  "minimax-docx",
  "minimax-pdf",
  "minimax-tts",
  "minimax-xlsx",
  "nano-banana-pro",
  "pptx-generator",
  "shipstation",
  "skill-creator",
  "slack",
  "source-product",
  "xurl",
  "zendesk",
];

function normalizeSkillAllowlistValue(input: string): string {
  return input.trim().toLowerCase().replace(/[\s_]+/g, "-");
}

function parseBundledDefaultAllowlist(raw: string): string[] {
  try {
    const payload = JSON.parse(raw) as { defaultEnabled?: unknown; allowBundled?: unknown };
    const candidates = Array.isArray(payload.defaultEnabled)
      ? payload.defaultEnabled
      : Array.isArray(payload.allowBundled)
        ? payload.allowBundled
        : [];
    const values = candidates
      .map((entry) => normalizeSkillAllowlistValue(String(entry)))
      .filter(Boolean);
    return [...new Set(values)];
  } catch {
    return [];
  }
}

function resolveBundledDefaultAllowlistFromManifest(
  env: NodeJS.ProcessEnv = process.env,
): string[] | undefined {
  const candidates = new Set<string>();
  const cliPath = resolveOpenClawCliPath();
  if (cliPath) {
    const root = resolveOpenClawRootFromCliPath(cliPath);
    candidates.add(resolve(root, "skills", BUNDLED_DEFAULT_ENABLED_MANIFEST_NAME));
    candidates.add(resolve(root, "bustly-skills", "skills", BUNDLED_DEFAULT_ENABLED_MANIFEST_NAME));
  }

  const resourcesPath = String((process as NodeJS.Process & { resourcesPath?: string }).resourcesPath || "").trim();
  if (resourcesPath) {
    candidates.add(resolve(resourcesPath, "skills", BUNDLED_DEFAULT_ENABLED_MANIFEST_NAME));
    candidates.add(resolve(resourcesPath, "bustly-skills", "skills", BUNDLED_DEFAULT_ENABLED_MANIFEST_NAME));
  }

  candidates.add(resolve(__dirname, `../../../skills/${BUNDLED_DEFAULT_ENABLED_MANIFEST_NAME}`));
  candidates.add(resolve(__dirname, `../../../../skills/${BUNDLED_DEFAULT_ENABLED_MANIFEST_NAME}`));
  candidates.add(resolve(__dirname, `../../../bustly-skills/skills/${BUNDLED_DEFAULT_ENABLED_MANIFEST_NAME}`));
  candidates.add(resolve(__dirname, `../../../../bustly-skills/skills/${BUNDLED_DEFAULT_ENABLED_MANIFEST_NAME}`));
  const envManifestPath = env.BUSTLY_DEFAULT_BUNDLED_SKILLS_MANIFEST?.trim();
  if (envManifestPath) {
    candidates.add(resolve(envManifestPath));
  }

  for (const manifestPath of candidates) {
    if (!existsSync(manifestPath)) {
      continue;
    }
    try {
      const values = parseBundledDefaultAllowlist(readFileSync(manifestPath, "utf-8"));
      if (values.length > 0) {
        writeMainInfo(
          `[Init] Loaded default bundled skill allowlist from manifest ${manifestPath} (${values.length} skills)`,
        );
        return values;
      }
    } catch (error) {
      writeMainError(`[Init] Failed to read bundled skill allowlist manifest ${manifestPath}`, error);
    }
  }
  return undefined;
}

function resolveDefaultBundledSkillAllowlist(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const raw = env.BUSTLY_DEFAULT_BUNDLED_SKILLS?.trim();
  const envValues =
    raw && raw.length > 0
      ? raw
          .split(/[,\n]/)
          .map((entry) => normalizeSkillAllowlistValue(entry))
          .filter(Boolean)
      : undefined;
  const manifestValues = resolveBundledDefaultAllowlistFromManifest(env);
  const values =
    envValues && envValues.length > 0
      ? envValues
      : manifestValues && manifestValues.length > 0
        ? manifestValues
        : DEFAULT_BUNDLED_SKILL_ALLOWLIST.map((entry) => normalizeSkillAllowlistValue(entry));
  return [...new Set(values)];
}

function normalizeConfiguredAllowBundled(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .map((entry) => String(entry).trim())
    .filter((entry) => entry.length > 0);
}

function listBundledSkillNames(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name.trim())
    .filter((name) => {
      if (!name || name.startsWith(".")) {
        return false;
      }
      if (BLOCKED_BUNDLED_SKILL_TOKENS.has(normalizeSkillAllowlistValue(name))) {
        return false;
      }
      const skillMd = resolve(dir, name, "SKILL.md");
      return existsSync(skillMd);
    })
    .sort((left, right) => left.localeCompare(right));
}

function resolveBundledSkillsDirCandidates(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const candidates = new Set<string>();
  const cliPath = resolveOpenClawCliPath();
  if (cliPath) {
    const root = resolveOpenClawRootFromCliPath(cliPath);
    candidates.add(resolve(root, "bustly-skills", "skills"));
    candidates.add(resolve(root, "skills"));
  }

  const resourcesPath = String((process as NodeJS.Process & { resourcesPath?: string }).resourcesPath || "").trim();
  if (resourcesPath) {
    candidates.add(resolve(resourcesPath, "bustly-skills", "skills"));
    candidates.add(resolve(resourcesPath, "skills"));
  }

  candidates.add(resolve(__dirname, "../../../bustly-skills/skills"));
  candidates.add(resolve(__dirname, "../../../../bustly-skills/skills"));
  candidates.add(resolve(__dirname, "../../../skills"));
  candidates.add(resolve(__dirname, "../../../../skills"));

  const explicitDir = env.OPENCLAW_BUNDLED_SKILLS_DIR?.trim();
  if (explicitDir) {
    candidates.add(resolve(explicitDir));
  }

  return [...candidates];
}

function resolveBundledSkillCatalog(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  for (const dir of resolveBundledSkillsDirCandidates(env)) {
    const names = listBundledSkillNames(dir);
    if (names.length > 0) {
      writeMainInfo(`[Init] Resolved bundled skills catalog from ${dir} (${names.length} skills)`);
      return names;
    }
  }
  return [];
}

function synchronizeBundledSkillSelection(
  config: OpenClawConfig,
  env: NodeJS.ProcessEnv = process.env,
): OpenClawConfig {
  const bundledSkills = resolveBundledSkillCatalog(env);
  if (bundledSkills.length === 0) {
    return config;
  }
  const defaultEnabled = new Set(
    resolveDefaultBundledSkillAllowlist(env).map((entry) => normalizeSkillAllowlistValue(entry)),
  );
  const skills = { ...(config.skills ?? {}) };
  const currentEntries = skills.entries ? { ...skills.entries } : {};
  let entriesChanged = false;

  for (const skillName of bundledSkills) {
    const existing = currentEntries[skillName];
    const next =
      existing && typeof existing === "object" ? { ...existing } : {};
    if (typeof (next as { enabled?: boolean }).enabled !== "boolean") {
      (next as { enabled?: boolean }).enabled = defaultEnabled.has(
        normalizeSkillAllowlistValue(skillName),
      );
      currentEntries[skillName] = next;
      entriesChanged = true;
    }
  }

  const nextAllowBundled = bundledSkills;
  const currentAllowBundled = normalizeConfiguredAllowBundled(skills.allowBundled);
  const allowBundledChanged = !hasSameNormalizedValues(
    currentAllowBundled,
    nextAllowBundled,
  );

  if (!entriesChanged && !allowBundledChanged) {
    return config;
  }

  return {
    ...config,
    skills: {
      ...skills,
      allowBundled: nextAllowBundled,
      entries: currentEntries,
    },
  };
}

function shouldApplyDefaultBundledSkillSelection(config: OpenClawConfig): boolean {
  const allowBundled = config.skills?.allowBundled;
  const hasAllowBundled = Boolean(Array.isArray(allowBundled) && allowBundled.length > 0);
  return !hasAllowBundled;
}

function hasSameNormalizedValues(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const leftSet = new Set(left.map((entry) => normalizeSkillAllowlistValue(entry)));
  const rightSet = new Set(right.map((entry) => normalizeSkillAllowlistValue(entry)));
  if (leftSet.size !== rightSet.size) {
    return false;
  }
  for (const value of leftSet) {
    if (!rightSet.has(value)) {
      return false;
    }
  }
  return true;
}

function shouldMigrateLegacyBundledSkillSelection(
  config: OpenClawConfig,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.BUSTLY_DEFAULT_BUNDLED_SKILLS?.trim()) {
    return false;
  }
  const current = config.skills?.allowBundled;
  if (!Array.isArray(current) || current.length === 0) {
    return false;
  }
  const legacyDefaults = DEFAULT_BUNDLED_SKILL_ALLOWLIST.map((entry) =>
    normalizeSkillAllowlistValue(entry),
  );
  if (!hasSameNormalizedValues(current, legacyDefaults)) {
    return false;
  }
  const manifestValues = resolveBundledDefaultAllowlistFromManifest(env);
  return Boolean(manifestValues && manifestValues.length > 0 && !hasSameNormalizedValues(current, manifestValues));
}

function applyDefaultBundledSkillSelection(config: OpenClawConfig): OpenClawConfig {
  const allowBundled = resolveDefaultBundledSkillAllowlist();
  if (allowBundled.length === 0) {
    return config;
  }
  return {
    ...config,
    skills: {
      ...(config.skills ?? {}),
      allowBundled,
    },
  };
}

function sanitizeBundledSkillAllowlist(config: OpenClawConfig): OpenClawConfig {
  const current = config.skills?.allowBundled;
  if (!Array.isArray(current) || current.length === 0) {
    return config;
  }
  const filtered = current
    .map((entry) => String(entry).trim())
    .filter(
      (entry) =>
        entry.length > 0 && !BLOCKED_BUNDLED_SKILL_TOKENS.has(normalizeSkillAllowlistValue(entry)),
    );
  if (filtered.length === current.length) {
    return config;
  }
  return {
    ...config,
    skills: {
      ...(config.skills ?? {}),
      allowBundled: [...new Set(filtered)],
    },
  };
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

  const beforeBundledSync = nextConfig;
  nextConfig = synchronizeBundledSkillSelection(nextConfig);
  if (nextConfig !== beforeBundledSync) {
    writeMainInfo(
      `[Init] Synchronized bundled skill visibility (${nextConfig.skills?.allowBundled?.length ?? 0} skills, defaults seeded)`,
    );
  }

  const sanitizedConfig = sanitizeBundledSkillAllowlist(nextConfig);
  if (sanitizedConfig !== nextConfig) {
    nextConfig = sanitizedConfig;
    writeMainInfo("[Init] Removed blocked internal skills from bundled skill allowlist");
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
    execFile(resolveElectronRunAsNodeExecPath(), [cliPath, ...args], { env }, (error) => {
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
