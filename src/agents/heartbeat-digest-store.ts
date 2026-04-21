import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export type HeartbeatDigestResultStatus =
  | "completed"
  | "partial"
  | "failed"
  | "blocked"
  | "unknown";

export type HeartbeatDigestEntry = {
  id: string;
  createdAt: string;
  createdAtMs: number;
  sessionId: string;
  sessionKey?: string;
  query: string;
  userQuestion: {
    summary: string;
    detail?: string;
  };
  agentAction: {
    summary: string;
  };
  outcome: {
    status: HeartbeatDigestResultStatus;
    summary: string;
  };
  keywords?: string[];
  followUp?: {
    risk?: string;
    unresolvedItems?: string[];
  };
};

const MAX_DIGEST_LINE_CHARS = 2000;

function cleanLine(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().replace(/\s+/g, " ");
}

function cleanKeywords(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const next = value
    .map((item) => cleanLine(item))
    .filter(Boolean)
    .slice(0, 20);
  return next.length > 0 ? next : undefined;
}

function normalizeStatus(value: unknown): HeartbeatDigestResultStatus {
  const normalized = cleanLine(value).toLowerCase();
  if (
    normalized === "completed" ||
    normalized === "partial" ||
    normalized === "failed" ||
    normalized === "blocked"
  ) {
    return normalized;
  }
  return "unknown";
}

function normalizeEntry(raw: unknown): HeartbeatDigestEntry | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const createdAt = cleanLine(record.createdAt);
  const createdAtMs =
    typeof record.createdAtMs === "number" && Number.isFinite(record.createdAtMs)
      ? Math.floor(record.createdAtMs)
      : Number.NaN;
  const sessionId = cleanLine(record.sessionId);
  const query = cleanLine(record.query);
  const questionRaw =
    record.userQuestion && typeof record.userQuestion === "object" && !Array.isArray(record.userQuestion)
      ? (record.userQuestion as Record<string, unknown>)
      : {};
  const actionRaw =
    record.agentAction && typeof record.agentAction === "object" && !Array.isArray(record.agentAction)
      ? (record.agentAction as Record<string, unknown>)
      : {};
  const outcomeRaw =
    record.outcome && typeof record.outcome === "object" && !Array.isArray(record.outcome)
      ? (record.outcome as Record<string, unknown>)
      : {};
  const followUpRaw =
    record.followUp && typeof record.followUp === "object" && !Array.isArray(record.followUp)
      ? (record.followUp as Record<string, unknown>)
      : {};

  const questionSummary = cleanLine(questionRaw.summary);
  const questionDetail = cleanLine(questionRaw.detail);
  const actionSummary = cleanLine(actionRaw.summary);
  const outcomeSummary = cleanLine(outcomeRaw.summary);

  if (!createdAt || !Number.isFinite(createdAtMs) || !sessionId || !questionSummary || !actionSummary || !outcomeSummary) {
    return null;
  }

  const id = cleanLine(record.id) || crypto.randomUUID();
  const sessionKey = cleanLine(record.sessionKey);
  const risk = cleanLine(followUpRaw.risk);
  const unresolvedItemsRaw = Array.isArray(followUpRaw.unresolvedItems)
    ? followUpRaw.unresolvedItems
    : [];
  const unresolvedItems = unresolvedItemsRaw
    .map((item) => cleanLine(item))
    .filter(Boolean)
    .slice(0, 8);

  return {
    id,
    createdAt,
    createdAtMs,
    sessionId,
    ...(sessionKey ? { sessionKey } : {}),
    query,
    userQuestion: {
      summary: questionSummary,
      ...(questionDetail && questionDetail !== questionSummary ? { detail: questionDetail } : {}),
    },
    agentAction: {
      summary: actionSummary,
    },
    outcome: {
      status: normalizeStatus(outcomeRaw.status),
      summary: outcomeSummary,
    },
    ...(cleanKeywords(record.keywords) ? { keywords: cleanKeywords(record.keywords) } : {}),
    ...((risk || unresolvedItems.length > 0)
      ? {
          followUp: {
            ...(risk ? { risk } : {}),
            ...(unresolvedItems.length > 0 ? { unresolvedItems } : {}),
          },
        }
      : {}),
  };
}

function scoreEntryForQuery(entry: HeartbeatDigestEntry, query: string): number {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return 1;
  }
  const haystack = [
    entry.query,
    entry.userQuestion.summary,
    entry.userQuestion.detail ?? "",
    entry.agentAction.summary,
    entry.outcome.summary,
    entry.followUp?.risk ?? "",
    ...(entry.followUp?.unresolvedItems ?? []),
    ...(entry.keywords ?? []),
  ]
    .join("\n")
    .toLowerCase();
  if (!haystack) {
    return 0;
  }
  if (haystack.includes(normalized)) {
    return 10;
  }
  const tokens = normalized.split(/[^\p{L}\p{N}_-]+/u).filter((token) => token.length >= 2);
  if (tokens.length === 0) {
    return 0;
  }
  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += 1;
    }
  }
  return score;
}

export function resolveHeartbeatDigestFilePath(agentDir: string): string {
  return path.join(agentDir, "heartbeat", "digests.jsonl");
}

export async function appendHeartbeatDigestEntry(params: {
  agentDir: string;
  entry: HeartbeatDigestEntry;
}): Promise<void> {
  const filePath = resolveHeartbeatDigestFilePath(params.agentDir);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, `${JSON.stringify(params.entry)}\n`, "utf-8");
}

export async function loadHeartbeatDigestEntries(params: {
  agentDir: string;
}): Promise<HeartbeatDigestEntry[]> {
  const filePath = resolveHeartbeatDigestFilePath(params.agentDir);
  let raw = "";
  try {
    raw = await fs.readFile(filePath, "utf-8");
  } catch {
    return [];
  }
  const entries: HeartbeatDigestEntry[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const candidate = trimmed.length > MAX_DIGEST_LINE_CHARS ? trimmed.slice(0, MAX_DIGEST_LINE_CHARS) : trimmed;
    try {
      const parsed = JSON.parse(candidate);
      const normalized = normalizeEntry(parsed);
      if (normalized) {
        entries.push(normalized);
      }
    } catch {
      continue;
    }
  }
  return entries.sort((left, right) => right.createdAtMs - left.createdAtMs);
}

export async function searchHeartbeatDigestEntries(params: {
  agentDir: string;
  fromMs: number;
  toMs: number;
  query?: string;
  limit?: number;
}): Promise<{
  searched: number;
  returned: number;
  entries: HeartbeatDigestEntry[];
}> {
  const all = await loadHeartbeatDigestEntries({ agentDir: params.agentDir });
  const query = params.query?.trim() ?? "";
  const limit = Math.max(1, Math.floor(params.limit ?? 20));
  const fromMs = Math.floor(params.fromMs);
  const toMs = Math.floor(params.toMs);
  const inRange = all.filter((entry) => entry.createdAtMs >= fromMs && entry.createdAtMs <= toMs);
  const filtered = inRange
    .map((entry) => ({ entry, score: scoreEntryForQuery(entry, query) }))
    .filter((row) => row.score > 0)
    .sort((left, right) => right.score - left.score || right.entry.createdAtMs - left.entry.createdAtMs)
    .slice(0, limit)
    .map((row) => row.entry);
  return {
    searched: inRange.length,
    returned: filtered.length,
    entries: filtered,
  };
}
