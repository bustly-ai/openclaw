import { parseSessionLabel, SESSION_LABEL_MAX_LENGTH } from "../../../../src/sessions/session-label";

const PROMPT_EXCERPT_MAX_CHARS = 2_000;
const DEFAULT_SAMPLE_ROUTE_KEY = "chat.standard";
const VALID_SAMPLE_ROUTE_KEYS = new Set(["chat.standard", "chat.advanced", "chat.ultra"]);

function sanitizeWhitespace(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").trim();
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

  let normalized = firstLine
    .replace(/^#+\s*/, "")
    .replace(/^[-*]\s*/, "")
    .replace(/^title\s*[:：-]\s*/i, "")
    .replace(/^标题\s*[:：-]\s*/, "")
    .replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, "")
    .replace(/[.。!！?？,:：;；]+$/g, "")
    .trim();

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
  if (/^(conversation|new conversation|task|help)$/i.test(parsed.label)) {
    return null;
  }
  return parsed.label;
}
