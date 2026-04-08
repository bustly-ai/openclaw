import { parseSessionLabel, SESSION_LABEL_MAX_LENGTH } from "../../../../src/sessions/session-label";

const PROMPT_EXCERPT_MAX_CHARS = 2_000;
const DEFAULT_SAMPLE_ROUTE_KEY = "chat.standard";
const VALID_SAMPLE_ROUTE_KEYS = new Set(["chat.standard", "chat.advanced", "chat.ultra"]);
const GENERIC_TITLE_PATTERN = /^(conversation|new conversation|task|help)$/i;
const ASSISTANT_REPLY_PATTERNS = [
  /^(?:抱歉|对不起|不好意思)/,
  /^我(?:无法|不能|没法|不可以|做不到)/,
  /^我(?:是|作为).{0,12}(?:ai|助手)/i,
  /^(?:sorry|apologies)\b/i,
  /^i\s*(?:cannot|can't|am unable|won't|do not|don't)/i,
  /^as\s+an\s+ai\b/i,
  /^i\s*(?:am|['’]m)\s+(?:an?\s+)?ai\b/i,
];

function sanitizeWhitespace(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").trim();
}

function sanitizeTitleCandidate(value: string): string {
  return value
    .replace(/^#+\s*/, "")
    .replace(/^[-*]\s*/, "")
    .replace(/^title\s*[:：-]\s*/i, "")
    .replace(/^标题\s*[:：-]\s*/, "")
    .replace(/^(?:user|用户|task|任务)\s*[:：]\s*/i, "")
    .replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, "")
    .replace(/[.。!！?？,:：;；]+$/g, "")
    .trim();
}

function isLikelyAssistantReplyTitle(value: string): boolean {
  const normalized = sanitizeWhitespace(value);
  if (!normalized) {
    return false;
  }
  return ASSISTANT_REPLY_PATTERNS.some((pattern) => pattern.test(normalized));
}

function finalizeSessionTitleCandidate(raw: string, options?: { allowAssistantLike?: boolean }): string | null {
  let normalized = sanitizeTitleCandidate(raw);
  if (!normalized) {
    return null;
  }
  if (normalized.length > SESSION_LABEL_MAX_LENGTH) {
    normalized = normalized.slice(0, SESSION_LABEL_MAX_LENGTH).trim();
  }

  const parsed = parseSessionLabel(normalized);
  if (!parsed.ok) {
    return null;
  }
  if (GENERIC_TITLE_PATTERN.test(parsed.label)) {
    return null;
  }
  if (!options?.allowAssistantLike && isLikelyAssistantReplyTitle(parsed.label)) {
    return null;
  }
  return parsed.label;
}

export function normalizeSessionPromptExcerpt(raw: unknown): string {
  if (typeof raw !== "string") {
    return "";
  }
  const normalized = sanitizeWhitespace(raw);
  if (!normalized) {
    return "";
  }
  return normalized.slice(0, PROMPT_EXCERPT_MAX_CHARS).trim();
}

export function normalizeSampleRouteKey(raw: unknown): string {
  const normalized = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  const routeKey = normalized.startsWith("bustly/") ? normalized.slice("bustly/".length) : normalized;
  return VALID_SAMPLE_ROUTE_KEYS.has(routeKey) ? routeKey : DEFAULT_SAMPLE_ROUTE_KEY;
}

export function normalizeGeneratedSessionTitle(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }

  const firstLine = sanitizeWhitespace(raw)
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) {
    return null;
  }
  return finalizeSessionTitleCandidate(firstLine);
}
