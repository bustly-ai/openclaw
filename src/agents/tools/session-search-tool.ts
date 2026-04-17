import fs from "node:fs";
import path from "node:path";
import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readNumberParam, readStringParam } from "./common.js";
import { collectTextContentBlocks } from "../content-blocks.js";
import { resolveAgentIdFromSessionKey } from "../../routing/session-key.js";
import { loadSessionStore, resolveDefaultSessionStorePath, resolveSessionFilePath } from "../../config/sessions.js";

const SessionSearchSchema = Type.Object({
  query: Type.String(),
  maxResults: Type.Optional(Type.Number({ minimum: 1 })),
  maxSessions: Type.Optional(Type.Number({ minimum: 1 })),
  excludeCurrentSession: Type.Optional(Type.Boolean()),
});

type TranscriptMessage = {
  role?: string;
  content?: unknown;
  text?: unknown;
};

type ExperienceEntry = {
  timestamp?: string;
  layer?: string;
  summary?: string;
  reason?: string;
  confidence?: number;
  query?: string;
  sourceSessionId?: string;
  sourceSessionKey?: string;
  snippet?: string;
  keywords?: unknown;
  correction?: {
    wrongAssumption?: string;
    userCorrection?: string;
    verifiedFix?: string;
    actionableRule?: string;
    scope?: string;
  };
  precedent?: {
    title?: string;
    problem?: string;
    resolution?: string;
    rule?: string;
  };
};

export type SessionSearchMatch = {
  sessionKey: string;
  sessionId: string;
  sessionFile: string;
  role?: string;
  updatedAt?: number;
  snippet: string;
  score: number;
};

function extractMessageText(message: TranscriptMessage): string {
  const chunks: string[] = [];
  if (typeof message.content === "string") {
    chunks.push(message.content);
  }
  if (Array.isArray(message.content)) {
    chunks.push(...collectTextContentBlocks(message.content));
  }
  if (typeof message.text === "string") {
    chunks.push(message.text);
  }
  return chunks.map((part) => part.trim()).filter(Boolean).join("\n").trim();
}

function parseTranscriptMessages(sessionFile: string): TranscriptMessage[] {
  if (!fs.existsSync(sessionFile)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(sessionFile, "utf-8");
    return raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as { type?: string; message?: TranscriptMessage };
        } catch {
          return null;
        }
      })
      .filter((entry): entry is { type?: string; message?: TranscriptMessage } => Boolean(entry))
      .filter((entry) => entry.type === "message" && Boolean(entry.message))
      .map((entry) => entry.message ?? {});
  } catch {
    return [];
  }
}

function parseExperienceEntries(experienceFile: string): ExperienceEntry[] {
  if (!fs.existsSync(experienceFile)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(experienceFile, "utf-8");
    return raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as ExperienceEntry;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is ExperienceEntry => Boolean(entry));
  } catch {
    return [];
  }
}

function tokenizeQuery(query: string): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }
  const tokens = normalized.split(/[^\p{L}\p{N}_-]+/u).filter((token) => token.length >= 2);
  return tokens.length > 0 ? tokens : [normalized];
}

function computeMatchScore(text: string, normalizedQuery: string, tokens: string[]): number {
  const haystack = text.toLowerCase();
  if (!haystack) {
    return 0;
  }
  let score = haystack.includes(normalizedQuery) ? 10 : 0;
  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += 1;
    }
  }
  return score;
}

function buildSnippet(text: string, query: string, tokens: string[]): string {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "";
  }
  const lower = normalized.toLowerCase();
  const searchTerms = [query.toLowerCase(), ...tokens].filter(Boolean);
  const firstMatch =
    searchTerms
      .map((term) => lower.indexOf(term))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, firstMatch - 80);
  const end = Math.min(normalized.length, firstMatch + 220);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < normalized.length ? "…" : "";
  return `${prefix}${normalized.slice(start, end)}${suffix}`;
}

