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
  reviewRunId?: string;
  query: string;
  userIssue: {
    title: string;
    message: string;
  };
  taskResult: {
    status: HeartbeatDigestResultStatus;
    summary: string;
    toolCallCount: number;
    layer?: "none" | "memory" | "skill" | "retrieval_only";
    reason?: string;
    confidence?: number;
  };
  snippet?: string;
  keywords?: string[];
  reviewError?: string;
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

function normalizeLayer(value: unknown): "none" | "memory" | "skill" | "retrieval_only" | undefined {
  const normalized = cleanLine(value).toLowerCase();
  if (
    normalized === "none" ||
    normalized === "memory" ||
    normalized === "skill" ||
    normalized === "retrieval_only"
  ) {
    return normalized;
  }
  return undefined;
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
  const issueRaw =
    record.userIssue && typeof record.userIssue === "object" && !Array.isArray(record.userIssue)
      ? (record.userIssue as Record<string, unknown>)
      : {};
  const resultRaw =
    record.taskResult && typeof record.taskResult === "object" && !Array.isArray(record.taskResult)
      ? (record.taskResult as Record<string, unknown>)
      : {};

  const issueTitle = cleanLine(issueRaw.title);
  const issueMessage = cleanLine(issueRaw.message);
  const resultSummary = cleanLine(resultRaw.summary);
  const toolCallCount =
    typeof resultRaw.toolCallCount === "number" && Number.isFinite(resultRaw.toolCallCount)
      ? Math.max(0, Math.floor(resultRaw.toolCallCount))
      : 0;

  if (!createdAt || !Number.isFinite(createdAtMs) || !sessionId || !issueTitle || !resultSummary) {
    return null;
  }

  const id = cleanLine(record.id) || crypto.randomUUID();
  const sessionKey = cleanLine(record.sessionKey);
  const reviewRunId = cleanLine(record.reviewRunId);
  const snippet = cleanLine(record.snippet);
  const reviewError = cleanLine(record.reviewError);

  return {
    id,
    createdAt,
    createdAtMs,
    sessionId,
    ...(sessionKey ? { sessionKey } : {}),
    ...(reviewRunId ? { reviewRunId } : {}),
    query,
    userIssue: {
      title: issueTitle,
      message: issueMessage,
    },
    taskResult: {
      status: normalizeStatus(resultRaw.status),
      summary: resultSummary,
      toolCallCount,
      ...(normalizeLayer(resultRaw.layer) ? { layer: normalizeLayer(resultRaw.layer) } : {}),
      ...(cleanLine(resultRaw.reason) ? { reason: cleanLine(resultRaw.reason) } : {}),
      ...((typeof resultRaw.confidence === "number" && Number.isFinite(resultRaw.confidence))
        ? { confidence: Math.max(0, Math.min(1, resultRaw.confidence)) }
        : {}),
    },
    ...(snippet ? { snippet } : {}),
    ...(cleanKeywords(record.keywords) ? { keywords: cleanKeywords(record.keywords) } : {}),
    ...(reviewError ? { reviewError } : {}),
  };
}

function scoreEntryForQuery(entry: HeartbeatDigestEntry, query: string): number {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return 1;
  }
  const haystack = [
    entry.query,
    entry.userIssue.title,
    entry.userIssue.message,
    entry.taskResult.summary,
    entry.taskResult.reason ?? "",
    entry.snippet ?? "",
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

