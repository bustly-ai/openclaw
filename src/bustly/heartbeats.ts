import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import { normalizeAgentId } from "../routing/session-key.js";
import { normalizeBustlyWorkspaceId } from "./workspace-agent.js";

export const DEFAULT_BUSTLY_HEARTBEAT_EVERY = "30m";
const MAX_HEARTBEAT_EVENTS = 16;
const MAX_HEARTBEAT_HISTORY = 200;
const MAX_EVENT_TITLE_CHARS = 80;
const MAX_EVENT_MESSAGE_CHARS = 240;
const MAX_EVENT_ACTION_PROMPT_CHARS = 500;

export type BustlyHeartbeatSeverity = "critical" | "warning" | "suggestion";
export type BustlyHeartbeatStatus = "open" | "resolved";
export type BustlyHeartbeatHealthStatus = "Healthy" | "Warning" | "Critical";

export type BustlyHeartbeatDefinition = {
  content: string;
};

export type BustlyHeartbeatStructuredEvent = {
  severity: BustlyHeartbeatSeverity;
  title: string;
  message: string;
  actionPrompt: string;
};

export type BustlyHeartbeatEventRecord = BustlyHeartbeatStructuredEvent & {
  id: string;
  agentId: string;
  status: BustlyHeartbeatStatus;
  createdAt: number;
  updatedAt: number;
};

export type BustlyHeartbeatState = {
  agentId: string;
  lastScanAt: number | null;
  lastPayloadText: string;
  lastPayloadAt: number | null;
  events: BustlyHeartbeatEventRecord[];
};

export type BustlyHeartbeatHealthSummary = {
  score: number;
  status: BustlyHeartbeatHealthStatus;
  counts: Record<BustlyHeartbeatSeverity, number>;
  lastScanAt: number | null;
};

export type BustlyHeartbeatWorkspaceContext = {
  workspaceId: string;
};

export type BustlyHeartbeatDigestWindow = {
  from: string;
  to: string;
};

function normalizeMultilineValue(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function normalizeStructuredText(value: unknown, maxChars: number): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\s+/g, " ").trim().slice(0, maxChars);
}

function stripJsonFences(value: string): string {
  const trimmed = value.trim();
  const fencedMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fencedMatch?.[1]?.trim() || trimmed;
}

function parseLooseJsonArray(value: string): unknown[] | null {
  const source = value.trim();
  for (let start = source.indexOf("["); start >= 0; start = source.indexOf("[", start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < source.length; index += 1) {
      const char = source[index];
      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === "\\") {
          escaped = true;
          continue;
        }
        if (char === "\"") {
          inString = false;
        }
        continue;
      }
      if (char === "\"") {
        inString = true;
        continue;
      }
      if (char === "[") {
        depth += 1;
        continue;
      }
      if (char !== "]") {
        continue;
      }
      depth -= 1;
      if (depth !== 0) {
        continue;
      }
      const candidate = source.slice(start, index + 1);
      try {
        const parsed = JSON.parse(candidate);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // Try the next bracket range.
      }
      break;
    }
  }
  return null;
}

function fingerprintHeartbeatEvent(event: BustlyHeartbeatStructuredEvent): string {
  return JSON.stringify([
    event.severity,
    event.title,
    event.message,
    event.actionPrompt,
  ]);
}

function sortHeartbeatEvents(
  left: BustlyHeartbeatEventRecord,
  right: BustlyHeartbeatEventRecord,
): number {
  if (left.status !== right.status) {
    return left.status === "open" ? -1 : 1;
  }
  if (left.updatedAt !== right.updatedAt) {
    return right.updatedAt - left.updatedAt;
  }
  return right.createdAt - left.createdAt;
}

function buildEmptyState(agentId: string): BustlyHeartbeatState {
  return {
    agentId: normalizeAgentId(agentId),
    lastScanAt: null,
    lastPayloadText: "",
    lastPayloadAt: null,
    events: [],
  };
}

export function parseBustlyHeartbeatMarkdown(
  content: string | undefined | null,
): BustlyHeartbeatDefinition | null {
  if (typeof content !== "string") {
    return null;
  }
  const normalized = normalizeMultilineValue(content);
  if (!normalized) {
    return null;
  }
  return {
    content: normalized,
  };
}

