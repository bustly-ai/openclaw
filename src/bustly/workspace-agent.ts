const VALID_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const INVALID_CHARS_RE = /[^a-z0-9_-]+/g;
const LEADING_DASH_RE = /^-+/;
const TRAILING_DASH_RE = /-+$/;
const UUID_PREFIX_RE = /^([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUSTLY_AGENT_WITH_WORKSPACE_RE = /^bustly-([0-9a-f]{8})-(.+)$/i;
const BUSTLY_LEGACY_MAIN_AGENT_RE = /^bustly-([0-9a-f]{8})$/i;
const NON_ASCII_AGENT_PREFIX = "agent-";

export const DEFAULT_BUSTLY_AGENT_NAME = "overview";

function normalizeToken(value: string | undefined | null): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return "";
  }
  if (VALID_ID_RE.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return trimmed
    .toLowerCase()
    .replace(INVALID_CHARS_RE, "-")
    .replace(LEADING_DASH_RE, "")
    .replace(TRAILING_DASH_RE, "")
    .slice(0, 64);
}

function hashTokenToHex(value: string): string {
  let hash = 0x811c9dc5;
  for (const char of value) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function normalizeBustlyWorkspaceId(value: string | undefined | null): string {
  const normalized = normalizeToken(value);
  if (!normalized) {
    return "";
  }
  const uuidPrefix = UUID_PREFIX_RE.exec(normalized)?.[1]?.toLowerCase();
  return uuidPrefix || normalized;
}

export function normalizeBustlyAgentName(value: string | undefined | null): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return DEFAULT_BUSTLY_AGENT_NAME;
  }
  const normalized = normalizeToken(trimmed);
  if (normalized) {
    return normalized;
  }
  return `${NON_ASCII_AGENT_PREFIX}${hashTokenToHex(trimmed)}`;
}

export function buildBustlyWorkspaceAgentPrefix(workspaceId: string | undefined | null): string {
  const normalizedWorkspaceId = normalizeBustlyWorkspaceId(workspaceId);
  return normalizedWorkspaceId ? `bustly-${normalizedWorkspaceId}-` : "";
}

export function buildBustlyWorkspaceAgentId(
  workspaceId: string | undefined | null,
  agentName: string | undefined | null = DEFAULT_BUSTLY_AGENT_NAME,
): string {
  const prefix = buildBustlyWorkspaceAgentPrefix(workspaceId);
  if (!prefix) {
    return "main";
  }
  return `${prefix}${normalizeBustlyAgentName(agentName)}`;
}

export function resolveBustlyAgentNameFromAgentId(
  workspaceId: string | undefined | null,
  agentId: string | undefined | null,
): string | null {
  const normalizedAgentId = normalizeToken(agentId);
  const prefix = buildBustlyWorkspaceAgentPrefix(workspaceId);
  if (!normalizedAgentId || !prefix || !normalizedAgentId.startsWith(prefix)) {
    return null;
  }
  const agentName = normalizedAgentId.slice(prefix.length).trim();
  return normalizeBustlyAgentName(agentName);
}

export function resolveBustlyWorkspaceTokenFromAgentId(
  agentId: string | undefined | null,
): string | null {
  const normalizedAgentId = normalizeToken(agentId);
  if (!normalizedAgentId) {
    return null;
  }
  const withWorkspace = BUSTLY_AGENT_WITH_WORKSPACE_RE.exec(normalizedAgentId);
  if (withWorkspace?.[1]) {
    return normalizeToken(withWorkspace[1]);
  }
  const legacyMain = BUSTLY_LEGACY_MAIN_AGENT_RE.exec(normalizedAgentId);
  return legacyMain?.[1] ? normalizeToken(legacyMain[1]) : null;
}

