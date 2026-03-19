import { isAgentChannelSessionKey, isAgentMainSessionKey } from "../../shared/bustly-agent";
import type { GatewayBrowserClient } from "./gateway-client";
import { deriveScenarioLabel } from "./session-icons";

export type GatewaySessionRow = {
  key: string;
  label?: string;
  icon?: string;
  displayName?: string;
  derivedTitle?: string;
  updatedAt: number | null;
};

export type SessionsListResult = {
  sessions: GatewaySessionRow[];
};

const SIDEBAR_CUSTOM_LABELS_STORAGE_KEY = "bustly.sidebar.custom-labels.v1";

export function readCustomSessionLabels(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(SIDEBAR_CUSTOM_LABELS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

export function writeCustomSessionLabels(value: Record<string, string>) {
  window.localStorage.setItem(SIDEBAR_CUSTOM_LABELS_STORAGE_KEY, JSON.stringify(value));
}

export function isMainChannelSessionKey(sessionKey: string, agentId: string): boolean {
  return isAgentMainSessionKey(sessionKey, agentId) || isAgentChannelSessionKey(sessionKey, agentId);
}

function stripLeadingMessageTimestamp(text: string): string {
  const cleaned = text.replace(/^\[[^\]]+\]\s*/, "").trim();
  return cleaned || text.trim();
}

function sanitizeSessionTitle(text: string | undefined): string | null {
  if (!text?.trim()) {
    return null;
  }
  const cleaned = stripLeadingMessageTimestamp(text).trim();
  if (!cleaned) {
    return null;
  }
  return cleaned;
}

export function resolveSessionDisplayName(
  session: Pick<GatewaySessionRow, "key" | "label" | "displayName" | "derivedTitle">,
  customSessionLabels: Record<string, string>,
): string {
  return (
    sanitizeSessionTitle(session.label) ||
    sanitizeSessionTitle(session.displayName) ||
    sanitizeSessionTitle(session.derivedTitle) ||
    customSessionLabels[session.key] ||
    deriveScenarioLabel(session.key)
  );
}

export async function listAgentScenarioSessions(params: {
  client: GatewayBrowserClient;
  agentId: string;
  customSessionLabels: Record<string, string>;
  limit?: number;
}) {
  const result = await params.client.request<SessionsListResult>("sessions.list", {
    limit: params.limit ?? 50,
    includeGlobal: false,
    includeUnknown: false,
    includeDerivedTitles: true,
    includeLastMessage: false,
    agentId: params.agentId,
  });

  return [...result.sessions]
    .filter((session) => isMainChannelSessionKey(session.key, params.agentId))
    .sort((a, b) => {
      const aUpdatedAt = a.updatedAt ?? 0;
      const bUpdatedAt = b.updatedAt ?? 0;
      return bUpdatedAt - aUpdatedAt;
    })
    .map((session) => ({
      ...session,
      displayLabel: resolveSessionDisplayName(session, params.customSessionLabels),
    }));
}
