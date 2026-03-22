import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { SessionContextAssemblyReport } from "../../config/sessions/types.js";
import { sanitizeToolUseResultPairing } from "../session-transcript-repair.js";

const CHARS_PER_TOKEN_ESTIMATE = 4;
const DEFAULT_HISTORY_BUDGET_RATIO = 0.3;
const DEFAULT_HISTORY_BUDGET_MIN_TOKENS = 2_048;
const DEFAULT_HISTORY_BUDGET_MAX_TOKENS = 24_000;
const DEFAULT_TOOL_RESULT_PREVIEW_TRIGGER_CHARS = 4_000;
const DEFAULT_TOOL_RESULT_PREVIEW_MAX_CHARS = 1_200;
const TOOL_RESULT_PREVIEW_HEAD_CHARS = 700;
const TOOL_RESULT_PREVIEW_TAIL_CHARS = 300;
const MAX_IMPORTANT_ANCHORS = 4;
const IMPORTANT_MESSAGE_PATTERNS = [
  /\b(todo|next step|follow[- ]?up|open question|blocked|blocker)\b/i,
  /\b(decision|decided|constraint|must|important|remember|won't|cannot|can't)\b/i,
  /\b(issue|bug|fix|regression|root cause|rca)\b/i,
];

function collectTextFromBlocks(content: unknown): string[] {
  if (!Array.isArray(content)) {
    return [];
  }
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") {
      continue;
    }
    const candidate = block as { type?: unknown; text?: unknown; thinking?: unknown };
    if (candidate.type === "text" && typeof candidate.text === "string") {
      parts.push(candidate.text);
    }
    if (candidate.type === "thinking" && typeof candidate.thinking === "string") {
      parts.push(candidate.thinking);
    }
  }
  return parts;
}

function messageText(msg: AgentMessage): string {
  if (msg.role === "user") {
    if (typeof msg.content === "string") {
      return msg.content;
    }
    return collectTextFromBlocks(msg.content).join("\n");
  }
  if (msg.role === "assistant" || msg.role === "toolResult") {
    return collectTextFromBlocks(msg.content).join("\n");
  }
  return "";
}

function estimateMessageTokens(msg: AgentMessage): number {
  const text = messageText(msg);
  let chars = text.length;
  if (msg.role === "assistant" && Array.isArray(msg.content)) {
    for (const block of msg.content) {
      if (!block || typeof block !== "object") {
        continue;
      }
      const toolCall = block as { type?: unknown; arguments?: unknown; input?: unknown };
      if (toolCall.type === "toolCall" || toolCall.type === "toolUse") {
        try {
          chars += JSON.stringify(toolCall.arguments ?? toolCall.input ?? {}).length;
        } catch {
          chars += 128;
        }
      }
    }
  }
  return Math.max(1, Math.ceil(chars / CHARS_PER_TOKEN_ESTIMATE));
}

function estimateMessagesTokens(messages: AgentMessage[]): number {
  return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
}

function findRecentTurnStart(messages: AgentMessage[], limit: number | undefined): number {
  if (!limit || limit <= 0 || messages.length === 0) {
    return 0;
  }
  let userCount = 0;
  let lastUserIndex = messages.length;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user") {
      userCount += 1;
      if (userCount > limit) {
        return lastUserIndex;
      }
      lastUserIndex = i;
    }
  }
  return 0;
}

function truncateTextMiddle(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  const headChars = Math.min(TOOL_RESULT_PREVIEW_HEAD_CHARS, Math.max(0, maxChars - 80));
  const tailBudget = Math.max(0, maxChars - headChars - 48);
  const tailChars = Math.min(TOOL_RESULT_PREVIEW_TAIL_CHARS, tailBudget);
  const head = text.slice(0, headChars).trimEnd();
  const tail = tailChars > 0 ? text.slice(Math.max(0, text.length - tailChars)).trimStart() : "";
  return `${head}\n...\n${tail}`.trim();
}

function previewToolResultMessage(
  msg: AgentMessage,
  maxChars: number,
): { message: AgentMessage; changed: boolean } {
  if (msg.role !== "toolResult" || !Array.isArray(msg.content)) {
    return { message: msg, changed: false };
  }
  const text = messageText(msg);
  if (text.length <= maxChars) {
    return { message: msg, changed: false };
  }
  const preview = truncateTextMiddle(text, maxChars);
  const note = `\n\n[Tool result preview: showing ${preview.length} of ${text.length} chars. Re-run the tool or read a narrower slice if more detail is needed.]`;
  const nonTextBlocks = msg.content.filter(
    (block) => !block || typeof block !== "object" || (block as { type?: unknown }).type !== "text",
  );
  return {
    message: {
      ...msg,
      content: [...nonTextBlocks, { type: "text", text: `${preview}${note}` }],
    } as AgentMessage,
    changed: true,
  };
}

function messageHasToolCalls(msg: AgentMessage): boolean {
  if (msg.role !== "assistant" || !Array.isArray(msg.content)) {
    return false;
  }
  return msg.content.some((block) => {
    if (!block || typeof block !== "object") {
      return false;
    }
    const type = (block as { type?: unknown }).type;
    return type === "toolCall" || type === "toolUse" || type === "functionCall";
  });
}

function isImportantAnchor(msg: AgentMessage): boolean {
  if (msg.role === "toolResult") {
    return false;
  }
  if (messageHasToolCalls(msg)) {
    return false;
  }
  if (msg.role === "assistant" && (msg as { stopReason?: unknown }).stopReason === "error") {
    return true;
  }
  const text = messageText(msg).trim();
  if (!text) {
    return false;
  }
  return IMPORTANT_MESSAGE_PATTERNS.some((pattern) => pattern.test(text));
}