export function searchSessionTranscripts(params: {
  query: string;
  maxResults?: number;
  maxSessions?: number;
  excludeCurrentSession?: boolean;
  agentSessionKey?: string;
}): {
  query: string;
  searchedSessions: number;
  results: SessionSearchMatch[];
} {
  const maxResults = Math.max(1, Math.floor(params.maxResults ?? 5));
  const maxSessions = Math.max(1, Math.floor(params.maxSessions ?? 25));
  const excludeCurrentSession = params.excludeCurrentSession ?? true;
  const agentId = resolveAgentIdFromSessionKey(params.agentSessionKey);
  const storePath = resolveDefaultSessionStorePath(agentId);
  const sessionsDir = path.dirname(storePath);
  const agentRootDir = path.dirname(sessionsDir);
  const experienceFile = path.join(agentRootDir, "agent", "experience", "entries.jsonl");
  const currentSessionKey = params.agentSessionKey?.trim();
  const query = params.query.trim();
  const normalizedQuery = query.toLowerCase();
  const tokens = tokenizeQuery(query);
  if (!normalizedQuery) {
    return { query, searchedSessions: 0, results: [] };
  }

  const store = loadSessionStore(storePath, { skipCache: true });
  const entries = Object.entries(store)
    .filter(([, entry]) => Boolean(entry?.sessionId))
    .filter(
      ([sessionKey]) => !(excludeCurrentSession && currentSessionKey && sessionKey === currentSessionKey),
    )
    .sort((a, b) => (b[1]?.updatedAt ?? 0) - (a[1]?.updatedAt ?? 0))
    .slice(0, maxSessions);

  const matches: SessionSearchMatch[] = [];

  for (const entry of parseExperienceEntries(experienceFile)) {
    const text = [
      entry.summary,
      entry.reason,
      entry.snippet,
      entry.correction?.wrongAssumption,
      entry.correction?.userCorrection,
      entry.correction?.verifiedFix,
      entry.correction?.actionableRule,
      entry.correction?.scope,
      entry.precedent?.title,
      entry.precedent?.problem,
      entry.precedent?.resolution,
      entry.precedent?.rule,
      ...(Array.isArray(entry.keywords) ? entry.keywords.filter((item) => typeof item === "string") : []),
    ]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
      .join("\n");
    const score = computeMatchScore(text, normalizedQuery, tokens);
    if (score <= 0) {
      continue;
    }
    matches.push({
      sessionKey: entry.sourceSessionKey?.trim() || "experience:precedent",
      sessionId: entry.sourceSessionId?.trim() || "experience",
      sessionFile: experienceFile,
      role: "experience",
      updatedAt: entry.timestamp ? Date.parse(entry.timestamp) : undefined,
      snippet: buildSnippet(text, normalizedQuery, tokens),
      score: score + 5,
    });
  }

  for (const [sessionKey, entry] of entries) {
    const sessionId = entry?.sessionId?.trim();
    if (!sessionId) {
      continue;
    }
    let sessionFile: string;
    try {
      sessionFile = resolveSessionFilePath(sessionId, entry, {
        agentId,
        sessionsDir,
      });
    } catch {
      continue;
    }
    for (const message of parseTranscriptMessages(sessionFile)) {
      const text = extractMessageText(message);
      const score = computeMatchScore(text, normalizedQuery, tokens);
      if (score <= 0) {
        continue;
      }
      matches.push({
        sessionKey,
        sessionId,
        sessionFile,
        role: message.role,
        updatedAt: entry?.updatedAt,
        snippet: buildSnippet(text, normalizedQuery, tokens),
        score,
      });
    }
  }

  matches.sort((a, b) => b.score - a.score || (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

  return {
    query,
    searchedSessions: entries.length,
    results: matches.slice(0, maxResults),
  };
}

export function createSessionSearchTool(opts?: { agentSessionKey?: string }): AnyAgentTool {
  return {
    label: "Session Search",
    name: "session_search",
    description:
      "Search prior session transcripts for similar work across this agent before concluding there is no precedent. Returns matching snippets with session identifiers and recency.",
    parameters: SessionSearchSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const query = readStringParam(params, "query", { required: true });
      const maxResults = Math.max(1, Math.floor(readNumberParam(params, "maxResults") ?? 5));
      const maxSessions = Math.max(1, Math.floor(readNumberParam(params, "maxSessions") ?? 25));
      const excludeCurrentSession =
        typeof params.excludeCurrentSession === "boolean" ? params.excludeCurrentSession : true;
      return jsonResult(
        searchSessionTranscripts({
          query,
          maxResults,
          maxSessions,
          excludeCurrentSession,
          agentSessionKey: opts?.agentSessionKey,
        }),
      );
    },
  };
}
