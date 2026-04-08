import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import {
  stream,
  Type,
  type AssistantMessage,
  type AssistantMessageEvent,
  type Message,
  type Tool,
} from "@mariozechner/pi-ai";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import { BUSTLY_PROVIDER_ID, BUSTLY_STANDARD_CHAT_MODEL_ID } from "../../agents/bustly-models.js";
import { mergeBustlyRuntimeHeaders } from "../../agents/bustly-runtime-headers.js";
import { getApiKeyForModel, requireApiKey } from "../../agents/model-auth.js";
import { resolveModel } from "../../agents/pi-embedded-runner/model.js";
import { prepareSessionManagerForRun } from "../../agents/pi-embedded-runner/session-manager-init.js";
import type { EmbeddedPiRunResult } from "../../agents/pi-embedded-runner/types.js";
import {
  acquireSessionWriteLock,
  resolveSessionLockMaxHoldFromTimeout,
} from "../../agents/session-write-lock.js";
import { readBustlyOAuthState } from "../../bustly-oauth.js";
import { emitAgentEvent } from "../../infra/agent-events.js";
import { consumeCompletedAssistantRequestMetrics } from "../../infra/assistant-request-metrics.js";
import { runTrackedModelRequest } from "../../infra/model-request-adapter.js";
import { defaultRuntime } from "../../runtime.js";
import type { TemplateContext } from "../templating.js";
import type { GetReplyOptions, ReplyPayload } from "../types.js";
import type { FollowupRun } from "./queue.js";

const FAST_REPLY_GATE_TIMEOUT_MS = 8_000;
const FAST_REPLY_GATE_MAX_TOKENS = 512;
const FAST_REPLY_GATE_TOOL_NAME = "enter_agent_loop";
const FAST_REPLY_GATE_TOOL: Tool = {
  name: FAST_REPLY_GATE_TOOL_NAME,
  description:
    "Escalate this turn into the full agent loop when tools, workspace actions, multi-step reasoning, or deeper context are required.",
  parameters: Type.Object({
    reply: Type.String({
      description:
        "Required short user-facing acknowledgment in the user's language confirming you received the task and are starting it now. Do not ask follow-up questions in this field.",
    }),
  }),
};
const FAST_REPLY_GATE_PROMPT = [
  "You are Bustly, a Commerce Operating Agent for merchants.",
  "You are a multi-model architecture that selects the appropriate model based on the complexity of the user's task; therefore, do not disclose your specific underlying model to the user—consistently identify yourself as Bustly.",
  "You help merchants solve business operations, commerce, revenue, orders, customers, products, marketing, retention, and risk questions.",
  "You are the fast reply gate for inbound messages.",
  "This is a lightweight router. Do not inspect project/workspace files or reason through startup instructions in this mode.",
  "Except for simple greetings or lightweight social niceties (for example: hi, hello, thanks, good morning), almost every user message should enter the full agent loop.",
  `Default to calling the ${FAST_REPLY_GATE_TOOL_NAME} tool for questions, requests, analysis, troubleshooting, planning, advice, or anything that is more than a simple greeting.`,
  "Any commerce-related request must call the tool. This includes store operations, business performance, revenue, orders, customers, products, inventory, marketing, traffic, retention, risk, and business analysis.",
  `If the full agent loop is needed, call the ${FAST_REPLY_GATE_TOOL_NAME} tool and set reply to the short user-facing acknowledgment that should be sent now.`,
  "When escalating, reply is required and must be a brief confirmation that you received the task and are starting it now.",
  "Do not ask follow-up questions in the escalation reply.",
  "Do not ask the user for clarification, files, screenshots, goals, style preferences, or extra details in the escalation reply.",
  "Bad escalation reply example: 'I can help. What are you selling and what style do you want?'",
  "Good escalation reply example: 'No problem, I'll help plan the store redesign now.'",
  "If more context is needed, the full agent can ask later after the handoff. The fast reply gate should only acknowledge and begin.",
  "Call the tool when the user asks for coding work, debugging, repository inspection, file changes, commands, tool use, reminders, workflows, business analysis, or anything that depends on deeper session/workspace state.",
  "If the message is a real question, default to calling the tool even if it looks answerable from general knowledge.",
  "If you are unsure, call the tool.",
  "Direct replies must stay brief and final. Escalation acknowledgments must stay brief and avoid claiming the task is already completed. Never mention routing or tools.",
].join("\n");

