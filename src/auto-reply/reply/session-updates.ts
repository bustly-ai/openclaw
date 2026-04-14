import crypto from "node:crypto";
import { resolveUserTimezone } from "../../agents/date-time.js";
import type { OpenClawConfig } from "../../config/config.js";
import { type SessionEntry, updateSessionStore } from "../../config/sessions.js";
import { buildChannelSummary } from "../../infra/channel-summary.js";
import {
  resolveTimezone,
  formatUtcTimestamp,
  formatZonedTimestamp,
} from "../../infra/format-time/format-datetime.ts";
import { drainSystemEventEntries } from "../../infra/system-events.js";

function compactSystemEvent(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }
  const lower = trimmed.toLowerCase();
  if (lower.includes("reason periodic")) {
    return null;
  }
  // Filter out the actual heartbeat prompt, but not cron jobs that mention "heartbeat"
  // The heartbeat prompt starts with "Read HEARTBEAT.md" - cron payloads won't match this
  if (lower.startsWith("read heartbeat.md")) {
    return null;
  }
  // Also filter heartbeat poll/wake noise
  if (lower.includes("heartbeat poll") || lower.includes("heartbeat wake")) {
    return null;
  }
  if (
    lower.startsWith("whatsapp gateway connected") ||
    lower.startsWith("whatsapp gateway disconnected")
  ) {
    return null;
  }
  if (trimmed.startsWith("Node:")) {
    return trimmed.replace(/ · last input [^·]+/i, "").trim();
  }
  return trimmed;
}

function resolveSystemEventTimezone(cfg: OpenClawConfig) {
  const raw = cfg.agents?.defaults?.envelopeTimezone?.trim();
  if (!raw) {
    return { mode: "local" as const };
  }
  const lowered = raw.toLowerCase();
  if (lowered === "utc" || lowered === "gmt") {
    return { mode: "utc" as const };
  }
  if (lowered === "local" || lowered === "host") {
    return { mode: "local" as const };
  }
  if (lowered === "user") {
    return {
      mode: "iana" as const,
      timeZone: resolveUserTimezone(cfg.agents?.defaults?.userTimezone),
    };
  }
  const explicit = resolveTimezone(raw);
  return explicit ? { mode: "iana" as const, timeZone: explicit } : { mode: "local" as const };
}

function formatSystemEventTimestamp(ts: number, cfg: OpenClawConfig) {
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) {
    return "unknown-time";
  }
  const zone = resolveSystemEventTimezone(cfg);
  if (zone.mode === "utc") {
    return formatUtcTimestamp(date, { displaySeconds: true });
  }
  if (zone.mode === "local") {
    return formatZonedTimestamp(date, { displaySeconds: true }) ?? "unknown-time";
  }
  return (
    formatZonedTimestamp(date, { timeZone: zone.timeZone, displaySeconds: true }) ?? "unknown-time"
  );
}

export async function buildQueuedSystemEventBlock(params: {
  cfg: OpenClawConfig;
  sessionKey: string;
  isMainSession: boolean;
  isNewSession: boolean;
}): Promise<string | null> {
  const systemLines: string[] = [];
  const queued = drainSystemEventEntries(params.sessionKey);
  systemLines.push(
    ...queued
      .map((event) => {
        const compacted = compactSystemEvent(event.text);
        if (!compacted) {
          return null;
        }
        return `[${formatSystemEventTimestamp(event.ts, params.cfg)}] ${compacted}`;
      })
      .filter((v): v is string => Boolean(v)),
  );
  if (params.isMainSession && params.isNewSession) {
    const summary = await buildChannelSummary(params.cfg);
    if (summary.length > 0) {
      systemLines.unshift(...summary);
    }
  }
  if (systemLines.length === 0) {
    return null;
  }
  return systemLines.map((line) => `System: ${line}`).join("\n");
}

export async function prependSystemEvents(params: {
  cfg: OpenClawConfig;
  sessionKey: string;
  isMainSession: boolean;
  isNewSession: boolean;
  prefixedBodyBase: string;
}): Promise<string> {
  const block = await buildQueuedSystemEventBlock({
    cfg: params.cfg,
    sessionKey: params.sessionKey,
    isMainSession: params.isMainSession,
    isNewSession: params.isNewSession,
  });
  if (!block) {
    return params.prefixedBodyBase;
  }
  return `${block}\n\n${params.prefixedBodyBase}`;
}