export function renderBustlyHeartbeatMarkdown(definition: BustlyHeartbeatDefinition): string {
  const normalized = normalizeMultilineValue(definition.content);
  return normalized ? `${normalized}\n` : "";
}

export function buildBustlyHeartbeatOutputRulePrompt(): string {
  return [
    "Output rules:",
    "- If nothing needs attention, reply exactly: HEARTBEAT_OK",
    "- If something needs attention, reply with JSON only",
    "- The JSON must be a top-level array",
    '- Each array item must include exactly these plain-text fields: severity, title, message, actionPrompt',
    '- severity must be one of: "critical", "warning", "suggestion"',
    `- title must be at most ${MAX_EVENT_TITLE_CHARS} characters`,
    `- message must be at most ${MAX_EVENT_MESSAGE_CHARS} characters`,
    `- actionPrompt must be at most ${MAX_EVENT_ACTION_PROMPT_CHARS} characters`,
    "- Do not include markdown, code fences, or extra text before or after the JSON",
  ].join("\n");
}

export function buildBustlyHeartbeatSystemPrompt(): string {
  return [
    "Read HEARTBEAT.md if it exists (workspace context).",
    "Treat HEARTBEAT.md as the long-running objective and escalation guidance for this heartbeat.",
    "Only surface concrete business issues or useful suggestions that match HEARTBEAT.md.",
    "Do not repeat stale issues from prior runs if they are no longer relevant.",
    buildBustlyHeartbeatOutputRulePrompt(),
  ].join("\n");
}

function buildHeartbeatDigestSearchPrompt(
  digestWindow?: BustlyHeartbeatDigestWindow,
): string[] {
  const from = digestWindow?.from?.trim();
  const to = digestWindow?.to?.trim();
  if (!from || !to) {
    return [
      "Before analysis, call heartbeat_digest_search first with the current heartbeat cycle time window (from/to).",
      "Use digest results to understand what the user recently asked and what the agent already completed in that same window.",
    ];
  }
  return [
    "Before analysis, call heartbeat_digest_search first with this exact cycle window:",
    `{"from":"${from}","to":"${to}"}`,
    "Use digest results to understand what the user recently asked and what the agent already completed in that same window.",
  ];
}

export function buildBustlyHeartbeatRunPrompt(options?: {
  digestWindow?: BustlyHeartbeatDigestWindow;
}): string {
  return buildHeartbeatDigestSearchPrompt(options?.digestWindow).join("\n");
}

export function buildBustlyHeartbeatPrompt(options?: {
  digestWindow?: BustlyHeartbeatDigestWindow;
}): string {
  return [
    buildBustlyHeartbeatSystemPrompt(),
    buildBustlyHeartbeatRunPrompt(options),
  ]
    .filter(Boolean)
    .join("\n");
}

export function parseBustlyHeartbeatEventsJson(
  raw: string | undefined | null,
): BustlyHeartbeatStructuredEvent[] | null {
  if (typeof raw !== "string" || !raw.trim()) {
    return null;
  }
  const candidate = stripJsonFences(raw);
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    parsed = parseLooseJsonArray(candidate);
  }
  if (!Array.isArray(parsed)) {
    return null;
  }
  const events: BustlyHeartbeatStructuredEvent[] = [];
  for (const item of parsed.slice(0, MAX_HEARTBEAT_EVENTS)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return null;
    }
    const record = item as Record<string, unknown>;
    const severity = normalizeStructuredText(record.severity, 32).toLowerCase();
    if (severity !== "critical" && severity !== "warning" && severity !== "suggestion") {
      return null;
    }
    const title = normalizeStructuredText(record.title, MAX_EVENT_TITLE_CHARS);
    const message = normalizeStructuredText(record.message, MAX_EVENT_MESSAGE_CHARS);
    const actionPrompt =
      normalizeStructuredText(record.actionPrompt, MAX_EVENT_ACTION_PROMPT_CHARS) ||
      normalizeStructuredText(record.action, MAX_EVENT_ACTION_PROMPT_CHARS) ||
      normalizeStructuredText(record.action_prompt, MAX_EVENT_ACTION_PROMPT_CHARS);
    if (!title || !message || !actionPrompt) {
      return null;
    }
    events.push({
      severity,
      title,
      message,
      actionPrompt,
    });
  }
  return events;
}