type FastReplyGateSuccess = {
  kind: "success";
  runId: string;
  runResult: EmbeddedPiRunResult;
  provider: string;
  model: string;
};

type FastReplyGateHandoff = {
  kind: "handoff";
  runId: string;
  provider: string;
  model: string;
  prefaceText: string;
  assistantRequestMetrics: ReturnType<typeof consumeCompletedAssistantRequestMetrics>;
};

export type FastReplyGateResult =
  | FastReplyGateSuccess
  | FastReplyGateHandoff
  | { kind: "continue" };

type SessionMessage = Parameters<SessionManager["appendMessage"]>[0];
type SessionAssistantMessage = Extract<SessionMessage, { role: "assistant" }>;
type SessionUsage = SessionAssistantMessage["usage"];

type SessionManagerLike = SessionManager & {
  getLeafEntry?: () =>
    | {
        type?: string;
        parentId?: string | null;
        message?: { role?: string };
      }
    | undefined;
  branch?: (id: string) => void;
  resetLeaf?: () => void;
};

function logFastGate(message: string, details?: Record<string, unknown>) {
  if (details && Object.keys(details).length > 0) {
    defaultRuntime.log(`[fast-gate] ${message}`, details);
    return;
  }
  defaultRuntime.log(`[fast-gate] ${message}`);
}

function buildGateExtraSystemPrompt(extraSystemPrompt?: string): string {
  void extraSystemPrompt;
  return FAST_REPLY_GATE_PROMPT;
}

type TranscriptMessageLike = {
  role?: string;
  content?: unknown;
  stopReason?: string;
};

type FastGateLoopTurn = {
  userText: string;
  assistantText: string;
};

function hasBustlyFastReplyConfig(run: FollowupRun["run"]): boolean {
  const provider = run.config?.models?.providers?.[BUSTLY_PROVIDER_ID];
  return Boolean(provider?.baseUrl?.trim() || (provider?.models?.length ?? 0) > 0);
}

function isRenderablePayload(payload: ReplyPayload): boolean {
  if (payload.isError) {
    return false;
  }
  if (payload.text?.trim()) {
    return true;
  }
  if (payload.mediaUrl?.trim()) {
    return true;
  }
  return payload.mediaUrls?.some((url) => url.trim().length > 0) ?? false;
}

function buildAssistantTranscriptText(payload: ReplyPayload): string {
  const parts: string[] = [];
  if (payload.text?.trim()) {
    parts.push(payload.text.trim());
  }
  const mediaUrls = [...(payload.mediaUrl ? [payload.mediaUrl] : []), ...(payload.mediaUrls ?? [])]
    .map((value) => value.trim())
    .filter(Boolean);
  for (const mediaUrl of mediaUrls) {
    parts.push(`[media attached: ${mediaUrl}]`);
  }
  return parts.join("\n");
}

function buildSessionUsage(usage?: {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  total?: number;
}): SessionUsage {
  const input = usage?.input ?? 0;
  const output = usage?.output ?? 0;
  const cacheRead = usage?.cacheRead ?? 0;
  const cacheWrite = usage?.cacheWrite ?? 0;
  const totalTokens = usage?.total ?? input + output + cacheRead + cacheWrite;
  return {
    input,
    output,
    cacheRead,
    cacheWrite,
    totalTokens,
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
    },
  };
}