export function resolveBustlyAgentNameFromAnyAgentId(
  agentId: string | undefined | null,
): string | null {
  const normalizedAgentId = normalizeToken(agentId);
  if (!normalizedAgentId) {
    return null;
  }
  const withWorkspace = BUSTLY_AGENT_WITH_WORKSPACE_RE.exec(normalizedAgentId);
  if (withWorkspace) {
    const agentName = withWorkspace[2]?.trim() ?? "";
    if (!agentName) {
      return DEFAULT_BUSTLY_AGENT_NAME;
    }
    return normalizeBustlyAgentName(agentName);
  }
  const legacyMain = BUSTLY_LEGACY_MAIN_AGENT_RE.exec(normalizedAgentId);
  if (legacyMain) {
    return DEFAULT_BUSTLY_AGENT_NAME;
  }
  return null;
}

export function buildBustlyAgentConversationSessionKey(
  agentId: string | undefined | null,
  conversationId: string | undefined | null,
): string {
  const normalizedAgentId = normalizeToken(agentId) || "main";
  const normalizedConversationId = normalizeToken(conversationId) || "conversation";
  return `agent:${normalizedAgentId}:conversation:${normalizedConversationId}`;
}

export function buildBustlyAgentDraftViewKey(agentId: string | undefined | null): string {
  const normalizedAgentId = normalizeToken(agentId) || "main";
  return `draft:${normalizedAgentId}`;
}

export function resolveBustlyAgentNameFromSessionKey(
  workspaceId: string | undefined | null,
  sessionKey: string | undefined | null,
): string | null {
  const agentId = resolveAgentIdFromSessionKey(sessionKey);
  return resolveBustlyAgentNameFromAgentId(workspaceId, agentId);
}

function normalizeSessionSlug(value: string | undefined | null): string {
  return normalizeToken(value) || "channel";
}

export function buildBustlyAgentPresetChannelSessionKey(
  agentId: string | undefined | null,
  slug: string | undefined | null,
): string {
  const normalizedAgentId = normalizeToken(agentId) || "main";
  return `agent:${normalizedAgentId}:main:channel:${normalizeSessionSlug(slug)}`;
}

export function isAgentMainSessionKey(sessionKey: string, agentId: string): boolean {
  const normalizedAgentId = normalizeToken(agentId) || "main";
  return sessionKey === `agent:${normalizedAgentId}:main`;
}

export function isBustlyAgentConversationSessionKey(
  sessionKey: string,
  agentId?: string,
): boolean {
  const normalizedSessionKey = (sessionKey ?? "").trim().toLowerCase();
  if (!normalizedSessionKey.startsWith("agent:")) {
    return false;
  }
  if (agentId) {
    const normalizedAgentId = normalizeToken(agentId) || "main";
    return normalizedSessionKey.startsWith(`agent:${normalizedAgentId}:conversation:`);
  }
  return /^agent:[^:]+:conversation:[^:]+$/i.test(normalizedSessionKey);
}

export function isBustlyAgentScheduledSessionKey(sessionKey: string, agentId?: string): boolean {
  const normalizedSessionKey = (sessionKey ?? "").trim().toLowerCase();
  if (!normalizedSessionKey.startsWith("agent:")) {
    return false;
  }
  if (normalizedSessionKey.includes(":run:")) {
    return false;
  }
  if (agentId) {
    const normalizedAgentId = normalizeToken(agentId) || "main";
    return /^agent:[^:]+:cron:[^:]+$/i.test(normalizedSessionKey)
      ? normalizedSessionKey.startsWith(`agent:${normalizedAgentId}:cron:`)
      : false;
  }
  return /^agent:[^:]+:cron:[^:]+$/i.test(normalizedSessionKey);
}

export function isAgentChannelSessionKey(sessionKey: string, agentId: string): boolean {
  const normalizedAgentId = normalizeToken(agentId) || "main";
  return sessionKey.startsWith(`agent:${normalizedAgentId}:main:channel:`);
}

export function resolveAgentIdFromSessionKey(sessionKey: string | undefined | null): string | null {
  const trimmed = (sessionKey ?? "").trim();
  const match = /^agent:([^:]+):/i.exec(trimmed);
  return match?.[1] ? normalizeToken(match[1]) : null;
}
