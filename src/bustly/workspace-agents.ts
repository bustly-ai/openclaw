import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import {
  loadBustlyAgentMetadata,
  resolveBustlyAgentMetadataPath,
  saveBustlyAgentMetadata,
  type BustlyAgentMetadata,
} from "../agents/bustly-agent-metadata.js";
import {
  extractIdentityMission,
  upsertIdentityField,
  upsertIdentityMission,
} from "../agents/identity-file.js";
import { DEFAULT_IDENTITY_FILENAME } from "../agents/workspace.js";
import { applyAgentConfig, listAgentEntries, pruneAgentConfig } from "../commands/agents.config.js";
import { type OpenClawConfig } from "../config/config.js";
import { resolveConfigPath, resolveStateDir } from "../config/paths.js";
import { loadSessionStore, updateSessionStore } from "../config/sessions.js";
import { resolveDefaultSessionStorePath } from "../config/sessions/paths.js";
import { normalizeAgentId } from "../routing/session-key.js";
import {
  buildBustlyAgentConversationSessionKey,
  buildBustlyWorkspaceAgentId,
  buildBustlyWorkspaceAgentPrefix,
  DEFAULT_BUSTLY_AGENT_NAME,
  isBustlyAgentConversationSessionKey,
  isBustlyAgentScheduledSessionKey,
  normalizeBustlyAgentName,
  normalizeBustlyWorkspaceId,
} from "./workspace-agent.js";
import {
  initializeBustlyWorkspaceBootstrap,
  loadEnabledBustlyWorkspaceBootstrapAgents,
} from "./workspace-bootstrap.js";
import { DEFAULT_BUSTLY_HEARTBEAT_EVERY } from "./heartbeats.js";
import { resolveBustlyWorkspaceAgentWorkspaceDir } from "./workspace-runtime.js";

type OpenClawAgentListEntry = NonNullable<NonNullable<OpenClawConfig["agents"]>["list"]>[number];
const DEFAULT_PRESET_HEARTBEAT: NonNullable<OpenClawAgentListEntry["heartbeat"]> = {
  every: DEFAULT_BUSTLY_HEARTBEAT_EVERY,
  target: "none",
};
// Preset workspace agents created before this timestamp will be force-refreshed
// so prompt/template updates can overwrite legacy bootstrap files once.
export const BUSTLY_PRESET_AGENT_FORCE_REFRESH_BEFORE = Date.UTC(2026, 4, 17, 0, 0, 0, 0);

export type BustlyWorkspaceAgentSummary = {
  agentId: string;
  agentName: string;
  name: string;
  description?: string;
  identityMarkdown?: string;
  icon?: string;
  skills?: string[];
  isMain: boolean;
  createdAt: number | null;
  updatedAt: number | null;
};