function readMessageText(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((block) => {
      if (!block || typeof block !== "object") {
        return "";
      }
      if (
        (block as { type?: string }).type === "text" &&
        typeof (block as { text?: unknown }).text === "string"
      ) {
        return String((block as { text: string }).text).trim();
      }
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function readRecentTranscriptMessages(
  sessionFile: string,
  maxLines = 300,
): Promise<TranscriptMessageLike[]> {
  try {
    const raw = await fs.readFile(sessionFile, "utf-8");
    const lines = raw.split(/\r?\n/).filter(Boolean).slice(-maxLines);
    const messages: TranscriptMessageLike[] = [];
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as { type?: string; message?: TranscriptMessageLike };
        if (entry.type === "message" && entry.message && typeof entry.message === "object") {
          messages.push(entry.message);
        }
      } catch {
        // Ignore malformed transcript lines.
      }
    }
    return messages;
  } catch {
    return [];
  }
}

function extractRecentLoopTurns(
  messages: TranscriptMessageLike[],
  maxTurns = 2,
): FastGateLoopTurn[] {
  const turns: FastGateLoopTurn[] = [];
  let current: {
    userText: string;
    assistantText: string | null;
    hadLoopActivity: boolean;
  } | null = null;

  const flush = () => {
    if (!current) {
      return;
    }
    if (current.userText && current.assistantText && current.hadLoopActivity) {
      turns.push({
        userText: current.userText,
        assistantText: current.assistantText,
      });
    }
    current = null;
  };

  for (const message of messages) {
    const role = message.role?.trim().toLowerCase() ?? "";
    if (role === "user") {
      flush();
      const userText = readMessageText(message.content);
      current = userText
        ? {
            userText,
            assistantText: null,
            hadLoopActivity: false,
          }
        : null;
      continue;
    }
    if (!current) {
      continue;
    }
    if (role === "toolresult" || role === "tool_result" || role === "tool") {
      current.hadLoopActivity = true;
      continue;
    }
    if (role !== "assistant") {
      continue;
    }
    if ((message.stopReason ?? "").toLowerCase() === "tooluse") {
      current.hadLoopActivity = true;
    }
    if ((message.stopReason ?? "").toLowerCase() === "stop") {
      const assistantText = readMessageText(message.content);
      if (assistantText) {
        current.assistantText = assistantText;
      }
    }
  }
  flush();
  return turns.slice(-maxTurns);
}

function buildHistoryAssistantMessage(text: string, timestamp: number): AssistantMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: "openai-completions",
    provider: BUSTLY_PROVIDER_ID,
    model: "fast-gate-history",
    usage: buildSessionUsage(),
    stopReason: "stop",
    timestamp,
  };
}

async function buildFastGateMessages(params: {
  sessionFile: string;
  userText: string;
}): Promise<Message[]> {
  const recentMessages = await readRecentTranscriptMessages(params.sessionFile);
  const recentLoopTurns = extractRecentLoopTurns(recentMessages, 2);
  const now = Date.now();
  const contextMessages: Message[] = [];
  for (const [index, turn] of recentLoopTurns.entries()) {
    const timestampBase = now - (recentLoopTurns.length - index) * 2;
    contextMessages.push({
      role: "user",
      content: turn.userText,
      timestamp: timestampBase,
    });
    contextMessages.push(buildHistoryAssistantMessage(turn.assistantText, timestampBase + 1));
  }
  contextMessages.push({
    role: "user",
    content: params.userText,
    timestamp: now,
  });
  return contextMessages;
}

function trimTrailingOrphanedUser(sessionManager: SessionManagerLike) {
  const leafEntry = sessionManager.getLeafEntry?.();
  if (leafEntry?.type !== "message" || leafEntry.message?.role !== "user") {
    return;
  }
  if (leafEntry.parentId) {
    sessionManager.branch?.(leafEntry.parentId);
    return;
  }
  sessionManager.resetLeaf?.();
}

type FastGateToolCall = {
  id: string;
  name: string;
  arguments: string;
  reply?: string;
};

function extractToolReply(args: unknown): string | undefined {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return undefined;
  }
  const reply = (args as { reply?: unknown }).reply;
  return typeof reply === "string" && reply.trim() ? reply.trim() : undefined;
}

function extractFastGateToolCalls(event: AssistantMessageEvent): FastGateToolCall[] {
  if (event.type !== "toolcall_end" || event.toolCall.name !== FAST_REPLY_GATE_TOOL_NAME) {
    return [];
  }
  return [
    {
      id: event.toolCall.id,
      name: event.toolCall.name,
      arguments: JSON.stringify(event.toolCall.arguments ?? {}),
      reply: extractToolReply(event.toolCall.arguments),
    },
  ];
}

