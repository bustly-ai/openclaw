import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { applyAgentConfig, listAgentEntries, pruneAgentConfig } from "../commands/agents.config.js";
import { type OpenClawConfig } from "../config/config.js";
import { resolveConfigPath, resolveStateDir } from "../config/paths.js";
import { loadSessionStore, updateSessionStore } from "../config/sessions.js";
import { resolveDefaultSessionStorePath } from "../config/sessions/paths.js";
import { normalizeAgentId } from "../routing/session-key.js";
import { initializeBustlyWorkspaceBootstrap } from "./workspace-bootstrap.js";
import {
  buildBustlyAgentConversationSessionKey,
  buildBustlyWorkspaceAgentId,
  buildBustlyWorkspaceAgentPrefix,
  DEFAULT_BUSTLY_AGENT_NAME,
  isBustlyAgentConversationSessionKey,
  normalizeBustlyAgentName,
  normalizeBustlyWorkspaceId,
} from "./workspace-agent.js";
import { resolveBustlyWorkspaceAgentWorkspaceDir } from "./workspace-runtime.js";

type OpenClawAgentListEntry = NonNullable<NonNullable<OpenClawConfig["agents"]>["list"]>[number];

type BustlyAgentMetadata = {
  icon?: string;
  createdAt?: number;
};

export type BustlyWorkspaceAgentSummary = {
  agentId: string;
  agentName: string;
  name: string;
  icon?: string;
  isMain: boolean;
  createdAt: number | null;
  updatedAt: number | null;
};

export type BustlyWorkspaceAgentSessionSummary = {
  agentId: string;
  sessionKey: string;
  name: string;
  icon?: string;
  updatedAt: number | null;
};

function resolveConfigPathForEnv(env: NodeJS.ProcessEnv): string {
  const stateDir = resolveStateDir(env);
  return resolveConfigPath(env, stateDir);
}

function readConfig(configPath: string): OpenClawConfig {
  if (!existsSync(configPath)) {
    return {};
  }
  const raw = readFileSync(configPath, "utf-8");
  return JSON.parse(raw) as OpenClawConfig;
}

