import fs from "node:fs";
import path from "node:path";
import type { OpenClawConfig } from "../config/config.js";
import { resolveAgentModelFallbackValues } from "../config/model-input.js";
import { resolveStateDir } from "../config/paths.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import {
  DEFAULT_AGENT_ID,
  normalizeAgentId,
  parseAgentSessionKey,
} from "../routing/session-key.js";
import { resolveUserPath } from "../utils.js";
import { normalizeSkillFilter } from "./skills/filter.js";
import { resolveDefaultAgentWorkspaceDir } from "./workspace.js";
import { loadBustlyAgentMetadata, saveBustlyAgentMetadata } from "./bustly-agent-metadata.js";
const log = createSubsystemLogger("agent-scope");
const BUSTLY_AGENT_PREFIX = "bustly-";
const BUSTLY_WORKSPACES_DIRNAME = "workspaces";
const BUSTLY_AGENTS_DIRNAME = "agents";
const DEFAULT_BUSTLY_AGENT_NAME = "overview";
const NON_ASCII_AGENT_PREFIX = "agent-";
const UUID_PREFIX_RE = /^([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Strip null bytes from paths to prevent ENOTDIR errors. */
function stripNullBytes(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\0/g, "");
}

export { resolveAgentIdFromSessionKey } from "../routing/session-key.js";

type AgentEntry = NonNullable<NonNullable<OpenClawConfig["agents"]>["list"]>[number];

type ResolvedAgentConfig = {
  name?: string;
  workspace?: string;
  agentDir?: string;
  model?: AgentEntry["model"];
  skills?: AgentEntry["skills"];
  memorySearch?: AgentEntry["memorySearch"];
  humanDelay?: AgentEntry["humanDelay"];
  heartbeat?: AgentEntry["heartbeat"];
  identity?: AgentEntry["identity"];
  groupChat?: AgentEntry["groupChat"];
  subagents?: AgentEntry["subagents"];
  sandbox?: AgentEntry["sandbox"];
  tools?: AgentEntry["tools"];
};

let defaultAgentWarned = false;

export function listAgentEntries(cfg: OpenClawConfig): AgentEntry[] {
  const list = cfg.agents?.list;
  if (!Array.isArray(list)) {
    return [];
  }
  return list.filter((entry): entry is AgentEntry => Boolean(entry && typeof entry === "object"));
}

export function listAgentIds(cfg: OpenClawConfig): string[] {
  const agents = listAgentEntries(cfg);
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const entry of agents) {
    const id = normalizeAgentId(entry?.id);
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }
  for (const id of listDynamicBustlyWorkspaceAgentIds()) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }
  if (ids.length === 0) {
    return [DEFAULT_AGENT_ID];
  }
  return ids.length > 0 ? ids : [DEFAULT_AGENT_ID];
}

export function resolveDefaultAgentId(cfg: OpenClawConfig): string {
  const agents = listAgentEntries(cfg);
  if (agents.length === 0) {
    return DEFAULT_AGENT_ID;
  }
  const defaults = agents.filter((agent) => agent?.default);
  if (defaults.length > 1 && !defaultAgentWarned) {
    defaultAgentWarned = true;
    log.warn("Multiple agents marked default=true; using the first entry as default.");
  }
  const chosen = (defaults[0] ?? agents[0])?.id?.trim();
  return normalizeAgentId(chosen || DEFAULT_AGENT_ID);
}

export function resolveSessionAgentIds(params: {
  sessionKey?: string;
  config?: OpenClawConfig;
  agentId?: string;
}): {
  defaultAgentId: string;
  sessionAgentId: string;
} {
  const defaultAgentId = resolveDefaultAgentId(params.config ?? {});
  const explicitAgentIdRaw =
    typeof params.agentId === "string" ? params.agentId.trim().toLowerCase() : "";
  const explicitAgentId = explicitAgentIdRaw ? normalizeAgentId(explicitAgentIdRaw) : null;
  const sessionKey = params.sessionKey?.trim();
  const normalizedSessionKey = sessionKey ? sessionKey.toLowerCase() : undefined;
  const parsed = normalizedSessionKey ? parseAgentSessionKey(normalizedSessionKey) : null;
  const sessionAgentId =
    explicitAgentId ?? (parsed?.agentId ? normalizeAgentId(parsed.agentId) : defaultAgentId);
  return { defaultAgentId, sessionAgentId };
}