function extractAssistantText(message: AssistantMessage): string {
  return message.content
    .filter(
      (block): block is Extract<AssistantMessage["content"][number], { type: "text" }> =>
        block.type === "text",
    )
    .map((block) => block.text.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function detectLikelyChinese(text: string): boolean {
  return /[\u3400-\u9fff]/u.test(text);
}

function normalizeLightweightSocialText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\p{P}\p{S}\s]+/gu, " ")
    .trim();
}

function isLikelyLightweightSocialMessage(text: string): boolean {
  const normalized = normalizeLightweightSocialText(text);
  if (!normalized) {
    return false;
  }
  return [
    /^(?:hi|hello|hey|thanks|thank you|good morning|good afternoon|good evening)$/u,
    /^(?:你好|您好|嗨|哈喽|谢谢|多谢|早上好|上午好|中午好|下午好|晚上好)$/u,
  ].some((pattern) => pattern.test(normalized));
}

function buildFallbackHandoffPreface(userText: string): string {
  if (detectLikelyChinese(userText)) {
    return "我先快速看一下关键情况，马上给你结论。";
  }
  return "I'll quickly check the key signals and come back with the answer.";
}

function applyFastGatePayloadCompat(payload: unknown): void {
  if (!payload || typeof payload !== "object") {
    return;
  }
  const payloadObj = payload as Record<string, unknown>;
  delete payloadObj.reasoning_effort;
  payloadObj.reasoning = {
    ...(payloadObj.reasoning &&
    typeof payloadObj.reasoning === "object" &&
    !Array.isArray(payloadObj.reasoning)
      ? (payloadObj.reasoning as Record<string, unknown>)
      : {}),
    effort: "none",
  };
}

function summarizeFastGatePayloadCompat(payload: unknown): Record<string, unknown> | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  const payloadObj = payload as Record<string, unknown>;
  const reasoning =
    payloadObj.reasoning &&
    typeof payloadObj.reasoning === "object" &&
    !Array.isArray(payloadObj.reasoning)
      ? (payloadObj.reasoning as Record<string, unknown>)
      : undefined;
  return {
    hasReasoningField: Boolean(reasoning),
    reasoningEnabled: reasoning?.enabled,
    reasoningKeys: reasoning ? Object.keys(reasoning).toSorted() : [],
    hasReasoningEffortField: Object.hasOwn(payloadObj, "reasoning_effort"),
  };
}

export async function appendFastReplyTurnToSessionTranscript(params: {
  sessionFile: string;
  sessionId: string;
  workspaceDir: string;
  commandBody: string;
  payloads: ReplyPayload[];
  provider: string;
  model: string;
  timeoutMs: number;
  usage?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  };
}): Promise<void> {
  const assistantPayloads = params.payloads
    .filter(isRenderablePayload)
    .map(buildAssistantTranscriptText)
    .filter(Boolean);
  const userText = params.commandBody.trim();
  if (!userText && assistantPayloads.length === 0) {
    return;
  }

  const sessionLock = await acquireSessionWriteLock({
    sessionFile: params.sessionFile,
    timeoutMs: params.timeoutMs,
    maxHoldMs: resolveSessionLockMaxHoldFromTimeout({
      timeoutMs: params.timeoutMs,
    }),
  });

  try {
    const hadSessionFile = await fs
      .stat(params.sessionFile)
      .then(() => true)
      .catch(() => false);
    const sessionManager = SessionManager.open(params.sessionFile) as SessionManagerLike;
    await prepareSessionManagerForRun({
      sessionManager,
      sessionFile: params.sessionFile,
      hadSessionFile,
      sessionId: params.sessionId,
      cwd: params.workspaceDir,
    });
    trimTrailingOrphanedUser(sessionManager);

    const timestamp = Date.now();
    if (userText) {
      sessionManager.appendMessage({
        role: "user",
        content: [{ type: "text", text: userText }],
        timestamp,
      });
    }

    for (const assistantText of assistantPayloads) {
      const assistantMessage: SessionAssistantMessage = {
        role: "assistant",
        content: [{ type: "text", text: assistantText }],
        stopReason: "stop",
        api: "openai-completions",
        provider: params.provider,
        model: params.model,
        timestamp: Date.now(),
        usage: buildSessionUsage(params.usage),
      };
      sessionManager.appendMessage(assistantMessage);
    }
  } finally {
    await sessionLock.release();
  }
}

