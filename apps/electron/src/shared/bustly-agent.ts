const VALID_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const INVALID_CHARS_RE = /[^a-z0-9_-]+/g;
const LEADING_DASH_RE = /^-+/;
const TRAILING_DASH_RE = /-+$/;
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

export function normalizeBustlyWorkspaceId(value: string | undefined | null): string {
  return normalizeToken(value);
}

export function normalizeBustlyAgentName(value: string | undefined | null): string {
  return normalizeToken(value) || DEFAULT_BUSTLY_AGENT_NAME;
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

export function isBustlyAgentConversationSessionKey(sessionKey: string, agentId?: string): boolean {
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

export function isAgentChannelSessionKey(sessionKey: string, agentId: string): boolean {
  const normalizedAgentId = normalizeToken(agentId) || "main";
  return sessionKey.startsWith(`agent:${normalizedAgentId}:main:channel:`);
}

export function resolveAgentIdFromSessionKey(sessionKey: string | undefined | null): string | null {
  const trimmed = (sessionKey ?? "").trim();
  const match = /^agent:([^:]+):/i.exec(trimmed);
  return match?.[1] ? normalizeToken(match[1]) : null;
}