export function resolveSessionAgentId(params: {
  sessionKey?: string;
  config?: OpenClawConfig;
}): string {
  return resolveSessionAgentIds(params).sessionAgentId;
}

function resolveAgentEntry(cfg: OpenClawConfig, agentId: string): AgentEntry | undefined {
  const id = normalizeAgentId(agentId);
  return listAgentEntries(cfg).find((entry) => normalizeAgentId(entry.id) === id);
}

function normalizeBustlyToken(value: string | undefined): string {
  const trimmed = value?.trim().toLowerCase() ?? "";
  if (!trimmed) {
    return "";
  }
  return trimmed.replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

function hashBustlyTokenToHex(value: string): string {
  let hash = 0x811c9dc5;
  for (const char of value) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function normalizeBustlyAgentNameToken(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return DEFAULT_BUSTLY_AGENT_NAME;
  }
  const normalized = normalizeBustlyToken(trimmed);
  if (normalized) {
    return normalized;
  }
  return `${NON_ASCII_AGENT_PREFIX}${hashBustlyTokenToHex(trimmed)}`;
}

function normalizeBustlyWorkspaceId(value: string | undefined): string {
  const normalized = normalizeBustlyToken(value);
  if (!normalized) {
    return "";
  }
  const uuidPrefix = UUID_PREFIX_RE.exec(normalized)?.[1]?.toLowerCase();
  return uuidPrefix || normalized;
}

function buildBustlyWorkspaceAgentId(
  workspaceId: string | undefined,
  agentName: string = DEFAULT_BUSTLY_AGENT_NAME,
): string | null {
  const trimmed = workspaceId?.trim();
  if (!trimmed) {
    return null;
  }
  const normalizedWorkspaceId = normalizeBustlyWorkspaceId(trimmed);
  if (!normalizedWorkspaceId) {
    return null;
  }
  const normalizedAgentName = normalizeBustlyAgentNameToken(agentName);
  return normalizeAgentId(`${BUSTLY_AGENT_PREFIX}${normalizedWorkspaceId}-${normalizedAgentName}`);
}

function resolveDynamicBustlyWorkspaceDirFromStateDir(agentId: string): string | null {
  const stateDir = resolveStateDir(process.env);
  const workspacesDir = path.join(stateDir, BUSTLY_WORKSPACES_DIRNAME);
  try {
    const workspaceEntries = fs.readdirSync(workspacesDir, { withFileTypes: true });
    for (const workspaceEntry of workspaceEntries) {
      if (!workspaceEntry.isDirectory()) {
        continue;
      }
      if (workspaceEntry.name.startsWith(BUSTLY_AGENT_PREFIX)) {
        if (normalizeAgentId(workspaceEntry.name) === agentId) {
          return path.join(workspacesDir, workspaceEntry.name);
        }
        continue;
      }
      const agentsDir = path.join(workspacesDir, workspaceEntry.name, BUSTLY_AGENTS_DIRNAME);
      let agentEntries: fs.Dirent[];
      try {
        agentEntries = fs.readdirSync(agentsDir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const agentEntry of agentEntries) {
        if (!agentEntry.isDirectory()) {
          continue;
        }
        if (buildBustlyWorkspaceAgentId(workspaceEntry.name, agentEntry.name) === agentId) {
          return path.join(agentsDir, agentEntry.name);
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

function resolveOAuthBustlyWorkspaceAgentDir(agentId: string): string | null {
  try {
    const statePath = path.join(resolveStateDir(process.env), "bustlyOauth.json");
    const raw = fs.readFileSync(statePath, "utf8");
    const parsed = JSON.parse(raw) as {
      user?: {
        workspaceId?: unknown;
      };
    };
    const workspaceId =
      typeof parsed.user?.workspaceId === "string" ? parsed.user.workspaceId : undefined;
    const oauthAgentId = buildBustlyWorkspaceAgentId(workspaceId);
    if (!workspaceId || oauthAgentId !== agentId) {
      return null;
    }
    const normalizedWorkspaceId = normalizeBustlyWorkspaceId(workspaceId);
    if (!normalizedWorkspaceId) {
      return null;
    }
    return path.join(
      resolveStateDir(process.env),
      BUSTLY_WORKSPACES_DIRNAME,
      normalizedWorkspaceId,
      BUSTLY_AGENTS_DIRNAME,
      DEFAULT_BUSTLY_AGENT_NAME,
    );
  } catch {
    return null;
  }
}

function listDynamicBustlyWorkspaceAgentIds(): string[] {
  const ids = new Set<string>();
  const oauthWorkspaceAgentId = readBustlyWorkspaceAgentIdFromStateDir();
  if (oauthWorkspaceAgentId) {
    ids.add(oauthWorkspaceAgentId);
  }

  const workspacesDir = path.join(resolveStateDir(process.env), BUSTLY_WORKSPACES_DIRNAME);
  try {
    const entries = fs.readdirSync(workspacesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (entry.name.startsWith(BUSTLY_AGENT_PREFIX)) {
        const id = normalizeAgentId(entry.name);
        if (id.length > BUSTLY_AGENT_PREFIX.length) {
          ids.add(id);
        }
        continue;
      }
      const agentsDir = path.join(workspacesDir, entry.name, BUSTLY_AGENTS_DIRNAME);
      let agentEntries: fs.Dirent[];
      try {
        agentEntries = fs.readdirSync(agentsDir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const agentEntry of agentEntries) {
        if (!agentEntry.isDirectory()) {
          continue;
        }
        const id = buildBustlyWorkspaceAgentId(entry.name, agentEntry.name);
        if (id) {
          ids.add(id);
        }
      }
    }
  } catch {
    // Best-effort compatibility for local Bustly workspace state.
  }
  return [...ids];
}

function readBustlyWorkspaceAgentIdFromStateDir(): string | null {
  try {
    const statePath = path.join(resolveStateDir(process.env), "bustlyOauth.json");
    const raw = fs.readFileSync(statePath, "utf8");
    const parsed = JSON.parse(raw) as {
      user?: {
        workspaceId?: unknown;
      };
    };
    return buildBustlyWorkspaceAgentId(
      typeof parsed.user?.workspaceId === "string" ? parsed.user.workspaceId : undefined,
    );
  } catch {
    return null;
  }
}

export function resolveAgentConfig(
  cfg: OpenClawConfig,
  agentId: string,
): ResolvedAgentConfig | undefined {
  const id = normalizeAgentId(agentId);
  const entry = resolveAgentEntry(cfg, id);
  if (!entry) {
    return undefined;
  }
  return {
    name: typeof entry.name === "string" ? entry.name : undefined,
    workspace: typeof entry.workspace === "string" ? entry.workspace : undefined,
    agentDir: typeof entry.agentDir === "string" ? entry.agentDir : undefined,
    model:
      typeof entry.model === "string" || (entry.model && typeof entry.model === "object")
        ? entry.model
        : undefined,
    skills: Array.isArray(entry.skills) ? entry.skills : undefined,
    memorySearch: entry.memorySearch,
    humanDelay: entry.humanDelay,
    heartbeat: entry.heartbeat,
    identity: entry.identity,
    groupChat: entry.groupChat,
    subagents: typeof entry.subagents === "object" && entry.subagents ? entry.subagents : undefined,
    sandbox: entry.sandbox,
    tools: entry.tools,
  };
}

export function resolveAgentSkillsFilter(
  cfg: OpenClawConfig,
  agentId: string,
): string[] | undefined {
  const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
  const metadataSkills = workspaceDir ? loadBustlyAgentMetadata(workspaceDir).skills : undefined;
  if (metadataSkills !== undefined) {
    return metadataSkills;
  }
  const configSkills = normalizeSkillFilter(resolveAgentConfig(cfg, agentId)?.skills);
  if (
    workspaceDir &&
    configSkills !== undefined &&
    normalizeAgentId(agentId).startsWith(BUSTLY_AGENT_PREFIX)
  ) {
    const current = loadBustlyAgentMetadata(workspaceDir);
    saveBustlyAgentMetadata(workspaceDir, {
      ...current,
      skills: configSkills,
    });
  }
  return configSkills;
}

function resolveModelPrimary(raw: unknown): string | undefined {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed || undefined;
  }
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const primary = (raw as { primary?: unknown }).primary;
  if (typeof primary !== "string") {
    return undefined;
  }
  const trimmed = primary.trim();
  return trimmed || undefined;
}

export function resolveAgentExplicitModelPrimary(
  cfg: OpenClawConfig,
  agentId: string,
): string | undefined {
  const raw = resolveAgentConfig(cfg, agentId)?.model;
  return resolveModelPrimary(raw);
}

export function resolveAgentEffectiveModelPrimary(
  cfg: OpenClawConfig,
  agentId: string,
): string | undefined {
  return (
    resolveAgentExplicitModelPrimary(cfg, agentId) ??
    resolveModelPrimary(cfg.agents?.defaults?.model)
  );
}

// Backward-compatible alias. Prefer explicit/effective helpers at new call sites.
export function resolveAgentModelPrimary(cfg: OpenClawConfig, agentId: string): string | undefined {
  return resolveAgentExplicitModelPrimary(cfg, agentId);
}

export function resolveAgentModelFallbacksOverride(
  cfg: OpenClawConfig,
  agentId: string,
): string[] | undefined {
  const raw = resolveAgentConfig(cfg, agentId)?.model;
  if (!raw || typeof raw === "string") {
    return undefined;
  }
  // Important: treat an explicitly provided empty array as an override to disable global fallbacks.
  if (!Object.hasOwn(raw, "fallbacks")) {
    return undefined;
  }
  return Array.isArray(raw.fallbacks) ? raw.fallbacks : undefined;
}

export function resolveEffectiveModelFallbacks(params: {
  cfg: OpenClawConfig;
  agentId: string;
  hasSessionModelOverride: boolean;
}): string[] | undefined {
  const agentFallbacksOverride = resolveAgentModelFallbacksOverride(params.cfg, params.agentId);
  if (!params.hasSessionModelOverride) {
    return agentFallbacksOverride;
  }
  const defaultFallbacks = resolveAgentModelFallbackValues(params.cfg.agents?.defaults?.model);
  return agentFallbacksOverride ?? defaultFallbacks;
}

export function resolveAgentWorkspaceDir(cfg: OpenClawConfig, agentId: string) {
  const id = normalizeAgentId(agentId);
  const configured = resolveAgentConfig(cfg, id)?.workspace?.trim();
  if (configured) {
    return stripNullBytes(resolveUserPath(configured));
  }
  if (id.startsWith(BUSTLY_AGENT_PREFIX) && id.length > BUSTLY_AGENT_PREFIX.length) {
    const dynamicWorkspaceDir =
      resolveDynamicBustlyWorkspaceDirFromStateDir(id) ?? resolveOAuthBustlyWorkspaceAgentDir(id);
    if (dynamicWorkspaceDir) {
      return stripNullBytes(dynamicWorkspaceDir);
    }
    return stripNullBytes(path.join(resolveStateDir(process.env), BUSTLY_WORKSPACES_DIRNAME, id));
  }
  const defaultAgentId = resolveDefaultAgentId(cfg);
  if (id === defaultAgentId) {
    const fallback = cfg.agents?.defaults?.workspace?.trim();
    if (fallback) {
      return stripNullBytes(resolveUserPath(fallback));
    }
    return stripNullBytes(resolveDefaultAgentWorkspaceDir(process.env));
  }
  const stateDir = resolveStateDir(process.env);
  return stripNullBytes(path.join(stateDir, `workspace-${id}`));
}

export function resolveAgentDir(cfg: OpenClawConfig, agentId: string) {
  const id = normalizeAgentId(agentId);
  const configured = resolveAgentConfig(cfg, id)?.agentDir?.trim();
  if (configured) {
    return resolveUserPath(configured);
  }
  const root = resolveStateDir(process.env);
  return path.join(root, "agents", id, "agent");
}