export async function ensureSessionSystemSent(params: {
  sessionEntry?: SessionEntry;
  sessionStore?: Record<string, SessionEntry>;
  sessionKey?: string;
  storePath?: string;
  sessionId?: string;
  isFirstTurnInSession: boolean;
}): Promise<{
  sessionEntry?: SessionEntry;
  systemSent: boolean;
}> {
  if (process.env.OPENCLAW_TEST_FAST === "1") {
    return {
      sessionEntry: params.sessionEntry,
      systemSent: params.sessionEntry?.systemSent ?? false,
    };
  }

  let nextEntry = params.sessionEntry;
  let systemSent = params.sessionEntry?.systemSent ?? false;
  if (!params.isFirstTurnInSession || !params.sessionStore || !params.sessionKey) {
    return { sessionEntry: nextEntry, systemSent };
  }

  const current = nextEntry ??
    params.sessionStore[params.sessionKey] ?? {
      sessionId: params.sessionId ?? crypto.randomUUID(),
      updatedAt: Date.now(),
    };
  nextEntry = {
    ...current,
    sessionId: params.sessionId ?? current.sessionId ?? crypto.randomUUID(),
    updatedAt: Date.now(),
    systemSent: true,
    skillsSnapshot: undefined,
  };
  params.sessionStore[params.sessionKey] = { ...params.sessionStore[params.sessionKey], ...nextEntry };
  if (params.storePath) {
    await updateSessionStore(params.storePath, (store) => {
      store[params.sessionKey!] = { ...store[params.sessionKey!], ...nextEntry };
    });
  }
  systemSent = true;
  return { sessionEntry: nextEntry, systemSent };
}

// Legacy compatibility shim for older tests and call sites. Snapshot persistence
// has been removed from the runtime path; this now only ensures `systemSent`.
export async function ensureSkillSnapshot(params: {
  sessionEntry?: SessionEntry;
  sessionStore?: Record<string, SessionEntry>;
  sessionKey?: string;
  storePath?: string;
  sessionId?: string;
  isFirstTurnInSession: boolean;
  workspaceDir: string;
  cfg: OpenClawConfig;
  skillFilter?: string[];
}): Promise<{
  sessionEntry?: SessionEntry;
  skillsSnapshot?: SessionEntry["skillsSnapshot"];
  systemSent: boolean;
}> {
  void params.workspaceDir;
  void params.cfg;
  void params.skillFilter;
  const result = await ensureSessionSystemSent(params);
  return { ...result, skillsSnapshot: undefined };
}

export async function incrementCompactionCount(params: {
  sessionEntry?: SessionEntry;
  sessionStore?: Record<string, SessionEntry>;
  sessionKey?: string;
  storePath?: string;
  now?: number;
  /** Token count after compaction - if provided, updates session token counts */
  tokensAfter?: number;
}): Promise<number | undefined> {
  const {
    sessionEntry,
    sessionStore,
    sessionKey,
    storePath,
    now = Date.now(),
    tokensAfter,
  } = params;
  if (!sessionStore || !sessionKey) {
    return undefined;
  }
  const entry = sessionStore[sessionKey] ?? sessionEntry;
  if (!entry) {
    return undefined;
  }
  const nextCount = (entry.compactionCount ?? 0) + 1;
  // Build update payload with compaction count and optionally updated token counts
  const updates: Partial<SessionEntry> = {
    compactionCount: nextCount,
    updatedAt: now,
  };
  // If tokensAfter is provided, update the cached token counts to reflect post-compaction state
  if (tokensAfter != null && tokensAfter > 0) {
    updates.totalTokens = tokensAfter;
    updates.totalTokensFresh = true;
    // Clear input/output breakdown since we only have the total estimate after compaction
    updates.inputTokens = undefined;
    updates.outputTokens = undefined;
    updates.cacheRead = undefined;
    updates.cacheWrite = undefined;
  }
  sessionStore[sessionKey] = {
    ...entry,
    ...updates,
  };
  if (storePath) {
    await updateSessionStore(storePath, (store) => {
      store[sessionKey] = {
        ...store[sessionKey],
        ...updates,
      };
    });
  }
  return nextCount;
}