function writeConfig(configPath: string, config: OpenClawConfig): void {
  mkdirSync(dirname(configPath), { recursive: true, mode: 0o700 });
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function ensureConfigExists(configPath: string): void {
  if (existsSync(configPath)) {
    return;
  }
  writeConfig(configPath, {});
}

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

function resolveBustlyWorkspaceAgentMetadataPath(agentWorkspaceDir: string): string {
  return join(agentWorkspaceDir, ".bustly-agent.json");
}

function loadBustlyAgentMetadata(agentWorkspaceDir: string): BustlyAgentMetadata {
  const metadataPath = resolveBustlyWorkspaceAgentMetadataPath(agentWorkspaceDir);
  if (!existsSync(metadataPath)) {
    return {};
  }
  try {
    const raw = readFileSync(metadataPath, "utf-8");
    const parsed = JSON.parse(raw) as BustlyAgentMetadata;
    return {
      icon: parsed.icon?.trim() || undefined,
      createdAt:
        typeof parsed.createdAt === "number" && Number.isFinite(parsed.createdAt)
          ? parsed.createdAt
          : undefined,
    };
  } catch {
    return {};
  }
}

function saveBustlyAgentMetadata(agentWorkspaceDir: string, metadata: BustlyAgentMetadata): void {
  mkdirSync(agentWorkspaceDir, { recursive: true, mode: 0o700 });
  writeFileSync(
    resolveBustlyWorkspaceAgentMetadataPath(agentWorkspaceDir),
    JSON.stringify(metadata, null, 2),
    "utf-8",
  );
}

function setBustlyAgentMetadata(params: {
  workspaceDir: string;
  icon?: string;
  createdAt?: number;
}): void {
  const nextIcon = params.icon?.trim();
  const nextCreatedAt =
    typeof params.createdAt === "number" && Number.isFinite(params.createdAt)
      ? params.createdAt
      : undefined;
  if (!nextIcon && nextCreatedAt === undefined) {
    return;
  }
  const current = loadBustlyAgentMetadata(params.workspaceDir);
  saveBustlyAgentMetadata(params.workspaceDir, {
    ...current,
    icon: nextIcon ?? current.icon,
    createdAt: nextCreatedAt ?? current.createdAt,
  });
}

function resolveBustlyAgentCreatedAt(
  agentWorkspaceDir: string,
  metadata: BustlyAgentMetadata,
): number | null {
  if (typeof metadata.createdAt === "number" && Number.isFinite(metadata.createdAt)) {
    return metadata.createdAt;
  }
  for (const candidatePath of [
    agentWorkspaceDir,
    resolveBustlyWorkspaceAgentMetadataPath(agentWorkspaceDir),
  ]) {
    if (!existsSync(candidatePath)) {
      continue;
    }
    try {
      const stats = statSync(candidatePath);
      const fallbackCreatedAt =
        Number.isFinite(stats.birthtimeMs) && stats.birthtimeMs > 0
          ? stats.birthtimeMs
          : Number.isFinite(stats.ctimeMs) && stats.ctimeMs > 0
            ? stats.ctimeMs
            : Number.isFinite(stats.mtimeMs) && stats.mtimeMs > 0
              ? stats.mtimeMs
              : 0;
      if (fallbackCreatedAt > 0) {
        return Math.floor(fallbackCreatedAt);
      }
    } catch {
      continue;
    }
  }
  return null;
}

function listBustlyWorkspaceAgentIds(cfg: OpenClawConfig, workspaceId: string): string[] {
  const normalizedWorkspaceId = normalizeBustlyWorkspaceId(workspaceId);
  if (!normalizedWorkspaceId) {
    return [];
  }
  const legacyMainAgentId = `bustly-${normalizedWorkspaceId}`;
  const prefix = buildBustlyWorkspaceAgentPrefix(normalizedWorkspaceId);
  return listAgentEntries(cfg)
    .filter((entry) => entry.id === legacyMainAgentId || entry.id.startsWith(prefix))
    .map((entry) => entry.id);
}

function listBustlyAgentConversationSessions(agentId: string): BustlyWorkspaceAgentSessionSummary[] {
  const store = loadSessionStore(resolveDefaultSessionStorePath(agentId));
  return Object.entries(store)
    .filter(([sessionKey]) => isBustlyAgentConversationSessionKey(sessionKey, agentId))
    .map(([sessionKey, entry]) => ({
      agentId,
      sessionKey,
      name: entry.label?.trim() || "New conversation",
      icon: entry.icon?.trim() || undefined,
      updatedAt: entry.updatedAt ?? null,
    }))
    .toSorted((left, right) => {
      const leftUpdatedAt = left.updatedAt ?? 0;
      const rightUpdatedAt = right.updatedAt ?? 0;
      if (leftUpdatedAt !== rightUpdatedAt) {
        return rightUpdatedAt - leftUpdatedAt;
      }
      return left.name.localeCompare(right.name);
    });
}

function resolveBustlyAgentNameFromWorkspaceAgentId(workspaceId: string, agentId: string): string {
  const normalizedWorkspaceId = normalizeBustlyWorkspaceId(workspaceId);
  const normalizedAgentId = normalizeAgentId(agentId);
  if (!normalizedWorkspaceId) {
    return normalizeBustlyAgentName(normalizedAgentId);
  }
  const legacyMainAgentId = `bustly-${normalizedWorkspaceId}`;
  if (normalizedAgentId === legacyMainAgentId) {
    return DEFAULT_BUSTLY_AGENT_NAME;
  }
  const prefix = buildBustlyWorkspaceAgentPrefix(normalizedWorkspaceId);
  if (!normalizedAgentId.startsWith(prefix)) {
    return normalizeBustlyAgentName(normalizedAgentId);
  }
  return normalizeBustlyAgentName(normalizedAgentId.slice(prefix.length));
}

function isPathWithinRoot(rootDir: string, targetPath: string): boolean {
  const root = resolve(rootDir);
  const target = resolve(targetPath);
  const rel = relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function removeDirIfWithinRoot(targetPath: string, rootDir: string): void {
  const trimmedTargetPath = targetPath.trim();
  if (!trimmedTargetPath) {
    return;
  }
  if (!existsSync(trimmedTargetPath)) {
    return;
  }
  if (!isPathWithinRoot(rootDir, trimmedTargetPath)) {
    return;
  }
  rmSync(trimmedTargetPath, { recursive: true, force: true });
}

export function listBustlyWorkspaceAgents(params: {
  workspaceId: string;
  configPath?: string;
  env?: NodeJS.ProcessEnv;
}): BustlyWorkspaceAgentSummary[] {
  const normalizedWorkspaceId = normalizeBustlyWorkspaceId(params.workspaceId);
  if (!normalizedWorkspaceId) {
    return [];
  }
  const configPath = params.configPath ?? resolveConfigPathForEnv(params.env ?? process.env);
  const cfg = readConfig(configPath);
  const prefix = buildBustlyWorkspaceAgentPrefix(normalizedWorkspaceId);
  const legacyMainAgentId = `bustly-${normalizedWorkspaceId}`;

  return listAgentEntries(cfg)
    .filter((entry) => entry.id === legacyMainAgentId || entry.id.startsWith(prefix))
    .map((entry) => {
      const agentId = entry.id;
      const agentName = resolveBustlyAgentNameFromWorkspaceAgentId(normalizedWorkspaceId, agentId);
      const workspaceDir =
        entry.workspace?.trim() ||
        resolveBustlyWorkspaceAgentWorkspaceDir(normalizedWorkspaceId, agentName, params.env);
      const metadata = loadBustlyAgentMetadata(workspaceDir);
      const sessions = listBustlyAgentConversationSessions(agentId);
      const displayName = entry.name?.trim() || agentName;
      const createdAt = resolveBustlyAgentCreatedAt(workspaceDir, metadata);
      return {
        agentId,
        agentName,
        name: displayName,
        icon: metadata.icon,
        isMain: agentName === DEFAULT_BUSTLY_AGENT_NAME,
        createdAt,
        updatedAt: sessions[0]?.updatedAt ?? metadata.createdAt ?? null,
      };
    })
    .toSorted((left, right) => {
      if (left.isMain && !right.isMain) {
        return -1;
      }
      if (right.isMain && !left.isMain) {
        return 1;
      }
      const leftCreatedAt = left.createdAt ?? 0;
      const rightCreatedAt = right.createdAt ?? 0;
      if (leftCreatedAt !== rightCreatedAt) {
        return rightCreatedAt - leftCreatedAt;
      }
      return left.name.localeCompare(right.name);
    });
}

export function listBustlyWorkspaceAgentSessions(params: {
  workspaceId: string;
  agentId: string;
}): BustlyWorkspaceAgentSessionSummary[] {
  const normalizedWorkspaceId = normalizeBustlyWorkspaceId(params.workspaceId);
  if (!normalizedWorkspaceId) {
    return [];
  }
  const agentId = params.agentId.trim();
  const prefix = buildBustlyWorkspaceAgentPrefix(normalizedWorkspaceId);
  const legacyMainAgentId = `bustly-${normalizedWorkspaceId}`;
  if (!agentId.startsWith(prefix) && agentId !== legacyMainAgentId) {
    return [];
  }
  return listBustlyAgentConversationSessions(agentId);
}

export async function createBustlyWorkspaceAgent(params: {
  workspaceId: string;
  workspaceName?: string;
  agentName: string;
  displayName?: string;
  icon?: string;
  configPath?: string;
  allowCreateConfig?: boolean;
  env?: NodeJS.ProcessEnv;
}): Promise<{ agentId: string; workspaceDir: string }> {
  const workspaceId = params.workspaceId.trim();
  if (!workspaceId) {
    throw new Error("Bustly workspaceId is required.");
  }
  const configPath = params.configPath ?? resolveConfigPathForEnv(params.env ?? process.env);
  if (!existsSync(configPath)) {
    if (!params.allowCreateConfig) {
      throw new Error(`OpenClaw config not found at ${configPath}`);
    }
    ensureConfigExists(configPath);
  }
  const agentName = normalizeBustlyAgentName(params.agentName);
  const displayName = params.displayName?.trim() || agentName;
  const icon = params.icon?.trim() || "SquaresFour";
  const workspaceDir = resolveBustlyWorkspaceAgentWorkspaceDir(workspaceId, agentName, params.env);
  const agentId = buildBustlyWorkspaceAgentId(workspaceId, agentName);
  const config = readConfig(configPath);

  if (listAgentEntries(config).some((entry) => entry.id === agentId)) {
    throw new Error(`Agent "${agentName}" already exists in this workspace.`);
  }

  const configWithoutMain =
    listAgentEntries(config).some((entry) => entry.id === "main")
      ? pruneAgentConfig(config, "main").config
      : config;
  const updated = applyAgentConfig(configWithoutMain, {
    agentId,
    name: displayName,
    workspace: workspaceDir,
  });
  const nextConfig: OpenClawConfig = {
    ...updated,
    agents: {
      ...updated.agents,
      defaults: {
        ...updated.agents?.defaults,
        skipBootstrap: true,
      },
      list: stripPerAgentSkipBootstrap(updated.agents?.list),
    },
  };

  if (JSON.stringify(nextConfig) !== JSON.stringify(config)) {
    writeConfig(configPath, nextConfig);
  }

  await initializeBustlyWorkspaceBootstrap({
    workspaceDir,
    workspaceId,
    workspaceName: params.workspaceName,
    agentName,
  });
  setBustlyAgentMetadata({
    workspaceDir,
    icon,
    createdAt: Date.now(),
  });
  return { agentId, workspaceDir };
}

export async function createBustlyWorkspaceAgentSession(params: {
  workspaceId: string;
  agentId: string;
  label?: string;
}): Promise<BustlyWorkspaceAgentSessionSummary & { sessionId: string }> {
  const workspaceId = params.workspaceId.trim();
  const normalizedWorkspaceId = normalizeBustlyWorkspaceId(workspaceId);
  const agentId = params.agentId.trim();
  const agentPrefix = buildBustlyWorkspaceAgentPrefix(normalizedWorkspaceId);
  const legacyMainAgentId = `bustly-${normalizedWorkspaceId}`;
  if (!normalizedWorkspaceId || (!agentId.startsWith(agentPrefix) && agentId !== legacyMainAgentId)) {
    throw new Error("Agent does not belong to this workspace.");
  }

  const sessionKey = buildBustlyAgentConversationSessionKey(agentId, randomUUID());
  const storePath = resolveDefaultSessionStorePath(agentId);
  const label = params.label?.trim() || "New conversation";
  const sessionId = randomUUID();
  const updatedAt = Date.now();
  await updateSessionStore(storePath, (store) => {
    store[sessionKey] = {
      sessionId,
      updatedAt,
      label,
    };
    return store;
  });
  return {
    agentId,
    sessionKey,
    sessionId,
    name: label,
    updatedAt,
  };
}

export async function updateBustlyWorkspaceAgent(params: {
  workspaceId: string;
  agentId: string;
  displayName?: string;
  icon?: string;
  configPath?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<void> {
  const configPath = params.configPath ?? resolveConfigPathForEnv(params.env ?? process.env);
  if (!existsSync(configPath)) {
    throw new Error(`OpenClaw config not found at ${configPath}`);
  }
  const config = readConfig(configPath);
  const entry = listAgentEntries(config).find((candidate) => candidate.id === params.agentId);
  if (!entry) {
    throw new Error(`Agent "${params.agentId}" not found.`);
  }

  const nextName = params.displayName?.trim();
  const nextIcon = params.icon?.trim();
  let nextConfig = config;
  if (nextName) {
    nextConfig = applyAgentConfig(nextConfig, {
      agentId: params.agentId,
      name: nextName,
    });
  }
  if (JSON.stringify(nextConfig) !== JSON.stringify(config)) {
    writeConfig(configPath, nextConfig);
  }

  if (nextIcon) {
    const agentName = resolveBustlyAgentNameFromWorkspaceAgentId(params.workspaceId, params.agentId);
    setBustlyAgentMetadata({
      workspaceDir:
        entry.workspace?.trim() ||
        resolveBustlyWorkspaceAgentWorkspaceDir(params.workspaceId, agentName, params.env),
      icon: nextIcon,
    });
  }
}

export async function deleteBustlyWorkspaceAgent(params: {
  workspaceId: string;
  agentId: string;
  configPath?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<void> {
  const normalizedWorkspaceId = normalizeBustlyWorkspaceId(params.workspaceId);
  const normalizedAgentId = normalizeAgentId(params.agentId);
  const mainAgentId = buildBustlyWorkspaceAgentId(normalizedWorkspaceId);
  const legacyMainAgentId = `bustly-${normalizedWorkspaceId}`;
  if (normalizedAgentId === mainAgentId || normalizedAgentId === legacyMainAgentId) {
    throw new Error("The main workspace agent cannot be deleted.");
  }

  const configPath = params.configPath ?? resolveConfigPathForEnv(params.env ?? process.env);
  if (!existsSync(configPath)) {
    throw new Error(`OpenClaw config not found at ${configPath}`);
  }
  const config = readConfig(configPath);
  const entry = listAgentEntries(config).find(
    (candidate) => normalizeAgentId(candidate.id) === normalizedAgentId,
  );
  if (!entry) {
    throw new Error(`Agent "${params.agentId}" not found.`);
  }

  const agentName = resolveBustlyAgentNameFromWorkspaceAgentId(normalizedWorkspaceId, entry.id);
  const workspaceDir =
    entry.workspace?.trim() ||
    resolveBustlyWorkspaceAgentWorkspaceDir(normalizedWorkspaceId, agentName, params.env);
  const stateDir = resolveStateDir(params.env);
  const workspaceAgentsRoot = join(stateDir, "workspaces", normalizedWorkspaceId, "agents");
  const agentStateDir = join(stateDir, "agents", normalizedAgentId);

  const result = pruneAgentConfig(config, entry.id);
  if (JSON.stringify(result.config) !== JSON.stringify(config)) {
    writeConfig(configPath, result.config);
  }

  removeDirIfWithinRoot(workspaceDir, workspaceAgentsRoot);
  removeDirIfWithinRoot(agentStateDir, join(stateDir, "agents"));
}

export async function ensureBustlyWorkspacePresetAgents(params: {
  workspaceId: string;
  workspaceName?: string;
  presets: Array<{ slug: string; label: string; icon?: string; isMain?: boolean }>;
  configPath?: string;
  allowCreateConfig?: boolean;
  env?: NodeJS.ProcessEnv;
}): Promise<void> {
  const normalizedWorkspaceId = normalizeBustlyWorkspaceId(params.workspaceId);
  if (!normalizedWorkspaceId) {
    return;
  }
  const configPath = params.configPath ?? resolveConfigPathForEnv(params.env ?? process.env);
  if (!existsSync(configPath)) {
    if (!params.allowCreateConfig) {
      return;
    }
    ensureConfigExists(configPath);
  }
  const cfg = readConfig(configPath);
  const workspaceAgentIds = new Set(listBustlyWorkspaceAgentIds(cfg, normalizedWorkspaceId));
  for (const preset of params.presets) {
    if (preset.slug === DEFAULT_BUSTLY_AGENT_NAME || preset.isMain) {
      continue;
    }
    const agentId = buildBustlyWorkspaceAgentId(normalizedWorkspaceId, preset.slug);
    if (!workspaceAgentIds.has(agentId)) {
      await createBustlyWorkspaceAgent({
        workspaceId: normalizedWorkspaceId,
        workspaceName: params.workspaceName,
        agentName: preset.slug,
        displayName: preset.label,
        icon: preset.icon,
        configPath,
        allowCreateConfig: params.allowCreateConfig,
        env: params.env,
      });
      workspaceAgentIds.add(agentId);
      continue;
    }
    const workspaceDir = resolveBustlyWorkspaceAgentWorkspaceDir(
      normalizedWorkspaceId,
      preset.slug,
      params.env,
    );
    setBustlyAgentMetadata({
      workspaceDir,
      icon: preset.icon,
    });
  }
}