export function resolveBustlyHeartbeatStatePath(params: {
  workspaceId: string;
  agentId: string;
  env?: NodeJS.ProcessEnv;
}): string {
  const stateDir = resolveStateDir(params.env ?? process.env);
  const normalizedWorkspaceId = normalizeBustlyWorkspaceId(params.workspaceId);
  const normalizedAgentId = normalizeAgentId(params.agentId);
  return path.join(stateDir, "workspaces", normalizedWorkspaceId, "heartbeats", `${normalizedAgentId}.json`);
}

export function resolveBustlyHeartbeatWorkspaceContext(params: {
  workspaceDir: string;
  env?: NodeJS.ProcessEnv;
}): BustlyHeartbeatWorkspaceContext | null {
  const stateDir = resolveStateDir(params.env ?? process.env);
  const relativePath = path.relative(path.join(stateDir, "workspaces"), params.workspaceDir);
  if (!relativePath || relativePath.startsWith("..")) {
    return null;
  }
  const parts = relativePath.split(path.sep).filter(Boolean);
  if (parts.length !== 3 || parts[1] !== "agents") {
    return null;
  }
  const workspaceId = normalizeBustlyWorkspaceId(parts[0]);
  if (!workspaceId) {
    return null;
  }
  return { workspaceId };
}

export function loadBustlyHeartbeatState(params: {
  workspaceId: string;
  agentId: string;
  env?: NodeJS.ProcessEnv;
}): BustlyHeartbeatState {
  const statePath = resolveBustlyHeartbeatStatePath(params);
  if (!existsSync(statePath)) {
    return buildEmptyState(params.agentId);
  }
  try {
    const raw = readFileSync(statePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<BustlyHeartbeatState> | null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return buildEmptyState(params.agentId);
    }
    const agentId = normalizeAgentId(parsed.agentId ?? params.agentId);
    const events = Array.isArray(parsed.events)
      ? parsed.events
          .filter((item): item is BustlyHeartbeatEventRecord => Boolean(item && typeof item === "object"))
          .map((item) => {
            const status: BustlyHeartbeatStatus = item.status === "resolved" ? "resolved" : "open";
            return {
              id: typeof item.id === "string" ? item.id : randomUUID(),
              agentId,
              severity: item.severity,
              title: item.title,
              message: item.message,
              actionPrompt:
                typeof item.actionPrompt === "string"
                  ? item.actionPrompt
                  : typeof (item as { action?: unknown }).action === "string"
                    ? ((item as { action?: string }).action ?? "")
                    : "",
              status,
              createdAt:
                typeof item.createdAt === "number" && Number.isFinite(item.createdAt)
                  ? item.createdAt
                  : Date.now(),
              updatedAt:
                typeof item.updatedAt === "number" && Number.isFinite(item.updatedAt)
                  ? item.updatedAt
                  : Date.now(),
            };
          })
          .filter(
            (item) =>
              (item.severity === "critical" ||
                item.severity === "warning" ||
                item.severity === "suggestion") &&
              typeof item.title === "string" &&
              typeof item.message === "string" &&
              typeof item.actionPrompt === "string",
          )
      : [];
    return {
      agentId,
      lastScanAt:
        typeof parsed.lastScanAt === "number" && Number.isFinite(parsed.lastScanAt)
          ? parsed.lastScanAt
          : null,
      lastPayloadText: typeof parsed.lastPayloadText === "string" ? parsed.lastPayloadText : "",
      lastPayloadAt:
        typeof parsed.lastPayloadAt === "number" && Number.isFinite(parsed.lastPayloadAt)
          ? parsed.lastPayloadAt
          : null,
      events: events.sort(sortHeartbeatEvents).slice(0, MAX_HEARTBEAT_HISTORY),
    };
  } catch {
    return buildEmptyState(params.agentId);
  }
}