function countUserMessages(messages: AgentMessage[]): number {
  return messages.reduce((sum, msg) => sum + (msg.role === "user" ? 1 : 0), 0);
}

export type AssembleContextMessagesParams = {
  messages: AgentMessage[];
  turnLimit?: number;
  contextWindowTokens?: number;
  historyBudgetRatio?: number;
  historyBudgetMinTokens?: number;
  historyBudgetMaxTokens?: number;
  toolResultPreviewTriggerChars?: number;
  toolResultPreviewMaxChars?: number;
};

export type AssembleContextMessagesResult = {
  messages: AgentMessage[];
  report: SessionContextAssemblyReport;
};

export function assembleContextMessages(
  params: AssembleContextMessagesParams,
): AssembleContextMessagesResult {
  const source = params.messages;
  if (source.length === 0) {
    return {
      messages: source,
      report: {
        originalMessages: 0,
        finalMessages: 0,
        originalTokens: 0,
        finalTokens: 0,
        droppedMessages: 0,
        turnLimitApplied: false,
        tokenBudgetApplied: false,
        previewedToolResults: 0,
        anchoredMessages: 0,
      },
    };
  }

  const turnStart = findRecentTurnStart(source, params.turnLimit);
  const turnLimited = turnStart > 0 ? source.slice(turnStart) : source;
  const turnLimitApplied = turnStart > 0;

  const toolPreviewTriggerChars =
    params.toolResultPreviewTriggerChars ?? DEFAULT_TOOL_RESULT_PREVIEW_TRIGGER_CHARS;
  const toolResultPreviewMaxChars =
    params.toolResultPreviewMaxChars ?? DEFAULT_TOOL_RESULT_PREVIEW_MAX_CHARS;

  let previewedToolResults = 0;
  const previewed = turnLimited.map((msg) => {
    if (msg.role !== "toolResult") {
      return msg;
    }
    if (messageText(msg).length < toolPreviewTriggerChars) {
      return msg;
    }
    const next = previewToolResultMessage(msg, toolResultPreviewMaxChars);
    if (next.changed) {
      previewedToolResults += 1;
    }
    return next.message;
  });

  const originalTokens = estimateMessagesTokens(source);
  const previewedTokens = estimateMessagesTokens(previewed);
  const contextWindowTokens = params.contextWindowTokens ?? 0;
  const historyBudgetRatio = params.historyBudgetRatio ?? DEFAULT_HISTORY_BUDGET_RATIO;
  const historyBudgetMinTokens = params.historyBudgetMinTokens ?? DEFAULT_HISTORY_BUDGET_MIN_TOKENS;
  const historyBudgetMaxTokens = params.historyBudgetMaxTokens ?? DEFAULT_HISTORY_BUDGET_MAX_TOKENS;
  const tokenBudget =
    contextWindowTokens > 0
      ? Math.max(
          historyBudgetMinTokens,
          Math.min(historyBudgetMaxTokens, Math.floor(contextWindowTokens * historyBudgetRatio)),
        )
      : 0;

  let finalMessages = previewed;
  let tokenBudgetApplied = false;
  let anchoredMessages = 0;

  if (tokenBudget > 0 && previewedTokens > tokenBudget) {
    tokenBudgetApplied = true;
    const anchorCandidates = previewed.filter((msg) => isImportantAnchor(msg));
    const reserveAnchorBudget =
      anchorCandidates.length > 0 ? Math.min(768, Math.floor(tokenBudget * 0.2)) : 0;
    const suffixBudget = Math.max(256, tokenBudget - reserveAnchorBudget);

    const suffix: AgentMessage[] = [];
    let suffixTokens = 0;
    let suffixUserCount = 0;
    const requiredRecentUsers = Math.max(1, Math.min(1, countUserMessages(previewed)));

    for (let i = previewed.length - 1; i >= 0; i -= 1) {
      const msg = previewed[i];
      const nextTokens = estimateMessageTokens(msg);
      const nextUserCount = suffixUserCount + (msg.role === "user" ? 1 : 0);
      const overBudget = suffix.length > 0 && suffixTokens + nextTokens > suffixBudget;
      if (overBudget && suffixUserCount >= requiredRecentUsers) {
        break;
      }
      suffix.unshift(msg);
      suffixTokens += nextTokens;
      suffixUserCount = nextUserCount;
    }

    const suffixStart = Math.max(0, previewed.length - suffix.length);
    const droppedPrefix = previewed.slice(0, suffixStart);
    const anchors: AgentMessage[] = [];
    let anchorTokens = 0;
    for (let i = droppedPrefix.length - 1; i >= 0 && anchors.length < MAX_IMPORTANT_ANCHORS; i -= 1) {
      const msg = droppedPrefix[i];
      if (!isImportantAnchor(msg)) {
        continue;
      }
      const msgTokens = estimateMessageTokens(msg);
      if (suffixTokens + anchorTokens + msgTokens > tokenBudget) {
        continue;
      }
      anchors.unshift(msg);
      anchorTokens += msgTokens;
    }
    anchoredMessages = anchors.length;
    finalMessages = sanitizeToolUseResultPairing([...anchors, ...suffix]);
  }

  const finalTokens = estimateMessagesTokens(finalMessages);
  return {
    messages: finalMessages,
    report: {
      originalMessages: source.length,
      finalMessages: finalMessages.length,
      originalTokens,
      finalTokens,
      droppedMessages: Math.max(0, source.length - finalMessages.length),
      turnLimitApplied,
      tokenBudgetApplied,
      previewedToolResults,
      anchoredMessages,
    },
  };
}