export type BustlyWorkspaceAgentSessionSummary = {
  agentId: string;
  sessionKey: string;
  kind: "conversation" | "scheduled";
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

function setBustlyAgentMetadata(params: {
  workspaceDir: string;
  icon?: string;
  createdAt?: number;
  skills?: string[] | null;
}): void {
  const nextIcon = params.icon?.trim();
  const nextCreatedAt =
    typeof params.createdAt === "number" && Number.isFinite(params.createdAt)
      ? params.createdAt
      : undefined;
  if (!nextIcon && nextCreatedAt === undefined && params.skills === undefined) {
    return;
  }
  const current = loadBustlyAgentMetadata(params.workspaceDir);
  const nextMetadata: BustlyAgentMetadata = {
    ...current,
    icon: nextIcon ?? current.icon,
    createdAt: nextCreatedAt ?? current.createdAt,
  };
  if (params.skills !== undefined) {
    if (params.skills === null) {
      delete nextMetadata.skills;
    } else {
      nextMetadata.skills = params.skills;
    }
  }
  saveBustlyAgentMetadata(params.workspaceDir, nextMetadata);
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
    resolveBustlyAgentMetadataPath(agentWorkspaceDir),
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

function sanitizeBustlyIdentityLine(value: string): string {
  return value
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveBustlyAgentIdentityPath(workspaceDir: string): string {
  return join(workspaceDir, DEFAULT_IDENTITY_FILENAME);
}

function buildDefaultBustlyIdentityMarkdown(params: {
  name?: string;
  description?: string;
}): string {
  const safeName = sanitizeBustlyIdentityLine(params.name?.trim() || "Agent");
  const safeDescription = params.description?.trim() || "How can I help you today?";
  return [
    "# IDENTITY.md - Agent Identity",
    "",
    `- Name: ${safeName}`,
    "- Role: Commerce Operating Agent",
    "",
    "## Mission",
    "",
    safeDescription,
    "",
  ].join("\n");
}

function normalizeBustlyIdentityMarkdownContent(content: string): string {
  const normalized = content.replace(/\r\n/g, "\n").trimEnd();
  return normalized ? `${normalized}\n` : "";
}

function loadBustlyAgentIdentityContent(workspaceDir: string): string | undefined {
  try {
    const content = readFileSync(resolveBustlyAgentIdentityPath(workspaceDir), "utf-8");
    return normalizeBustlyIdentityMarkdownContent(content);
  } catch {
    return undefined;
  }
}

function loadBustlyAgentDescription(workspaceDir: string): string | undefined {
  try {
    const mission = extractIdentityMission(
      readFileSync(resolveBustlyAgentIdentityPath(workspaceDir), "utf-8"),
    );
    const trimmed = mission?.trim();
    return trimmed ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

function syncBustlyAgentIdentityFields(params: {
  workspaceDir: string;
  name?: string;
  description?: string;
}): void {
  const nextName = params.name?.trim();
  const nextDescription = params.description?.trim();
  if (!nextName && !nextDescription) {
    return;
  }

  const identityPath = resolveBustlyAgentIdentityPath(params.workspaceDir);
  let content: string;
  try {
    content = readFileSync(identityPath, "utf-8");
  } catch {
    content = buildDefaultBustlyIdentityMarkdown({
      name: nextName,
      description: nextDescription,
    });
  }

  if (nextName) {
    content = upsertIdentityField(content, "Name", sanitizeBustlyIdentityLine(nextName));
  }
  if (nextDescription) {
    content = upsertIdentityMission(content, nextDescription);
  }
  mkdirSync(params.workspaceDir, { recursive: true, mode: 0o700 });
  writeFileSync(identityPath, content, "utf-8");
}

function writeBustlyAgentIdentityContent(params: {
  workspaceDir: string;
  content: string;
  name?: string;
}): void {
  let nextContent = normalizeBustlyIdentityMarkdownContent(params.content);
  const safeName = params.name?.trim();
  if (!nextContent && safeName) {
    nextContent = buildDefaultBustlyIdentityMarkdown({ name: safeName });
  }
  if (safeName) {
    nextContent = upsertIdentityField(
      nextContent || buildDefaultBustlyIdentityMarkdown({ name: safeName }),
      "Name",
      sanitizeBustlyIdentityLine(safeName),
    );
  }
  mkdirSync(params.workspaceDir, { recursive: true, mode: 0o700 });
  writeFileSync(resolveBustlyAgentIdentityPath(params.workspaceDir), nextContent, "utf-8");
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

function listBustlyAgentVisibleSessions(agentId: string): BustlyWorkspaceAgentSessionSummary[] {
  const store = loadSessionStore(resolveDefaultSessionStorePath(agentId));
  return Object.entries(store)
    .filter(
      ([sessionKey]) =>
        isBustlyAgentConversationSessionKey(sessionKey, agentId) ||
        isBustlyAgentScheduledSessionKey(sessionKey, agentId),
    )
    .map(([sessionKey, entry]) => ({
      agentId,
      sessionKey,
      kind: isBustlyAgentScheduledSessionKey(sessionKey, agentId) ? "scheduled" : "conversation",
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
      const sessions = listBustlyAgentVisibleSessions(agentId);
      const displayName = entry.name?.trim() || agentName;
      const identityMarkdown = loadBustlyAgentIdentityContent(workspaceDir);
      const description = loadBustlyAgentDescription(workspaceDir);
      const createdAt = resolveBustlyAgentCreatedAt(workspaceDir, metadata);
      return {
        agentId,
        agentName,
        name: displayName,
        description,
        identityMarkdown,
        icon: metadata.icon,
        skills:
          metadata.skills ??
          (Array.isArray(entry.skills)
            ? entry.skills
                .map((skill) => skill.trim())
                .filter(Boolean)
                .toSorted()
            : undefined),
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
  return listBustlyAgentVisibleSessions(agentId);
}

export async function createBustlyWorkspaceAgent(params: {
  workspaceId: string;
  workspaceName?: string;
  agentName: string;
  displayName?: string;
  description?: string;
  icon?: string;
  heartbeat?: OpenClawAgentListEntry["heartbeat"];
  skills?: string[] | null;
  bootstrapMetadata?: BustlyAgentMetadata;
  requireBootstrapMetadata?: boolean;
  skipBootstrap?: boolean;
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
  const explicitIcon = params.icon?.trim() || undefined;
  const icon = explicitIcon ?? (!params.skipBootstrap ? "SquaresFour" : undefined);
  const workspaceDir = resolveBustlyWorkspaceAgentWorkspaceDir(workspaceId, agentName, params.env);
  const agentId = buildBustlyWorkspaceAgentId(workspaceId, agentName);
  const config = readConfig(configPath);

  if (listAgentEntries(config).some((entry) => entry.id === agentId)) {
    throw new Error(`Agent "${agentName}" already exists in this workspace.`);
  }

  const configWithoutMain = listAgentEntries(config).some((entry) => entry.id === "main")
    ? pruneAgentConfig(config, "main").config
    : config;
  const updated = applyAgentConfig(configWithoutMain, {
    agentId,
    name: displayName,
    workspace: workspaceDir,
  });
  const nextList = stripPerAgentSkipBootstrap(updated.agents?.list)?.map((entry) => {
    if (normalizeAgentId(entry.id) !== normalizeAgentId(agentId)) {
      return entry;
    }
    if (params.heartbeat === undefined) {
      return entry;
    }
    return {
      ...entry,
      heartbeat: { ...params.heartbeat },
    };
  });
  const nextConfig: OpenClawConfig = {
    ...updated,
    agents: {
      ...updated.agents,
      defaults: {
        ...updated.agents?.defaults,
        skipBootstrap: true,
      },
      list: nextList,
    },
  };

  if (JSON.stringify(nextConfig) !== JSON.stringify(config)) {
    writeConfig(configPath, nextConfig);
  }

  if (!params.skipBootstrap) {
    await initializeBustlyWorkspaceBootstrap({
      workspaceDir,
      workspaceId,
      workspaceName: params.workspaceName,
      agentName,
      metadata: params.bootstrapMetadata,
      requireAgentMetadata: params.requireBootstrapMetadata,
    });
  }
  if (!params.skipBootstrap) {
    syncBustlyAgentIdentityFields({
      workspaceDir,
      name: displayName,
      description: params.description,
    });
  }
  if (!params.skipBootstrap || icon || params.skills !== undefined) {
    setBustlyAgentMetadata({
      workspaceDir,
      ...(icon ? { icon } : {}),
      ...(!params.skipBootstrap ? { createdAt: Date.now() } : {}),
      ...(params.skills !== undefined ? { skills: params.skills } : {}),
    });
  }
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
  if (
    !normalizedWorkspaceId ||
    (!agentId.startsWith(agentPrefix) && agentId !== legacyMainAgentId)
  ) {
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
    kind: "conversation",
    sessionId,
    name: label,
    updatedAt,
  };
}

export async function updateBustlyWorkspaceAgent(params: {
  workspaceId: string;
  agentId: string;
  displayName?: string;
  identityMarkdown?: string;
  icon?: string;
  skills?: string[] | null;
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
  const nextIdentityMarkdown =
    typeof params.identityMarkdown === "string" ? params.identityMarkdown : undefined;
  const nextIcon = params.icon?.trim();
  let nextConfig = config;
  if (nextName) {
    nextConfig = applyAgentConfig(nextConfig, {
      agentId: params.agentId,
      name: nextName,
    });
  }
  if (params.skills !== undefined) {
    nextConfig = applyAgentConfig(nextConfig, {
      agentId: params.agentId,
      skills: null,
    });
  }
  if (JSON.stringify(nextConfig) !== JSON.stringify(config)) {
    writeConfig(configPath, nextConfig);
  }

  const agentName = resolveBustlyAgentNameFromWorkspaceAgentId(params.workspaceId, params.agentId);
  const workspaceDir =
    entry.workspace?.trim() ||
    resolveBustlyWorkspaceAgentWorkspaceDir(params.workspaceId, agentName, params.env);
  if (nextIdentityMarkdown !== undefined) {
    writeBustlyAgentIdentityContent({
      workspaceDir,
      content: nextIdentityMarkdown,
      name: nextName ?? entry.name?.trim(),
    });
  } else if (nextName) {
    syncBustlyAgentIdentityFields({
      workspaceDir,
      name: nextName,
    });
  }
  if (nextIcon || params.skills !== undefined) {
    setBustlyAgentMetadata({
      workspaceDir,
      ...(nextIcon ? { icon: nextIcon } : {}),
      ...(params.skills !== undefined ? { skills: params.skills } : {}),
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
  presets?: Array<{
    slug: string;
    label: string;
    icon?: string;
    isMain?: boolean;
    bootstrapMetadata?: BustlyAgentMetadata;
  }>;
  configPath?: string;
  allowCreateConfig?: boolean;
  env?: NodeJS.ProcessEnv;
}): Promise<number> {
  const normalizedWorkspaceId = normalizeBustlyWorkspaceId(params.workspaceId);
  if (!normalizedWorkspaceId) {
    return 0;
  }
  const configPath = params.configPath ?? resolveConfigPathForEnv(params.env ?? process.env);
  if (!existsSync(configPath)) {
    if (!params.allowCreateConfig) {
      return 0;
    }
    ensureConfigExists(configPath);
  }
  const cfg = readConfig(configPath);
  const existingWorkspaceAgentIds = new Set(
    listBustlyWorkspaceAgentIds(cfg, normalizedWorkspaceId),
  );
  const entryById = new Map(
    listAgentEntries(cfg)
      .filter((entry) => existingWorkspaceAgentIds.has(entry.id))
      .map((entry) => [entry.id, entry] as const),
  );
  const workspaceAgentIds = new Set(existingWorkspaceAgentIds);
  const presets =
    params.presets ?? (await loadEnabledBustlyWorkspaceBootstrapAgents({ env: params.env }));
  let bootstrappedCount = 0;
  for (const preset of presets) {
    if (preset.slug === DEFAULT_BUSTLY_AGENT_NAME || preset.isMain) {
      continue;
    }
    const agentId = buildBustlyWorkspaceAgentId(normalizedWorkspaceId, preset.slug);
    const existingEntry = entryById.get(agentId);
    const workspaceDir =
      existingEntry?.workspace?.trim() ||
      resolveBustlyWorkspaceAgentWorkspaceDir(normalizedWorkspaceId, preset.slug, params.env);
    const workspaceExists = existsSync(workspaceDir);
    const workspaceMetadata = workspaceExists ? loadBustlyAgentMetadata(workspaceDir) : {};
    const workspaceCreatedAt = workspaceExists
      ? resolveBustlyAgentCreatedAt(workspaceDir, workspaceMetadata)
      : null;
    const shouldForceRefresh =
      workspaceExists &&
      workspaceCreatedAt !== null &&
      workspaceCreatedAt < BUSTLY_PRESET_AGENT_FORCE_REFRESH_BEFORE;
    if (!workspaceAgentIds.has(agentId)) {
      await createBustlyWorkspaceAgent({
        // Keep the full workspace UUID for bootstrap/Supabase lookups.
        workspaceId: params.workspaceId,
        workspaceName: params.workspaceName,
        agentName: preset.slug,
        displayName: preset.label,
        ...(workspaceExists ? {} : { icon: preset.icon }),
        heartbeat: DEFAULT_PRESET_HEARTBEAT,
        ...(preset.bootstrapMetadata ? { bootstrapMetadata: preset.bootstrapMetadata } : {}),
        requireBootstrapMetadata: !workspaceExists,
        skipBootstrap: workspaceExists,
        configPath,
        allowCreateConfig: params.allowCreateConfig,
        env: params.env,
      });
      workspaceAgentIds.add(agentId);
      if (!workspaceExists) {
        bootstrappedCount += 1;
        continue;
      }
      if (!shouldForceRefresh) {
        continue;
      }
    }
    if (!workspaceExists || shouldForceRefresh) {
      await initializeBustlyWorkspaceBootstrap({
        workspaceDir,
        workspaceId: params.workspaceId,
        workspaceName: params.workspaceName,
        agentName: preset.slug,
        ...(preset.bootstrapMetadata ? { metadata: preset.bootstrapMetadata } : {}),
        requireAgentMetadata: true,
      });
      setBustlyAgentMetadata({
        workspaceDir,
        createdAt: Date.now(),
      });
      bootstrappedCount += 1;
    }
  }
  return bootstrappedCount;
}