export function saveBustlyHeartbeatState(params: {
  workspaceId: string;
  agentId: string;
  state: BustlyHeartbeatState;
  env?: NodeJS.ProcessEnv;
}): BustlyHeartbeatState {
  const statePath = resolveBustlyHeartbeatStatePath(params);
  mkdirSync(path.dirname(statePath), { recursive: true, mode: 0o700 });
  const normalizedState: BustlyHeartbeatState = {
    agentId: normalizeAgentId(params.state.agentId || params.agentId),
    lastScanAt:
      typeof params.state.lastScanAt === "number" && Number.isFinite(params.state.lastScanAt)
        ? params.state.lastScanAt
        : null,
    lastPayloadText: typeof params.state.lastPayloadText === "string" ? params.state.lastPayloadText : "",
    lastPayloadAt:
      typeof params.state.lastPayloadAt === "number" && Number.isFinite(params.state.lastPayloadAt)
        ? params.state.lastPayloadAt
        : null,
    events: [...params.state.events].sort(sortHeartbeatEvents).slice(0, MAX_HEARTBEAT_HISTORY),
  };
  writeFileSync(statePath, `${JSON.stringify(normalizedState, null, 2)}\n`, "utf-8");
  return normalizedState;
}

export function reconcileBustlyHeartbeatState(params: {
  agentId: string;
  previous: BustlyHeartbeatState;
  events: BustlyHeartbeatStructuredEvent[];
  scannedAt: number;
  payloadText: string;
}): BustlyHeartbeatState {
  const normalizedAgentId = normalizeAgentId(params.agentId);
  const previousByFingerprint = new Map(
    params.previous.events.map((event) => [fingerprintHeartbeatEvent(event), event]),
  );
  const nextFingerprints = new Set<string>();
  const nextEvents: BustlyHeartbeatEventRecord[] = [];

  for (const event of params.events) {
    const fingerprint = fingerprintHeartbeatEvent(event);
    nextFingerprints.add(fingerprint);
    const existing = previousByFingerprint.get(fingerprint);
    nextEvents.push({
      id: existing?.id ?? randomUUID(),
      agentId: normalizedAgentId,
      severity: event.severity,
      title: event.title,
      message: event.message,
      actionPrompt: event.actionPrompt,
      status: "open",
      createdAt: existing?.createdAt ?? params.scannedAt,
      updatedAt:
        existing && existing.status === "open" ? existing.updatedAt : params.scannedAt,
    });
  }

  for (const existing of params.previous.events) {
    const fingerprint = fingerprintHeartbeatEvent(existing);
    if (nextFingerprints.has(fingerprint)) {
      continue;
    }
    nextEvents.push(
      existing.status === "open"
        ? {
            ...existing,
            status: "resolved",
            updatedAt: params.scannedAt,
          }
        : existing,
    );
  }

  return {
    agentId: normalizedAgentId,
    lastScanAt: params.scannedAt,
    lastPayloadText: params.payloadText,
    lastPayloadAt: params.scannedAt,
    events: nextEvents.sort(sortHeartbeatEvents).slice(0, MAX_HEARTBEAT_HISTORY),
  };
}

export function resolveBustlyHeartbeatHealthSummary(params: {
  events: BustlyHeartbeatEventRecord[];
  lastScanAt: number | null;
}): BustlyHeartbeatHealthSummary {
  const counts = {
    critical: 0,
    warning: 0,
    suggestion: 0,
  } satisfies Record<BustlyHeartbeatSeverity, number>;
  for (const event of params.events) {
    if (event.status !== "open") {
      continue;
    }
    counts[event.severity] += 1;
  }
  // Health should follow the highest-severity open event, not a weighted deduction.
  let status: BustlyHeartbeatHealthStatus = "Healthy";
  if (counts.critical > 0) {
    status = "Critical";
  } else if (counts.warning > 0) {
    status = "Warning";
  }
  const scoreByStatus: Record<BustlyHeartbeatHealthStatus, number> = {
    Healthy: 100,
    Warning: 66,
    Critical: 33,
  };
  const score = scoreByStatus[status];
  return {
    score,
    status,
    counts,
    lastScanAt: params.lastScanAt,
  };
}