export async function runFastReplyGate(params: {
  commandBody: string;
  followupRun: FollowupRun;
  sessionCtx: TemplateContext;
  opts?: GetReplyOptions;
  onAssistantMessageStart?: () => Promise<void> | void;
  onPartialReply?: (payload: ReplyPayload) => Promise<void> | void;
}): Promise<FastReplyGateResult> {
  if (params.opts?.images?.length) {
    logFastGate("skip", {
      reason: "images_attached",
      sessionKey: params.followupRun.run.sessionKey,
    });
    return { kind: "continue" };
  }
  if (params.opts?.isHeartbeat) {
    logFastGate("skip", {
      reason: "heartbeat",
      sessionKey: params.followupRun.run.sessionKey,
    });
    return { kind: "continue" };
  }
  if (params.opts?.retryWithoutNewUser) {
    logFastGate("skip", {
      reason: "retry_without_new_user",
      sessionKey: params.followupRun.run.sessionKey,
    });
    return { kind: "continue" };
  }
  if (!hasBustlyFastReplyConfig(params.followupRun.run)) {
    logFastGate("skip", {
      reason: "missing_bustly_provider_config",
      sessionKey: params.followupRun.run.sessionKey,
    });
    return { kind: "continue" };
  }

  const runId = `${params.opts?.runId?.trim() || randomUUID()}-fast-gate`;
  const visibleRunId = params.opts?.runId?.trim() || runId;
  const metricsRunId = visibleRunId;
  const userText = params.commandBody.trim();
  if (!userText) {
    logFastGate("skip", {
      reason: "empty_user_text",
      runId,
      sessionKey: params.followupRun.run.sessionKey,
    });
    return { kind: "continue" };
  }
  const startedAt = Date.now();
  const contextMessages = await buildFastGateMessages({
    sessionFile: params.followupRun.run.sessionFile,
    userText,
  });
  logFastGate("start", {
    runId,
    sessionKey: params.followupRun.run.sessionKey,
    messageLength: userText.length,
    priorLoopTurns: Math.max(0, (contextMessages.length - 1) / 2),
  });

  try {
    const resolved = resolveModel(
      BUSTLY_PROVIDER_ID,
      BUSTLY_STANDARD_CHAT_MODEL_ID,
      params.followupRun.run.agentDir,
      params.followupRun.run.config,
    );
    if (!resolved.model) {
      logFastGate("skip", {
        reason: "model_unresolved",
        runId,
        sessionKey: params.followupRun.run.sessionKey,
      });
      return { kind: "continue" };
    }

    const apiKey = requireApiKey(
      await getApiKeyForModel({
        model: resolved.model,
        cfg: params.followupRun.run.config,
        agentDir: params.followupRun.run.agentDir,
      }),
      BUSTLY_PROVIDER_ID,
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FAST_REPLY_GATE_TIMEOUT_MS);
    const abortFromCaller = () => controller.abort();
    params.opts?.abortSignal?.addEventListener("abort", abortFromCaller, { once: true });
    const workspaceId = readBustlyOAuthState()?.user?.workspaceId?.trim() ?? "";
    const mergedHeaders = mergeBustlyRuntimeHeaders({
      modelHeaders: (resolved.model as { headers?: Record<string, string> }).headers,
      workspaceId,
      runId: visibleRunId,
    });

    let message: AssistantMessage;
    let assistantText = "";
    let pendingToolCalls: FastGateToolCall[] = [];
    let emittedAssistantStart = false;
    let emittedVisibleRunStart = false;
    let payloadCompatLogged = false;
    const ensureAssistantStart = async () => {
      if (emittedAssistantStart) {
        return;
      }
      emittedAssistantStart = true;
      await params.onAssistantMessageStart?.();
    };
    const ensureVisibleRunStart = async () => {
      if (emittedVisibleRunStart) {
        return;
      }
      emittedVisibleRunStart = true;
      params.opts?.onAgentRunStart?.(visibleRunId);
      emitAgentEvent({
        runId: visibleRunId,
        sessionKey: params.followupRun.run.sessionKey,
        stream: "lifecycle",
        data: {
          phase: "start",
          startedAt,
        },
      });
    };
    const emitVisibleAssistantDelta = async (delta: string, text: string) => {
      if (!delta) {
        return;
      }
      await ensureAssistantStart();
      await ensureVisibleRunStart();
      emitAgentEvent({
        runId: visibleRunId,
        sessionKey: params.followupRun.run.sessionKey,
        stream: "assistant",
        data: {
          text,
          delta,
        },
      });
      await params.onPartialReply?.({
        text: delta,
      });
    };
    const emitVisibleAssistantSegmentBreak = async () => {
      if (!emittedVisibleRunStart) {
        return;
      }
      emitAgentEvent({
        runId: visibleRunId,
        sessionKey: params.followupRun.run.sessionKey,
        stream: "assistant",
        data: {
          segmentBreak: true,
        },
      });
    };
    try {
      const eventStream = await Promise.resolve(
        runTrackedModelRequest({
          runId: metricsRunId,
          request: (model, context, options) =>
            stream(model, context, {
              ...options,
              onPayload: (payload) => {
                applyFastGatePayloadCompat(payload);
                if (!payloadCompatLogged) {
                  payloadCompatLogged = true;
                  logFastGate("payload", {
                    runId,
                    visibleRunId,
                    sessionKey: params.followupRun.run.sessionKey,
                    ...summarizeFastGatePayloadCompat(payload),
                  });
                }
                (options as { onPayload?: (payload: unknown) => void } | undefined)?.onPayload?.(
                  payload,
                );
              },
            }),
          model: {
            ...resolved.model,
            reasoning: false,
          },
          context: {
            systemPrompt: buildGateExtraSystemPrompt(params.followupRun.run.extraSystemPrompt),
            messages: contextMessages,
            tools: [FAST_REPLY_GATE_TOOL],
          },
          options: {
            apiKey,
            maxTokens: FAST_REPLY_GATE_MAX_TOKENS,
            signal: controller.signal,
            toolChoice: "auto",
            headers: Object.keys(mergedHeaders).length > 0 ? mergedHeaders : undefined,
          },
          payloadLog: {
            env: process.env,
            sessionKey: params.followupRun.run.sessionKey,
            provider: resolved.model.provider,
            modelId: resolved.model.id,
            modelApi: resolved.model.api,
            workspaceDir: params.followupRun.run.workspaceDir,
          },
        }),
      );
      for await (const event of eventStream) {
        if (event.type === "text_delta") {
          assistantText += event.delta;
          await emitVisibleAssistantDelta(event.delta, assistantText);
          continue;
        }
        if (event.type === "text_end" && event.content && event.content !== assistantText) {
          const delta = event.content.startsWith(assistantText)
            ? event.content.slice(assistantText.length)
            : event.content;
          assistantText = event.content;
          await emitVisibleAssistantDelta(delta, assistantText);
          continue;
        }
        pendingToolCalls = [...pendingToolCalls, ...extractFastGateToolCalls(event)];
      }
      message = await eventStream.result();
    } finally {
      clearTimeout(timeout);
      params.opts?.abortSignal?.removeEventListener("abort", abortFromCaller);
    }

    if (message.stopReason === "aborted" || message.stopReason === "error") {
      logFastGate("fail-open", {
        reason: message.stopReason,
        runId,
        visibleRunId,
        sessionKey: params.followupRun.run.sessionKey,
        durationMs: Date.now() - startedAt,
        streamedTextLength: assistantText.length,
        messageContentTypes: message.content.map((block) => block.type),
      });
      return { kind: "continue" };
    }

    if (pendingToolCalls.length === 0) {
      pendingToolCalls = message.content
        .filter(
          (block): block is Extract<AssistantMessage["content"][number], { type: "toolCall" }> =>
            block.type === "toolCall" && block.name === FAST_REPLY_GATE_TOOL_NAME,
        )
        .map((block) => ({
          id: block.id,
          name: block.name,
          arguments: JSON.stringify(block.arguments ?? {}),
          reply: extractToolReply(block.arguments),
        }));
    }

    const extractedMessageText = assistantText || extractAssistantText(message);

    if (pendingToolCalls.length > 0) {
      let text = extractedMessageText || pendingToolCalls.find((call) => call.reply)?.reply;
      let fallbackPrefaceUsed = false;
      if (!text) {
        text = buildFallbackHandoffPreface(userText);
        fallbackPrefaceUsed = true;
      }
      if (!assistantText) {
        assistantText = text;
        await emitVisibleAssistantDelta(text, text);
      }
      await emitVisibleAssistantSegmentBreak();
      const assistantRequestMetrics = consumeCompletedAssistantRequestMetrics(metricsRunId);
      logFastGate("escalate", {
        reason: "tool_call",
        runId,
        visibleRunId,
        sessionKey: params.followupRun.run.sessionKey,
        pendingToolCalls,
        durationMs: Date.now() - startedAt,
        textLength: text.length,
        fallbackPrefaceUsed,
        messageContentTypes: message.content.map((block) => block.type),
      });
      return {
        kind: "handoff",
        runId: visibleRunId,
        provider: BUSTLY_PROVIDER_ID,
        model: BUSTLY_STANDARD_CHAT_MODEL_ID,
        prefaceText: text,
        assistantRequestMetrics,
      };
    }

    const text = extractedMessageText;
    if (!text) {
      logFastGate("fail-open", {
        reason: "empty_text_response",
        runId,
        visibleRunId,
        sessionKey: params.followupRun.run.sessionKey,
        durationMs: Date.now() - startedAt,
        messageContentTypes: message.content.map((block) => block.type),
      });
      return { kind: "continue" };
    }

    if (!isLikelyLightweightSocialMessage(userText)) {
      if (!assistantText) {
        assistantText = text;
        await emitVisibleAssistantDelta(text, text);
      }
      await emitVisibleAssistantSegmentBreak();
      const assistantRequestMetrics = consumeCompletedAssistantRequestMetrics(metricsRunId);
      logFastGate("escalate", {
        reason: "non_social_text_preface",
        runId,
        visibleRunId,
        sessionKey: params.followupRun.run.sessionKey,
        durationMs: Date.now() - startedAt,
        textLength: text.length,
        stopReason: message.stopReason,
        messageContentTypes: message.content.map((block) => block.type),
      });
      return {
        kind: "handoff",
        runId: visibleRunId,
        provider: BUSTLY_PROVIDER_ID,
        model: BUSTLY_STANDARD_CHAT_MODEL_ID,
        prefaceText: text,
        assistantRequestMetrics,
      };
    }

    if (!assistantText) {
      assistantText = text;
      await emitVisibleAssistantDelta(text, text);
    }

    const usage = {
      input: message.usage.input,
      output: message.usage.output,
      cacheRead: message.usage.cacheRead,
      cacheWrite: message.usage.cacheWrite,
      total: message.usage.totalTokens,
    };
    const assistantRequestMetrics = consumeCompletedAssistantRequestMetrics(metricsRunId);
    logFastGate("success", {
      runId,
      visibleRunId,
      sessionKey: params.followupRun.run.sessionKey,
      durationMs: Date.now() - startedAt,
      stopReason: message.stopReason,
      textLength: text.length,
      messageContentTypes: message.content.map((block) => block.type),
    });
    if (emittedVisibleRunStart) {
      emitAgentEvent({
        runId: visibleRunId,
        sessionKey: params.followupRun.run.sessionKey,
        stream: "lifecycle",
        data: {
          phase: "end",
          startedAt,
          endedAt: Date.now(),
          aborted: false,
        },
      });
    }
    return {
      kind: "success",
      runId: visibleRunId,
      runResult: {
        payloads: [{ text }],
        meta: {
          durationMs: Date.now() - startedAt,
          aborted: false,
          hasAssistantMessage: true,
          stopReason: message.stopReason,
          assistantRequestMetrics,
          agentMeta: {
            sessionId: `${params.followupRun.run.sessionId}-fast-gate`,
            provider: BUSTLY_PROVIDER_ID,
            model: BUSTLY_STANDARD_CHAT_MODEL_ID,
            usage,
            lastCallUsage: usage,
          },
        },
      },
      provider: BUSTLY_PROVIDER_ID,
      model: BUSTLY_STANDARD_CHAT_MODEL_ID,
    };
  } catch (error) {
    logFastGate("fail-open", {
      reason: "exception",
      runId,
      visibleRunId,
      sessionKey: params.followupRun.run.sessionKey,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: "continue" };
  }
}
