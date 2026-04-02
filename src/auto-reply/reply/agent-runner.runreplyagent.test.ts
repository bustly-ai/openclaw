import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type AssistantMessageEvent,
} from "@mariozechner/pi-ai";
import type { SessionEntry } from "../../config/sessions.js";
import type { TypingMode } from "../../config/types.js";
import { resetAssistantRequestMetricsForTest } from "../../infra/assistant-request-metrics.js";
import type { TemplateContext } from "../templating.js";
import type { GetReplyOptions } from "../types.js";
import * as sessions from "../../config/sessions.js";
import { withStateDirEnv } from "../../test-helpers/state-dir-env.js";
import { enqueueFollowupRun, type FollowupRun, type QueueSettings } from "./queue.js";
import { createMockTypingController } from "./test-helpers.js";

type AgentRunParams = {
  onPartialReply?: (payload: { text?: string }) => Promise<void> | void;
  onAssistantMessageStart?: () => Promise<void> | void;
  onReasoningStream?: (payload: { text?: string }) => Promise<void> | void;
  onBlockReply?: (payload: { text?: string; mediaUrls?: string[] }) => Promise<void> | void;
  onToolResult?: (payload: { text?: string; mediaUrls?: string[] }) => Promise<void> | void;
  onAgentEvent?: (evt: { stream: string; data: Record<string, unknown> }) => void;
};

type EmbeddedRunParams = {
  prompt?: string;
  extraSystemPrompt?: string;
  onAgentEvent?: (evt: { stream?: string; data?: { phase?: string; willRetry?: boolean } }) => void;
};

const state = vi.hoisted(() => ({
  runEmbeddedPiAgentMock: vi.fn(),
  runCliAgentMock: vi.fn(),
  completeMock: vi.fn(),
  streamMock: vi.fn(),
  resolveModelMock: vi.fn(),
  getApiKeyForModelMock: vi.fn(),
}));

let modelFallbackModule: typeof import("../../agents/model-fallback.js");
let onAgentEvent: typeof import("../../infra/agent-events.js").onAgentEvent;

let runReplyAgentPromise:
  | Promise<(typeof import("./agent-runner.js"))["runReplyAgent"]>
  | undefined;

async function getRunReplyAgent() {
  if (!runReplyAgentPromise) {
    runReplyAgentPromise = import("./agent-runner.js").then((m) => m.runReplyAgent);
  }
  return await runReplyAgentPromise;
}

vi.mock("../../agents/model-fallback.js", () => ({
  runWithModelFallback: async ({
    provider,
    model,
    run,
  }: {
    provider: string;
    model: string;
    run: (provider: string, model: string) => Promise<unknown>;
  }) => ({
    result: await run(provider, model),
    provider,
    model,
    attempts: [],
  }),
}));

vi.mock("../../agents/pi-embedded.js", () => ({
  queueEmbeddedPiMessage: vi.fn().mockReturnValue(false),
  runEmbeddedPiAgent: (params: unknown) => state.runEmbeddedPiAgentMock(params),
}));

vi.mock("@mariozechner/pi-ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mariozechner/pi-ai")>();
  return {
    ...actual,
    complete: (model: unknown, context: unknown, options: unknown) =>
      state.completeMock(model, context, options),
    stream: (model: unknown, context: unknown, options: unknown) =>
      state.streamMock(model, context, options),
  };
});

vi.mock("../../agents/pi-embedded-runner/model.js", () => ({
  resolveModel: (
    provider: string,
    model: string,
    agentDir: string | undefined,
    cfg: unknown,
  ) => state.resolveModelMock(provider, model, agentDir, cfg),
}));

vi.mock("../../agents/model-auth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../agents/model-auth.js")>();
  return {
    ...actual,
    getApiKeyForModel: (params: unknown) => state.getApiKeyForModelMock(params),
    requireApiKey: (auth: { apiKey?: string }) => auth.apiKey ?? "",
  };
});

vi.mock("../../agents/cli-runner.js", () => ({
  runCliAgent: (params: unknown) => state.runCliAgentMock(params),
}));

vi.mock("./queue.js", () => ({
  enqueueFollowupRun: vi.fn(),
  scheduleFollowupDrain: vi.fn(),
}));

beforeAll(async () => {
  // Avoid attributing the initial agent-runner import cost to the first test case.
  modelFallbackModule = await import("../../agents/model-fallback.js");
  ({ onAgentEvent } = await import("../../infra/agent-events.js"));
  await getRunReplyAgent();
});

beforeEach(() => {
  state.runEmbeddedPiAgentMock.mockClear();
  state.runCliAgentMock.mockClear();
  state.completeMock.mockClear();
  state.streamMock.mockClear();
  state.resolveModelMock.mockReset();
  state.getApiKeyForModelMock.mockReset();
  resetAssistantRequestMetricsForTest();
  vi.mocked(enqueueFollowupRun).mockClear();
  vi.stubEnv("OPENCLAW_TEST_FAST", "1");
  state.resolveModelMock.mockReturnValue({
    model: {
      id: "chat.standard",
      name: "Bustly Standard",
      api: "openai-completions",
      provider: "bustly",
      baseUrl: "https://gw.bustly.ai/api/v1",
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000,
      maxTokens: 8192,
    },
    authStorage: {},
    modelRegistry: {},
  });
  state.getApiKeyForModelMock.mockResolvedValue({
    apiKey: "test-key",
    mode: "api-key",
  });
});

function createMinimalRun(params?: {
  opts?: GetReplyOptions;
  resolvedVerboseLevel?: "off" | "on";
  sessionStore?: Record<string, SessionEntry>;
  sessionEntry?: SessionEntry;
  sessionKey?: string;
  storePath?: string;
  typingMode?: TypingMode;
  blockStreamingEnabled?: boolean;
  isActive?: boolean;
  shouldFollowup?: boolean;
  resolvedQueueMode?: string;
  runOverrides?: Partial<FollowupRun["run"]>;
}) {
  const typing = createMockTypingController();
  const opts = params?.opts;
  const sessionCtx = {
    Provider: "whatsapp",
    MessageSid: "msg",
  } as unknown as TemplateContext;
  const resolvedQueue = {
    mode: params?.resolvedQueueMode ?? "interrupt",
  } as unknown as QueueSettings;
  const sessionKey = params?.sessionKey ?? "main";
  const followupRun = {
    prompt: "hello",
    summaryLine: "hello",
    enqueuedAt: Date.now(),
    run: {
      sessionId: "session",
      sessionKey,
      messageProvider: "whatsapp",
      sessionFile: "/tmp/session.jsonl",
      workspaceDir: "/tmp",
      config: {},
      skillsSnapshot: {},
      provider: "anthropic",
      model: "claude",
      thinkLevel: "low",
      verboseLevel: params?.resolvedVerboseLevel ?? "off",
      elevatedLevel: "off",
      bashElevated: {
        enabled: false,
        allowed: false,
        defaultLevel: "off",
      },
      timeoutMs: 1_000,
      blockReplyBreak: "message_end",
      ...params?.runOverrides,
    },
  } as unknown as FollowupRun;

  return {
    typing,
    opts,
    run: async () => {
      const runReplyAgent = await getRunReplyAgent();
      return runReplyAgent({
        commandBody: "hello",
        followupRun,
        queueKey: "main",
        resolvedQueue,
        shouldSteer: false,
        shouldFollowup: params?.shouldFollowup ?? false,
        isActive: params?.isActive ?? false,
        isStreaming: false,
        opts,
        typing,
        sessionEntry: params?.sessionEntry,
        sessionStore: params?.sessionStore,
        sessionKey,
        storePath: params?.storePath,
        sessionCtx,
        defaultModel: "anthropic/claude-opus-4-5",
        resolvedVerboseLevel: params?.resolvedVerboseLevel ?? "off",
        isNewSession: false,
        blockStreamingEnabled: params?.blockStreamingEnabled ?? false,
        resolvedBlockStreamingBreak: "message_end",
        shouldInjectGroupIntro: false,
        typingMode: params?.typingMode ?? "instant",
      });
    },
  };
}

function createMockAssistantStream(
  events: AssistantMessageEvent[],
  result?: AssistantMessage,
) {
  const stream = createAssistantMessageEventStream();
  queueMicrotask(() => {
    for (const event of events) {
      stream.push(event);
    }
    if (result) {
      stream.end(result);
    }
  });
  return stream;
}

async function waitForFileText(filePath: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      return await fs.readFile(filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for payload log at ${filePath}`);
}

async function seedSessionStore(params: {
  storePath: string;
  sessionKey: string;
  entry: Record<string, unknown>;
}) {
  await fs.mkdir(path.dirname(params.storePath), { recursive: true });
  await fs.writeFile(
    params.storePath,
    JSON.stringify({ [params.sessionKey]: params.entry }, null, 2),
    "utf-8",
  );
}

async function readTranscriptMessages(sessionFile: string) {
  const raw = await fs.readFile(sessionFile, "utf-8");
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { type?: string; message?: { role?: string; content?: unknown } })
    .filter((entry) => entry.type === "message")
    .map((entry) => entry.message ?? {});
}

function readTextContent(content: unknown): string | undefined {
  if (!Array.isArray(content)) {
    return undefined;
  }
  const first = content[0] as { type?: string; text?: string } | undefined;
  return first?.type === "text" ? first.text : undefined;
}

function createBaseRun(params: {
  storePath: string;
  sessionEntry: Record<string, unknown>;
  config?: Record<string, unknown>;
  runOverrides?: Partial<FollowupRun["run"]>;
}) {
  const typing = createMockTypingController();
  const sessionCtx = {
    Provider: "whatsapp",
    OriginatingTo: "+15550001111",
    AccountId: "primary",
    MessageSid: "msg",
  } as unknown as TemplateContext;
  const resolvedQueue = { mode: "interrupt" } as unknown as QueueSettings;
  const followupRun = {
    prompt: "hello",
    summaryLine: "hello",
    enqueuedAt: Date.now(),
    run: {
      agentId: "main",
      agentDir: "/tmp/agent",
      sessionId: "session",
      sessionKey: "main",
      messageProvider: "whatsapp",
      sessionFile: "/tmp/session.jsonl",
      workspaceDir: "/tmp",
      config: params.config ?? {},
      skillsSnapshot: {},
      provider: "anthropic",
      model: "claude",
      thinkLevel: "low",
      verboseLevel: "off",
      elevatedLevel: "off",
      bashElevated: {
        enabled: false,
        allowed: false,
        defaultLevel: "off",
      },
      timeoutMs: 1_000,
      blockReplyBreak: "message_end",
    },
  } as unknown as FollowupRun;
  const run = {
    ...followupRun.run,
    ...params.runOverrides,
    config: params.config ?? followupRun.run.config,
  };

  return {
    typing,
    sessionCtx,
    resolvedQueue,
    followupRun: { ...followupRun, run },
  };
}

async function runReplyAgentWithBase(params: {
  baseRun: ReturnType<typeof createBaseRun>;
  storePath: string;
  sessionKey: string;
  sessionEntry: SessionEntry;
  commandBody: string;
  typingMode?: "instant";
}): Promise<void> {
  const runReplyAgent = await getRunReplyAgent();
  const { typing, sessionCtx, resolvedQueue, followupRun } = params.baseRun;
  await runReplyAgent({
    commandBody: params.commandBody,
    followupRun,
    queueKey: params.sessionKey,
    resolvedQueue,
    shouldSteer: false,
    shouldFollowup: false,
    isActive: false,
    isStreaming: false,
    typing,
    sessionCtx,
    sessionEntry: params.sessionEntry,
    sessionStore: { [params.sessionKey]: params.sessionEntry } as Record<string, SessionEntry>,
    sessionKey: params.sessionKey,
    storePath: params.storePath,
    defaultModel: "anthropic/claude-opus-4-5",
    agentCfgContextTokens: 100_000,
    resolvedVerboseLevel: "off",
    isNewSession: false,
    blockStreamingEnabled: false,
    resolvedBlockStreamingBreak: "message_end",
    shouldInjectGroupIntro: false,
    typingMode: params.typingMode ?? "instant",
  });
}

describe("runReplyAgent heartbeat followup guard", () => {
  it("drops heartbeat runs when another run is active", async () => {
    const { run, typing } = createMinimalRun({
      opts: { isHeartbeat: true },
      isActive: true,
      shouldFollowup: true,
      resolvedQueueMode: "collect",
    });

    const result = await run();

    expect(result).toBeUndefined();
    expect(vi.mocked(enqueueFollowupRun)).not.toHaveBeenCalled();
    expect(state.runEmbeddedPiAgentMock).not.toHaveBeenCalled();
    expect(typing.cleanup).toHaveBeenCalledTimes(1);
  });

  it("still enqueues non-heartbeat runs when another run is active", async () => {
    const { run } = createMinimalRun({
      opts: { isHeartbeat: false },
      isActive: true,
      shouldFollowup: true,
      resolvedQueueMode: "collect",
    });

    const result = await run();

    expect(result).toBeUndefined();
    expect(vi.mocked(enqueueFollowupRun)).toHaveBeenCalledTimes(1);
    expect(state.runEmbeddedPiAgentMock).not.toHaveBeenCalled();
  });
});

describe("runReplyAgent fast reply gate", () => {
  const bustlyConfig = {
    models: {
      providers: {
        bustly: {
          baseUrl: "https://gw.bustly.ai/api/v1",
          models: [],
        },
      },
    },
  };

  it("returns direct fast replies from bustly standard without entering the main agent loop", async () => {
    const tempDir = await fs.mkdtemp(path.join(tmpdir(), "openclaw-fast-gate-"));
    const sessionFile = path.join(tempDir, "session.jsonl");
    const onAgentRunSettled = vi.fn();
    const onPartialReply = vi.fn();
    const onAssistantMessageStart = vi.fn();
    const streamedMessage: AssistantMessage = {
      role: "assistant",
      content: [{ type: "text", text: "Quick answer" }],
      api: "openai-completions",
      provider: "bustly",
      model: "chat.standard",
      usage: {
        input: 12,
        output: 8,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 20,
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0,
        },
      },
      stopReason: "stop",
      timestamp: Date.now(),
    };
    state.streamMock.mockReturnValueOnce(
      createMockAssistantStream(
        [
          {
            type: "start",
            partial: {
              ...streamedMessage,
              content: [],
            },
          },
          {
            type: "text_start",
            contentIndex: 0,
            partial: {
              ...streamedMessage,
              content: [{ type: "text", text: "" }],
            },
          },
          {
            type: "text_delta",
            contentIndex: 0,
            delta: "Quick",
            partial: {
              ...streamedMessage,
              content: [{ type: "text", text: "Quick" }],
            },
          },
          {
            type: "text_delta",
            contentIndex: 0,
            delta: " answer",
            partial: streamedMessage,
          },
          {
            type: "text_end",
            contentIndex: 0,
            content: "Quick answer",
            partial: streamedMessage,
          },
          {
            type: "done",
            reason: "stop",
            message: streamedMessage,
          },
        ],
        streamedMessage,
      ),
    );

    const { run } = createMinimalRun({
      opts: {
        runId: "run-fast-gate",
        onAgentRunSettled,
        onPartialReply,
        onAssistantMessageStart,
      },
      runOverrides: {
        sessionFile,
        workspaceDir: tempDir,
        config: bustlyConfig,
        extraSystemPrompt: "HEAVY_CTX_SHOULD_NOT_BE_INCLUDED",
      },
    });
    const result = await run();

    expect(result).toMatchObject({ text: "Quick answer" });
    expect(state.streamMock).toHaveBeenCalledTimes(1);
    expect(state.runEmbeddedPiAgentMock).not.toHaveBeenCalled();
    expect(state.streamMock.mock.calls[0]?.[0]).toMatchObject({
      provider: "bustly",
      id: "chat.standard",
      reasoning: false,
    });
    expect(state.streamMock.mock.calls[0]?.[1]).toMatchObject({
      tools: [expect.objectContaining({ name: "enter_agent_loop" })],
      messages: [expect.objectContaining({ role: "user", content: "hello" })],
    });
    expect(state.streamMock.mock.calls[0]?.[1]).toMatchObject({
      systemPrompt: expect.stringContaining("You are the fast reply gate for inbound messages."),
    });
    expect(String(state.streamMock.mock.calls[0]?.[1]?.systemPrompt ?? "")).not.toContain(
      "HEAVY_CTX_SHOULD_NOT_BE_INCLUDED",
    );
    const fastGatePayload = { reasoning_effort: "high" } as Record<string, unknown>;
    const onPayload = state.streamMock.mock.calls[0]?.[2]?.onPayload as
      | ((payload: unknown) => void)
      | undefined;
    expect(onPayload).toBeTypeOf("function");
    onPayload?.(fastGatePayload);
    expect(fastGatePayload).toEqual({
      reasoning: {
        effort: "none",
      },
    });
    expect(onAssistantMessageStart).toHaveBeenCalledTimes(1);
    expect(onPartialReply).toHaveBeenNthCalledWith(1, {
      text: "Quick",
      mediaUrls: undefined,
    });
    expect(onPartialReply).toHaveBeenNthCalledWith(2, {
      text: " answer",
      mediaUrls: undefined,
    });
    expect(onAgentRunSettled).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: expect.stringMatching(/-fast-gate$/),
        aborted: false,
        hasAssistantMessage: true,
        assistantRequestMetrics: [
          expect.objectContaining({
            ttftMs: expect.any(Number),
            ttlrMs: expect.any(Number),
          }),
        ],
      }),
    );

    const messages = await readTranscriptMessages(sessionFile);
    expect(messages.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(readTextContent(messages[0]?.content)).toBe("hello");
    expect(readTextContent(messages[1]?.content)).toBe("Quick answer");
  });

  it("logs the fast gate request payload after reasoning compat has been applied", async () => {
    await withStateDirEnv("openclaw-fast-gate-payload-", async ({ stateDir }) => {
      vi.stubEnv("OPENCLAW_PAYLOAD_LOG", "1");

      const tempDir = await fs.mkdtemp(path.join(tmpdir(), "openclaw-fast-gate-payload-"));
      const sessionFile = path.join(tempDir, "session.jsonl");
      const streamedMessage: AssistantMessage = {
        role: "assistant",
        content: [{ type: "text", text: "Quick answer" }],
        api: "openai-completions",
        provider: "bustly",
        model: "chat.standard",
        usage: {
          input: 12,
          output: 8,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 20,
          cost: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            total: 0,
          },
        },
        stopReason: "stop",
        timestamp: Date.now(),
      };

      state.streamMock.mockImplementationOnce((_model, _context, options) => {
        const payload = {
          model: "chat.standard",
          messages: [{ role: "user", content: "hello" }],
          stream: true,
          stream_options: { include_usage: true },
          store: false,
          max_completion_tokens: 512,
          tools: [{ type: "function", function: { name: "enter_agent_loop" } }],
          tool_choice: "auto",
          reasoning_effort: "high",
        } as Record<string, unknown>;
        (options as { onPayload?: (payload: unknown) => void } | undefined)?.onPayload?.(payload);
        return createMockAssistantStream(
          [
            {
              type: "done",
              reason: "stop",
              message: streamedMessage,
            },
          ],
          streamedMessage,
        );
      });

      const { run } = createMinimalRun({
        opts: {
          runId: "run-fast-gate-payload",
        },
        runOverrides: {
          sessionFile,
          workspaceDir: tempDir,
          config: bustlyConfig,
        },
      });

      await run();

      const payloadLogPath = path.join(stateDir, "logs", "model-payload.jsonl");
      const fileText = await waitForFileText(payloadLogPath);
      const lines = fileText
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      const requestLine = lines.find((line) => line.stage === "request");

      expect(requestLine).toBeTruthy();
      expect(requestLine.request.request).toMatchObject({
        reasoning: {
          effort: "none",
        },
      });
      expect(requestLine.request.request).not.toHaveProperty("reasoning_effort");
    });

    vi.unstubAllEnvs();
  });

  it("streams a short preface and continues into the main agent loop when the fast gate requests escalation", async () => {
    const tempDir = await fs.mkdtemp(path.join(tmpdir(), "openclaw-fast-gate-handoff-"));
    const sessionFile = path.join(tempDir, "session.jsonl");
    const fastGateEvents: Array<{ stream: string; data?: Record<string, unknown> }> = [];
    const onAgentRunSettled = vi.fn();
    const onPartialReply = vi.fn();
    const onAssistantMessageStart = vi.fn();
    const toolUseMessage: AssistantMessage = {
      role: "assistant",
      content: [
        {
          type: "text",
          text: "I'm checking the latest business changes now.",
        },
        {
          type: "toolCall",
          id: "call_1",
          name: "enter_agent_loop",
          arguments: { reply: "I'm checking the latest business changes now." },
        },
      ],
      api: "openai-completions",
      provider: "bustly",
      model: "chat.standard",
      usage: {
        input: 12,
        output: 8,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 20,
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0,
        },
      },
      stopReason: "toolUse",
      timestamp: Date.now(),
    };
    state.streamMock.mockReturnValueOnce(
      createMockAssistantStream(
        [
          {
            type: "start",
            partial: {
              ...toolUseMessage,
              content: [],
            },
          },
          {
            type: "text_start",
            contentIndex: 0,
            partial: {
              ...toolUseMessage,
              content: [{ type: "text", text: "" }],
            },
          },
          {
            type: "text_delta",
            contentIndex: 0,
            delta: "I'm checking",
            partial: {
              ...toolUseMessage,
              content: [{ type: "text", text: "I'm checking" }],
            },
          },
          {
            type: "text_delta",
            contentIndex: 0,
            delta: " the latest business changes now.",
            partial: {
              ...toolUseMessage,
              content: [toolUseMessage.content[0] as Extract<
                AssistantMessage["content"][number],
                { type: "text" }
              >],
            },
          },
          {
            type: "toolcall_start",
            contentIndex: 1,
            partial: {
              ...toolUseMessage,
              content: [
                toolUseMessage.content[0] as Extract<
                  AssistantMessage["content"][number],
                  { type: "text" }
                >,
              ],
            },
          },
          {
            type: "toolcall_end",
            contentIndex: 1,
            toolCall: toolUseMessage.content[1] as Extract<
              AssistantMessage["content"][number],
              { type: "toolCall" }
            >,
            partial: toolUseMessage,
          },
          {
            type: "done",
            reason: "toolUse",
            message: toolUseMessage,
          },
        ],
        toolUseMessage,
      ),
    );
    state.runEmbeddedPiAgentMock.mockResolvedValueOnce({
      payloads: [{ text: "Main loop answer" }],
      meta: {
        hasAssistantMessage: true,
        agentMeta: {
          provider: "anthropic",
          model: "claude",
        },
      },
    });

    const { run } = createMinimalRun({
      opts: {
        onPartialReply,
        onAssistantMessageStart,
        onAgentRunSettled,
      },
      runOverrides: {
        sessionFile,
        workspaceDir: tempDir,
        config: bustlyConfig,
      },
    });
    const off = onAgentEvent((evt) => {
      if (evt.runId.endsWith("-fast-gate")) {
        fastGateEvents.push({
          stream: evt.stream,
          data: evt.data,
        });
      }
    });
    const result = await run();
    off();

    expect(result).toMatchObject({ text: "Main loop answer" });
    expect(state.streamMock).toHaveBeenCalledTimes(1);
    expect(state.runEmbeddedPiAgentMock).toHaveBeenCalledTimes(1);
    expect(fastGateEvents.map((evt) => evt.stream)).toEqual([
      "lifecycle",
      "assistant",
      "assistant",
      "assistant",
    ]);
    expect(fastGateEvents[0]?.data).toMatchObject({ phase: "start" });
    expect(fastGateEvents[1]?.data).toMatchObject({
      text: "I'm checking",
      delta: "I'm checking",
    });
    expect(fastGateEvents[2]?.data).toMatchObject({
      text: "I'm checking the latest business changes now.",
      delta: " the latest business changes now.",
    });
    expect(fastGateEvents[3]?.data).toMatchObject({
      segmentBreak: true,
    });
    expect(onAssistantMessageStart).toHaveBeenCalledTimes(1);
    expect(onPartialReply).toHaveBeenNthCalledWith(1, {
      text: "I'm checking",
      mediaUrls: undefined,
    });
    expect(onPartialReply).toHaveBeenNthCalledWith(2, {
      text: " the latest business changes now.",
      mediaUrls: undefined,
    });
    expect(onAgentRunSettled).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: expect.stringMatching(/-fast-gate$/),
        aborted: false,
        hasAssistantMessage: true,
        assistantRequestMetrics: [
          expect.objectContaining({
            ttftMs: expect.any(Number),
            ttlrMs: expect.any(Number),
          }),
        ],
      }),
    );
    expect(state.runEmbeddedPiAgentMock.mock.calls[0]?.[0]).toMatchObject({
      provider: "anthropic",
      model: "claude",
    });
    const messages = await readTranscriptMessages(sessionFile);
    expect(messages.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(readTextContent(messages[0]?.content)).toBe("hello");
    expect(readTextContent(messages[1]?.content)).toBe("I'm checking the latest business changes now.");
  });

  it("uses the fast gate tool reply when the model escalates without assistant text", async () => {
    const onPartialReply = vi.fn();
    const onAssistantMessageStart = vi.fn();
    const toolUseMessage: AssistantMessage = {
      role: "assistant",
      content: [
        {
          type: "toolCall",
          id: "call_1",
          name: "enter_agent_loop",
          arguments: { reply: "我先看一下，马上回来。" },
        },
      ],
      api: "openai-completions",
      provider: "bustly",
      model: "chat.standard",
      usage: {
        input: 12,
        output: 8,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 20,
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0,
        },
      },
      stopReason: "toolUse",
      timestamp: Date.now(),
    };
    state.streamMock.mockReturnValueOnce(
      createMockAssistantStream(
        [
          {
            type: "start",
            partial: {
              ...toolUseMessage,
              content: [],
            },
          },
          {
            type: "toolcall_start",
            contentIndex: 0,
            partial: {
              ...toolUseMessage,
              content: [],
            },
          },
          {
            type: "toolcall_end",
            contentIndex: 0,
            toolCall: toolUseMessage.content[0] as Extract<
              AssistantMessage["content"][number],
              { type: "toolCall" }
            >,
            partial: toolUseMessage,
          },
          {
            type: "done",
            reason: "toolUse",
            message: toolUseMessage,
          },
        ],
        toolUseMessage,
      ),
    );
    state.runEmbeddedPiAgentMock.mockResolvedValueOnce({
      payloads: [{ text: "Main loop answer" }],
      meta: {
        hasAssistantMessage: true,
        agentMeta: {
          provider: "anthropic",
          model: "claude",
        },
      },
    });

    const { run } = createMinimalRun({
      opts: {
        onPartialReply,
        onAssistantMessageStart,
      },
      runOverrides: {
        config: bustlyConfig,
      },
    });

    const result = await run();

    expect(result).toMatchObject({ text: "Main loop answer" });
    expect(onAssistantMessageStart).toHaveBeenCalledTimes(1);
    expect(onPartialReply).toHaveBeenCalledWith({
      text: "我先看一下，马上回来。",
      mediaUrls: undefined,
    });
    expect(state.runEmbeddedPiAgentMock).toHaveBeenCalledTimes(1);
  });
});

describe("runReplyAgent typing (heartbeat)", () => {
  async function withTempStateDir<T>(fn: (stateDir: string) => Promise<T>): Promise<T> {
    return await withStateDirEnv(
      "openclaw-typing-heartbeat-",
      async ({ stateDir }) => await fn(stateDir),
    );
  }

  async function writeCorruptGeminiSessionFixture(params: {
    stateDir: string;
    sessionId: string;
    persistStore: boolean;
  }) {
    const storePath = path.join(params.stateDir, "sessions", "sessions.json");
    const sessionEntry: SessionEntry = { sessionId: params.sessionId, updatedAt: Date.now() };
    const sessionStore = { main: sessionEntry };

    await fs.mkdir(path.dirname(storePath), { recursive: true });
    if (params.persistStore) {
      await fs.writeFile(storePath, JSON.stringify(sessionStore), "utf-8");
    }

    const transcriptPath = sessions.resolveSessionTranscriptPath(params.sessionId);
    await fs.mkdir(path.dirname(transcriptPath), { recursive: true });
    await fs.writeFile(transcriptPath, "bad", "utf-8");

    return { storePath, sessionEntry, sessionStore, transcriptPath };
  }

  it("signals typing for normal runs", async () => {
    const onPartialReply = vi.fn();
    state.runEmbeddedPiAgentMock.mockImplementationOnce(async (params: AgentRunParams) => {
      await params.onPartialReply?.({ text: "hi" });
      return { payloads: [{ text: "final" }], meta: {} };
    });

    const { run, typing } = createMinimalRun({
      opts: { isHeartbeat: false, onPartialReply },
    });
    await run();

    expect(onPartialReply).toHaveBeenCalled();
    expect(typing.startTypingOnText).toHaveBeenCalledWith("hi");
    expect(typing.startTypingLoop).toHaveBeenCalled();
  });

  it("never signals typing for heartbeat runs", async () => {
    const onPartialReply = vi.fn();
    state.runEmbeddedPiAgentMock.mockImplementationOnce(async (params: AgentRunParams) => {
      await params.onPartialReply?.({ text: "hi" });
      return { payloads: [{ text: "final" }], meta: {} };
    });

    const { run, typing } = createMinimalRun({
      opts: { isHeartbeat: true, onPartialReply },
    });
    await run();

    expect(onPartialReply).toHaveBeenCalled();
    expect(typing.startTypingOnText).not.toHaveBeenCalled();
    expect(typing.startTypingLoop).not.toHaveBeenCalled();
  });

  it("suppresses NO_REPLY partials but allows normal No-prefix partials", async () => {
    const cases = [
      {
        partials: ["NO_REPLY"],
        finalText: "NO_REPLY",
        expectedForwarded: [] as string[],
        shouldType: false,
      },
      {
        partials: ["NO_", "NO_RE", "NO_REPLY"],
        finalText: "NO_REPLY",
        expectedForwarded: [] as string[],
        shouldType: false,
      },
      {
        partials: ["No", "No, that is valid"],
        finalText: "No, that is valid",
        expectedForwarded: ["No", "No, that is valid"],
        shouldType: true,
      },
    ] as const;

    for (const testCase of cases) {
      const onPartialReply = vi.fn();
      state.runEmbeddedPiAgentMock.mockImplementationOnce(async (params: AgentRunParams) => {
        for (const text of testCase.partials) {
          await params.onPartialReply?.({ text });
        }
        return { payloads: [{ text: testCase.finalText }], meta: {} };
      });

      const { run, typing } = createMinimalRun({
        opts: { isHeartbeat: false, onPartialReply },
        typingMode: "message",
      });
      await run();

      if (testCase.expectedForwarded.length === 0) {
        expect(onPartialReply).not.toHaveBeenCalled();
      } else {
        expect(onPartialReply).toHaveBeenCalledTimes(testCase.expectedForwarded.length);
        testCase.expectedForwarded.forEach((text, index) => {
          expect(onPartialReply).toHaveBeenNthCalledWith(index + 1, {
            text,
            mediaUrls: undefined,
          });
        });
      }

      if (testCase.shouldType) {
        expect(typing.startTypingOnText).toHaveBeenCalled();
      } else {
        expect(typing.startTypingOnText).not.toHaveBeenCalled();
      }
      expect(typing.startTypingLoop).not.toHaveBeenCalled();
    }
  });

  it("does not start typing on assistant message start without prior text in message mode", async () => {
    state.runEmbeddedPiAgentMock.mockImplementationOnce(async (params: AgentRunParams) => {
      await params.onAssistantMessageStart?.();
      return { payloads: [{ text: "final" }], meta: {} };
    });

    const { run, typing } = createMinimalRun({
      typingMode: "message",
    });
    await run();

    expect(typing.startTypingLoop).not.toHaveBeenCalled();
    expect(typing.startTypingOnText).not.toHaveBeenCalled();
  });

  it("starts typing from reasoning stream in thinking mode", async () => {
    state.runEmbeddedPiAgentMock.mockImplementationOnce(async (params: AgentRunParams) => {
      await params.onReasoningStream?.({ text: "Reasoning:\n_step_" });
      await params.onPartialReply?.({ text: "hi" });
      return { payloads: [{ text: "final" }], meta: {} };
    });

    const { run, typing } = createMinimalRun({
      typingMode: "thinking",
    });
    await run();

    expect(typing.startTypingLoop).toHaveBeenCalled();
    expect(typing.startTypingOnText).not.toHaveBeenCalled();
  });

  it("keeps assistant partial streaming enabled when reasoning mode is stream", async () => {
    const onPartialReply = vi.fn();
    const onReasoningStream = vi.fn();
    state.runEmbeddedPiAgentMock.mockImplementationOnce(async (params: AgentRunParams) => {
      await params.onReasoningStream?.({ text: "Reasoning:\n_step_" });
      await params.onPartialReply?.({ text: "answer chunk" });
      return { payloads: [{ text: "final" }], meta: {} };
    });

    const { run } = createMinimalRun({
      opts: { onPartialReply, onReasoningStream },
      runOverrides: { reasoningLevel: "stream" },
    });
    await run();

    expect(onReasoningStream).toHaveBeenCalled();
    expect(onPartialReply).toHaveBeenCalledWith({ text: "answer chunk", mediaUrls: undefined });
  });

  it("suppresses typing in never mode", async () => {
    state.runEmbeddedPiAgentMock.mockImplementationOnce(async (params: AgentRunParams) => {
      await params.onPartialReply?.({ text: "hi" });
      return { payloads: [{ text: "final" }], meta: {} };
    });

    const { run, typing } = createMinimalRun({
      typingMode: "never",
    });
    await run();

    expect(typing.startTypingOnText).not.toHaveBeenCalled();
    expect(typing.startTypingLoop).not.toHaveBeenCalled();
  });

  it("signals typing on normalized block replies", async () => {
    const onBlockReply = vi.fn();
    state.runEmbeddedPiAgentMock.mockImplementationOnce(async (params: AgentRunParams) => {
      await params.onBlockReply?.({ text: "\n\nchunk", mediaUrls: [] });
      return { payloads: [{ text: "final" }], meta: {} };
    });

    const { run, typing } = createMinimalRun({
      typingMode: "message",
      blockStreamingEnabled: true,
      opts: { onBlockReply },
    });
    await run();

    expect(typing.startTypingOnText).toHaveBeenCalledWith("chunk");
    expect(onBlockReply).toHaveBeenCalled();
    const [blockPayload, blockOpts] = onBlockReply.mock.calls[0] ?? [];
    expect(blockPayload).toMatchObject({ text: "chunk", audioAsVoice: false });
    expect(blockOpts).toMatchObject({
      abortSignal: expect.any(AbortSignal),
      timeoutMs: expect.any(Number),
    });
  });

  it("handles typing for normal and silent tool results", async () => {
    const cases = [
      {
        toolText: "tooling",
        shouldType: true,
        shouldForward: true,
      },
      {
        toolText: "NO_REPLY",
        shouldType: false,
        shouldForward: false,
      },
    ] as const;

    for (const testCase of cases) {
      const onToolResult = vi.fn();
      state.runEmbeddedPiAgentMock.mockImplementationOnce(async (params: AgentRunParams) => {
        await params.onToolResult?.({ text: testCase.toolText, mediaUrls: [] });
        return { payloads: [{ text: "final" }], meta: {} };
      });

      const { run, typing } = createMinimalRun({
        typingMode: "message",
        opts: { onToolResult },
      });
      await run();

      if (testCase.shouldType) {
        expect(typing.startTypingOnText).toHaveBeenCalledWith(testCase.toolText);
      } else {
        expect(typing.startTypingOnText).not.toHaveBeenCalled();
      }

      if (testCase.shouldForward) {
        expect(onToolResult).toHaveBeenCalledWith({
          text: testCase.toolText,
          mediaUrls: [],
        });
      } else {
        expect(onToolResult).not.toHaveBeenCalled();
      }
    }
  });

  it("retries transient HTTP failures once with timer-driven backoff", async () => {
    vi.useFakeTimers();
    let calls = 0;
    state.runEmbeddedPiAgentMock.mockImplementation(async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error("502 Bad Gateway");
      }
      return { payloads: [{ text: "final" }], meta: {} };
    });

    const { run } = createMinimalRun({
      typingMode: "message",
    });
    const runPromise = run();

    await vi.advanceTimersByTimeAsync(2_499);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await runPromise;
    expect(calls).toBe(2);
    vi.useRealTimers();
  });

  it("delivers tool results in order even when dispatched concurrently", async () => {
    const deliveryOrder: string[] = [];
    const onToolResult = vi.fn(async (payload: { text?: string }) => {
      // Simulate variable network latency: first result is slower than second
      const delay = payload.text === "first" ? 5 : 1;
      await new Promise((r) => setTimeout(r, delay));
      deliveryOrder.push(payload.text ?? "");
    });

    state.runEmbeddedPiAgentMock.mockImplementationOnce(async (params: AgentRunParams) => {
      // Fire two tool results without awaiting each one; await both at the end.
      const first = params.onToolResult?.({ text: "first", mediaUrls: [] });
      const second = params.onToolResult?.({ text: "second", mediaUrls: [] });
      await Promise.all([first, second]);
      return { payloads: [{ text: "final" }], meta: {} };
    });

    const { run } = createMinimalRun({
      typingMode: "message",
      opts: { onToolResult },
    });
    await run();

    expect(onToolResult).toHaveBeenCalledTimes(2);
    // Despite "first" having higher latency, it must be delivered before "second"
    expect(deliveryOrder).toEqual(["first", "second"]);
  });

  it("continues delivering later tool results after an earlier tool result fails", async () => {
    const delivered: string[] = [];
    const onToolResult = vi.fn(async (payload: { text?: string }) => {
      if (payload.text === "first") {
        throw new Error("simulated delivery failure");
      }
      delivered.push(payload.text ?? "");
    });

    state.runEmbeddedPiAgentMock.mockImplementationOnce(async (params: AgentRunParams) => {
      const first = params.onToolResult?.({ text: "first", mediaUrls: [] });
      const second = params.onToolResult?.({ text: "second", mediaUrls: [] });
      await Promise.allSettled([first, second]);
      return { payloads: [{ text: "final" }], meta: {} };
    });

    const { run } = createMinimalRun({
      typingMode: "message",
      opts: { onToolResult },
    });
    await run();

    expect(onToolResult).toHaveBeenCalledTimes(2);
    expect(delivered).toEqual(["second"]);
  });

  it("announces auto-compaction in verbose mode and tracks count", async () => {
    await withTempStateDir(async (stateDir) => {
      const storePath = path.join(stateDir, "sessions", "sessions.json");
      const sessionEntry: SessionEntry = { sessionId: "session", updatedAt: Date.now() };
      const sessionStore = { main: sessionEntry };

      state.runEmbeddedPiAgentMock.mockImplementationOnce(async (params: AgentRunParams) => {
        params.onAgentEvent?.({
          stream: "compaction",
          data: { phase: "end", willRetry: false },
        });
        return { payloads: [{ text: "final" }], meta: {} };
      });

      const { run } = createMinimalRun({
        resolvedVerboseLevel: "on",
        sessionEntry,
        sessionStore,
        sessionKey: "main",
        storePath,
      });
      const res = await run();
      expect(Array.isArray(res)).toBe(true);
      const payloads = res as { text?: string }[];
      expect(payloads[0]?.text).toContain("Auto-compaction complete");
      expect(payloads[0]?.text).toContain("count 1");
      expect(sessionStore.main.compactionCount).toBe(1);
    });
  });

  it("announces model fallback only when verbose mode is enabled", async () => {
    const cases = [
      { name: "verbose on", verbose: "on" as const, expectNotice: true },
      { name: "verbose off", verbose: "off" as const, expectNotice: false },
    ] as const;
    for (const testCase of cases) {
      const sessionEntry: SessionEntry = {
        sessionId: "session",
        updatedAt: Date.now(),
      };
      const sessionStore = { main: sessionEntry };
      state.runEmbeddedPiAgentMock.mockResolvedValueOnce({
        payloads: [{ text: "final" }],
        meta: {},
      });
      vi.spyOn(modelFallbackModule, "runWithModelFallback").mockImplementationOnce(
        async ({ run }: { run: (provider: string, model: string) => Promise<unknown> }) => ({
          result: await run("deepinfra", "moonshotai/Kimi-K2.5"),
          provider: "deepinfra",
          model: "moonshotai/Kimi-K2.5",
          attempts: [
            {
              provider: "fireworks",
              model: "fireworks/minimax-m2p5",
              error: "Provider fireworks is in cooldown (all profiles unavailable)",
              reason: "rate_limit",
            },
          ],
        }),
      );

      const { run } = createMinimalRun({
        resolvedVerboseLevel: testCase.verbose,
        sessionEntry,
        sessionStore,
        sessionKey: "main",
      });
      const phases: string[] = [];
      const off = onAgentEvent((evt) => {
        const phase = typeof evt.data?.phase === "string" ? evt.data.phase : null;
        if (evt.stream === "lifecycle" && phase) {
          phases.push(phase);
        }
      });
      const res = await run();
      off();
      const payload = Array.isArray(res)
        ? (res[0] as { text?: string })
        : (res as { text?: string });
      if (testCase.expectNotice) {
        expect(payload.text, testCase.name).toContain("Model Fallback:");
        expect(payload.text, testCase.name).toContain("deepinfra/moonshotai/Kimi-K2.5");
        expect(sessionEntry.fallbackNoticeReason, testCase.name).toBe("rate limit");
        continue;
      }
      expect(payload.text, testCase.name).not.toContain("Model Fallback:");
      expect(
        phases.filter((phase) => phase === "fallback"),
        testCase.name,
      ).toHaveLength(1);
    }
  });

  it("announces model fallback only once per active fallback state", async () => {
    const sessionEntry: SessionEntry = {
      sessionId: "session",
      updatedAt: Date.now(),
    };
    const sessionStore = { main: sessionEntry };

    state.runEmbeddedPiAgentMock.mockResolvedValue({
      payloads: [{ text: "final" }],
      meta: {},
    });
    const fallbackSpy = vi
      .spyOn(modelFallbackModule, "runWithModelFallback")
      .mockImplementation(
        async ({ run }: { run: (provider: string, model: string) => Promise<unknown> }) => ({
          result: await run("deepinfra", "moonshotai/Kimi-K2.5"),
          provider: "deepinfra",
          model: "moonshotai/Kimi-K2.5",
          attempts: [
            {
              provider: "fireworks",
              model: "fireworks/minimax-m2p5",
              error: "Provider fireworks is in cooldown (all profiles unavailable)",
              reason: "rate_limit",
            },
          ],
        }),
      );
    try {
      const { run } = createMinimalRun({
        resolvedVerboseLevel: "on",
        sessionEntry,
        sessionStore,
        sessionKey: "main",
      });
      const fallbackEvents: Array<Record<string, unknown>> = [];
      const off = onAgentEvent((evt) => {
        if (evt.stream === "lifecycle" && evt.data?.phase === "fallback") {
          fallbackEvents.push(evt.data);
        }
      });
      const first = await run();
      const second = await run();
      off();

      const firstText = Array.isArray(first) ? first[0]?.text : first?.text;
      const secondText = Array.isArray(second) ? second[0]?.text : second?.text;
      expect(firstText).toContain("Model Fallback:");
      expect(secondText).not.toContain("Model Fallback:");
      expect(fallbackEvents).toHaveLength(1);
    } finally {
      fallbackSpy.mockRestore();
    }
  });

  it("re-announces model fallback after returning to selected model", async () => {
    const sessionEntry: SessionEntry = {
      sessionId: "session",
      updatedAt: Date.now(),
    };
    const sessionStore = { main: sessionEntry };
    let callCount = 0;

    state.runEmbeddedPiAgentMock.mockResolvedValue({
      payloads: [{ text: "final" }],
      meta: {},
    });
    const fallbackSpy = vi
      .spyOn(modelFallbackModule, "runWithModelFallback")
      .mockImplementation(
        async ({
          provider,
          model,
          run,
        }: {
          provider: string;
          model: string;
          run: (provider: string, model: string) => Promise<unknown>;
        }) => {
          callCount += 1;
          if (callCount === 2) {
            return {
              result: await run(provider, model),
              provider,
              model,
              attempts: [],
            };
          }
          return {
            result: await run("deepinfra", "moonshotai/Kimi-K2.5"),
            provider: "deepinfra",
            model: "moonshotai/Kimi-K2.5",
            attempts: [
              {
                provider: "fireworks",
                model: "fireworks/minimax-m2p5",
                error: "Provider fireworks is in cooldown (all profiles unavailable)",
                reason: "rate_limit",
              },
            ],
          };
        },
      );
    try {
      const { run } = createMinimalRun({
        resolvedVerboseLevel: "on",
        sessionEntry,
        sessionStore,
        sessionKey: "main",
      });
      const first = await run();
      const second = await run();
      const third = await run();

      const firstText = Array.isArray(first) ? first[0]?.text : first?.text;
      const secondText = Array.isArray(second) ? second[0]?.text : second?.text;
      const thirdText = Array.isArray(third) ? third[0]?.text : third?.text;
      expect(firstText).toContain("Model Fallback:");
      expect(secondText).not.toContain("Model Fallback:");
      expect(thirdText).toContain("Model Fallback:");
    } finally {
      fallbackSpy.mockRestore();
    }
  });

  it("announces fallback-cleared once when runtime returns to selected model", async () => {
    const sessionEntry: SessionEntry = {
      sessionId: "session",
      updatedAt: Date.now(),
    };
    const sessionStore = { main: sessionEntry };
    let callCount = 0;

    state.runEmbeddedPiAgentMock.mockResolvedValue({
      payloads: [{ text: "final" }],
      meta: {},
    });
    const fallbackSpy = vi
      .spyOn(modelFallbackModule, "runWithModelFallback")
      .mockImplementation(
        async ({
          provider,
          model,
          run,
        }: {
          provider: string;
          model: string;
          run: (provider: string, model: string) => Promise<unknown>;
        }) => {
          callCount += 1;
          if (callCount === 1) {
            return {
              result: await run("deepinfra", "moonshotai/Kimi-K2.5"),
              provider: "deepinfra",
              model: "moonshotai/Kimi-K2.5",
              attempts: [
                {
                  provider: "fireworks",
                  model: "fireworks/minimax-m2p5",
                  error: "Provider fireworks is in cooldown (all profiles unavailable)",
                  reason: "rate_limit",
                },
              ],
            };
          }
          return {
            result: await run(provider, model),
            provider,
            model,
            attempts: [],
          };
        },
      );
    try {
      const { run } = createMinimalRun({
        resolvedVerboseLevel: "on",
        sessionEntry,
        sessionStore,
        sessionKey: "main",
      });
      const phases: string[] = [];
      const off = onAgentEvent((evt) => {
        const phase = typeof evt.data?.phase === "string" ? evt.data.phase : null;
        if (evt.stream === "lifecycle" && phase) {
          phases.push(phase);
        }
      });
      const first = await run();
      const second = await run();
      const third = await run();
      off();

      const firstText = Array.isArray(first) ? first[0]?.text : first?.text;
      const secondText = Array.isArray(second) ? second[0]?.text : second?.text;
      const thirdText = Array.isArray(third) ? third[0]?.text : third?.text;
      expect(firstText).toContain("Model Fallback:");
      expect(secondText).toContain("Model Fallback cleared:");
      expect(thirdText).not.toContain("Model Fallback cleared:");
      expect(phases.filter((phase) => phase === "fallback")).toHaveLength(1);
      expect(phases.filter((phase) => phase === "fallback_cleared")).toHaveLength(1);
    } finally {
      fallbackSpy.mockRestore();
    }
  });

  it("emits fallback lifecycle events while verbose is off", async () => {
    const sessionEntry: SessionEntry = {
      sessionId: "session",
      updatedAt: Date.now(),
    };
    const sessionStore = { main: sessionEntry };
    let callCount = 0;

    state.runEmbeddedPiAgentMock.mockResolvedValue({
      payloads: [{ text: "final" }],
      meta: {},
    });
    const fallbackSpy = vi
      .spyOn(modelFallbackModule, "runWithModelFallback")
      .mockImplementation(
        async ({
          provider,
          model,
          run,
        }: {
          provider: string;
          model: string;
          run: (provider: string, model: string) => Promise<unknown>;
        }) => {
          callCount += 1;
          if (callCount === 1) {
            return {
              result: await run("deepinfra", "moonshotai/Kimi-K2.5"),
              provider: "deepinfra",
              model: "moonshotai/Kimi-K2.5",
              attempts: [
                {
                  provider: "fireworks",
                  model: "fireworks/minimax-m2p5",
                  error: "Provider fireworks is in cooldown (all profiles unavailable)",
                  reason: "rate_limit",
                },
              ],
            };
          }
          return {
            result: await run(provider, model),
            provider,
            model,
            attempts: [],
          };
        },
      );
    try {
      const { run } = createMinimalRun({
        resolvedVerboseLevel: "off",
        sessionEntry,
        sessionStore,
        sessionKey: "main",
      });
      const phases: string[] = [];
      const off = onAgentEvent((evt) => {
        const phase = typeof evt.data?.phase === "string" ? evt.data.phase : null;
        if (evt.stream === "lifecycle" && phase) {
          phases.push(phase);
        }
      });
      const first = await run();
      const second = await run();
      off();

      const firstText = Array.isArray(first) ? first[0]?.text : first?.text;
      const secondText = Array.isArray(second) ? second[0]?.text : second?.text;
      expect(firstText).not.toContain("Model Fallback:");
      expect(secondText).not.toContain("Model Fallback cleared:");
      expect(phases.filter((phase) => phase === "fallback")).toHaveLength(1);
      expect(phases.filter((phase) => phase === "fallback_cleared")).toHaveLength(1);
    } finally {
      fallbackSpy.mockRestore();
    }
  });

  it("updates fallback reason summary while fallback stays active", async () => {
    const cases = [
      {
        existingReason: undefined,
        reportedReason: "rate_limit",
        expectedReason: "rate limit",
      },
      {
        existingReason: "rate limit",
        reportedReason: "timeout",
        expectedReason: "timeout",
      },
    ] as const;

    for (const testCase of cases) {
      const sessionEntry: SessionEntry = {
        sessionId: "session",
        updatedAt: Date.now(),
        fallbackNoticeSelectedModel: "anthropic/claude",
        fallbackNoticeActiveModel: "deepinfra/moonshotai/Kimi-K2.5",
        ...(testCase.existingReason ? { fallbackNoticeReason: testCase.existingReason } : {}),
        modelProvider: "deepinfra",
        model: "moonshotai/Kimi-K2.5",
      };
      const sessionStore = { main: sessionEntry };

      state.runEmbeddedPiAgentMock.mockResolvedValue({
        payloads: [{ text: "final" }],
        meta: {},
      });
      const fallbackSpy = vi
        .spyOn(modelFallbackModule, "runWithModelFallback")
        .mockImplementation(
          async ({ run }: { run: (provider: string, model: string) => Promise<unknown> }) => ({
            result: await run("deepinfra", "moonshotai/Kimi-K2.5"),
            provider: "deepinfra",
            model: "moonshotai/Kimi-K2.5",
            attempts: [
              {
                provider: "anthropic",
                model: "claude",
                error: "Provider anthropic is in cooldown (all profiles unavailable)",
                reason: testCase.reportedReason,
              },
            ],
          }),
        );
      try {
        const { run } = createMinimalRun({
          resolvedVerboseLevel: "on",
          sessionEntry,
          sessionStore,
          sessionKey: "main",
        });
        const res = await run();
        const firstText = Array.isArray(res) ? res[0]?.text : res?.text;
        expect(firstText).not.toContain("Model Fallback:");
        expect(sessionEntry.fallbackNoticeReason).toBe(testCase.expectedReason);
      } finally {
        fallbackSpy.mockRestore();
      }
    }
  });

  it("retries after compaction failure by resetting the session", async () => {
    await withTempStateDir(async (stateDir) => {
      const sessionId = "session";
      const storePath = path.join(stateDir, "sessions", "sessions.json");
      const transcriptPath = sessions.resolveSessionTranscriptPath(sessionId);
      const sessionEntry = {
        sessionId,
        updatedAt: Date.now(),
        sessionFile: transcriptPath,
        fallbackNoticeSelectedModel: "fireworks/minimax-m2p5",
        fallbackNoticeActiveModel: "deepinfra/moonshotai/Kimi-K2.5",
        fallbackNoticeReason: "rate limit",
      };
      const sessionStore = { main: sessionEntry };

      await fs.mkdir(path.dirname(storePath), { recursive: true });
      await fs.writeFile(storePath, JSON.stringify(sessionStore), "utf-8");
      await fs.mkdir(path.dirname(transcriptPath), { recursive: true });
      await fs.writeFile(transcriptPath, "ok", "utf-8");

      state.runEmbeddedPiAgentMock.mockImplementationOnce(async () => {
        throw new Error(
          'Context overflow: Summarization failed: 400 {"message":"prompt is too long"}',
        );
      });

      const { run } = createMinimalRun({
        sessionEntry,
        sessionStore,
        sessionKey: "main",
        storePath,
      });
      const res = await run();

      expect(state.runEmbeddedPiAgentMock).toHaveBeenCalledTimes(1);
      const payload = Array.isArray(res) ? res[0] : res;
      expect(payload).toMatchObject({
        text: expect.stringContaining("Context limit exceeded during compaction"),
      });
      if (!payload) {
        throw new Error("expected payload");
      }
      expect(payload.text?.toLowerCase()).toContain("reset");
      expect(sessionStore.main.sessionId).not.toBe(sessionId);
      expect(sessionStore.main.fallbackNoticeSelectedModel).toBeUndefined();
      expect(sessionStore.main.fallbackNoticeActiveModel).toBeUndefined();
      expect(sessionStore.main.fallbackNoticeReason).toBeUndefined();

      const persisted = JSON.parse(await fs.readFile(storePath, "utf-8"));
      expect(persisted.main.sessionId).toBe(sessionStore.main.sessionId);
      expect(persisted.main.fallbackNoticeSelectedModel).toBeUndefined();
      expect(persisted.main.fallbackNoticeActiveModel).toBeUndefined();
      expect(persisted.main.fallbackNoticeReason).toBeUndefined();
    });
  });

  it("retries after context overflow payload by resetting the session", async () => {
    await withTempStateDir(async (stateDir) => {
      const sessionId = "session";
      const storePath = path.join(stateDir, "sessions", "sessions.json");
      const transcriptPath = sessions.resolveSessionTranscriptPath(sessionId);
      const sessionEntry = { sessionId, updatedAt: Date.now(), sessionFile: transcriptPath };
      const sessionStore = { main: sessionEntry };

      await fs.mkdir(path.dirname(storePath), { recursive: true });
      await fs.writeFile(storePath, JSON.stringify(sessionStore), "utf-8");
      await fs.mkdir(path.dirname(transcriptPath), { recursive: true });
      await fs.writeFile(transcriptPath, "ok", "utf-8");

      state.runEmbeddedPiAgentMock.mockImplementationOnce(async () => ({
        payloads: [{ text: "Context overflow: prompt too large", isError: true }],
        meta: {
          durationMs: 1,
          error: {
            kind: "context_overflow",
            message: 'Context overflow: Summarization failed: 400 {"message":"prompt is too long"}',
          },
        },
      }));

      const { run } = createMinimalRun({
        sessionEntry,
        sessionStore,
        sessionKey: "main",
        storePath,
      });
      const res = await run();

      expect(state.runEmbeddedPiAgentMock).toHaveBeenCalledTimes(1);
      const payload = Array.isArray(res) ? res[0] : res;
      expect(payload).toMatchObject({
        text: expect.stringContaining("Context limit exceeded"),
      });
      if (!payload) {
        throw new Error("expected payload");
      }
      expect(payload.text?.toLowerCase()).toContain("reset");
      expect(sessionStore.main.sessionId).not.toBe(sessionId);

      const persisted = JSON.parse(await fs.readFile(storePath, "utf-8"));
      expect(persisted.main.sessionId).toBe(sessionStore.main.sessionId);
    });
  });

  it("resets the session after role ordering payloads", async () => {
    await withTempStateDir(async (stateDir) => {
      const sessionId = "session";
      const storePath = path.join(stateDir, "sessions", "sessions.json");
      const transcriptPath = sessions.resolveSessionTranscriptPath(sessionId);
      const sessionEntry = { sessionId, updatedAt: Date.now(), sessionFile: transcriptPath };
      const sessionStore = { main: sessionEntry };

      await fs.mkdir(path.dirname(storePath), { recursive: true });
      await fs.writeFile(storePath, JSON.stringify(sessionStore), "utf-8");
      await fs.mkdir(path.dirname(transcriptPath), { recursive: true });
      await fs.writeFile(transcriptPath, "ok", "utf-8");

      state.runEmbeddedPiAgentMock.mockImplementationOnce(async () => ({
        payloads: [{ text: "Message ordering conflict - please try again.", isError: true }],
        meta: {
          durationMs: 1,
          error: {
            kind: "role_ordering",
            message: 'messages: roles must alternate between "user" and "assistant"',
          },
        },
      }));

      const { run } = createMinimalRun({
        sessionEntry,
        sessionStore,
        sessionKey: "main",
        storePath,
      });
      const res = await run();

      const payload = Array.isArray(res) ? res[0] : res;
      expect(payload).toMatchObject({
        text: expect.stringContaining("Message ordering conflict"),
      });
      if (!payload) {
        throw new Error("expected payload");
      }
      expect(payload.text?.toLowerCase()).toContain("reset");
      expect(sessionStore.main.sessionId).not.toBe(sessionId);
      await expect(fs.access(transcriptPath)).rejects.toBeDefined();

      const persisted = JSON.parse(await fs.readFile(storePath, "utf-8"));
      expect(persisted.main.sessionId).toBe(sessionStore.main.sessionId);
    });
  });

  it("resets corrupted Gemini sessions and deletes transcripts", async () => {
    await withTempStateDir(async (stateDir) => {
      const { storePath, sessionEntry, sessionStore, transcriptPath } =
        await writeCorruptGeminiSessionFixture({
          stateDir,
          sessionId: "session-corrupt",
          persistStore: true,
        });

      state.runEmbeddedPiAgentMock.mockImplementationOnce(async () => {
        throw new Error(
          "function call turn comes immediately after a user turn or after a function response turn",
        );
      });

      const { run } = createMinimalRun({
        sessionEntry,
        sessionStore,
        sessionKey: "main",
        storePath,
      });
      const res = await run();

      expect(res).toMatchObject({
        text: expect.stringContaining("Session history was corrupted"),
      });
      expect(sessionStore.main).toBeUndefined();
      await expect(fs.access(transcriptPath)).rejects.toThrow();

      const persisted = JSON.parse(await fs.readFile(storePath, "utf-8"));
      expect(persisted.main).toBeUndefined();
    });
  });

  it("keeps sessions intact on other errors", async () => {
    await withTempStateDir(async (stateDir) => {
      const sessionId = "session-ok";
      const storePath = path.join(stateDir, "sessions", "sessions.json");
      const sessionEntry = { sessionId, updatedAt: Date.now() };
      const sessionStore = { main: sessionEntry };

      await fs.mkdir(path.dirname(storePath), { recursive: true });
      await fs.writeFile(storePath, JSON.stringify(sessionStore), "utf-8");

      const transcriptPath = sessions.resolveSessionTranscriptPath(sessionId);
      await fs.mkdir(path.dirname(transcriptPath), { recursive: true });
      await fs.writeFile(transcriptPath, "ok", "utf-8");

      state.runEmbeddedPiAgentMock.mockImplementationOnce(async () => {
        throw new Error("INVALID_ARGUMENT: some other failure");
      });

      const { run } = createMinimalRun({
        sessionEntry,
        sessionStore,
        sessionKey: "main",
        storePath,
      });
      const res = await run();

      expect(res).toMatchObject({
        text: expect.stringContaining("Agent failed before reply"),
      });
      expect(sessionStore.main).toBeDefined();
      await expect(fs.access(transcriptPath)).resolves.toBeUndefined();

      const persisted = JSON.parse(await fs.readFile(storePath, "utf-8"));
      expect(persisted.main).toBeDefined();
    });
  });

  it("still replies even if session reset fails to persist", async () => {
    await withTempStateDir(async (stateDir) => {
      const saveSpy = vi
        .spyOn(sessions, "saveSessionStore")
        .mockRejectedValueOnce(new Error("boom"));
      try {
        const { storePath, sessionEntry, sessionStore, transcriptPath } =
          await writeCorruptGeminiSessionFixture({
            stateDir,
            sessionId: "session-corrupt",
            persistStore: false,
          });

        state.runEmbeddedPiAgentMock.mockImplementationOnce(async () => {
          throw new Error(
            "function call turn comes immediately after a user turn or after a function response turn",
          );
        });

        const { run } = createMinimalRun({
          sessionEntry,
          sessionStore,
          sessionKey: "main",
          storePath,
        });
        const res = await run();

        expect(res).toMatchObject({
          text: expect.stringContaining("Session history was corrupted"),
        });
        expect(sessionStore.main).toBeUndefined();
        await expect(fs.access(transcriptPath)).rejects.toThrow();
      } finally {
        saveSpy.mockRestore();
      }
    });
  });

  it("returns friendly message for role ordering errors thrown as exceptions", async () => {
    state.runEmbeddedPiAgentMock.mockImplementationOnce(async () => {
      throw new Error("400 Incorrect role information");
    });

    const { run } = createMinimalRun({});
    const res = await run();

    expect(res).toMatchObject({
      text: expect.stringContaining("Message ordering conflict"),
    });
    expect(res).toMatchObject({
      text: expect.not.stringContaining("400"),
    });
  });

  it("rewrites Bun socket errors into friendly text", async () => {
    state.runEmbeddedPiAgentMock.mockImplementationOnce(async () => ({
      payloads: [
        {
          text: "TypeError: The socket connection was closed unexpectedly. For more information, pass `verbose: true` in the second argument to fetch()",
          isError: true,
        },
      ],
      meta: {},
    }));

    const { run } = createMinimalRun();
    const res = await run();
    const payloads = Array.isArray(res) ? res : res ? [res] : [];
    expect(payloads.length).toBe(1);
    expect(payloads[0]?.text).toContain("LLM connection failed");
    expect(payloads[0]?.text).toContain("socket connection was closed unexpectedly");
    expect(payloads[0]?.text).toContain("```");
  });
});

describe("runReplyAgent memory flush", () => {
  let fixtureRoot = "";
  let caseId = 0;

  async function withTempStore<T>(fn: (storePath: string) => Promise<T>): Promise<T> {
    const dir = path.join(fixtureRoot, `case-${++caseId}`);
    await fs.mkdir(dir, { recursive: true });
    return await fn(path.join(dir, "sessions.json"));
  }

  beforeAll(async () => {
    fixtureRoot = await fs.mkdtemp(path.join(tmpdir(), "openclaw-memory-flush-"));
  });

  afterAll(async () => {
    if (fixtureRoot) {
      await fs.rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("skips memory flush for CLI providers", async () => {
    await withTempStore(async (storePath) => {
      const sessionKey = "main";
      const sessionEntry = {
        sessionId: "session",
        updatedAt: Date.now(),
        totalTokens: 80_000,
        compactionCount: 1,
      };

      await seedSessionStore({ storePath, sessionKey, entry: sessionEntry });

      state.runEmbeddedPiAgentMock.mockImplementation(async () => ({
        payloads: [{ text: "ok" }],
        meta: { agentMeta: { usage: { input: 1, output: 1 } } },
      }));
      state.runCliAgentMock.mockResolvedValue({
        payloads: [{ text: "ok" }],
        meta: { agentMeta: { usage: { input: 1, output: 1 } } },
      });

      const baseRun = createBaseRun({
        storePath,
        sessionEntry,
        runOverrides: { provider: "codex-cli" },
      });

      await runReplyAgentWithBase({
        baseRun,
        storePath,
        sessionKey,
        sessionEntry,
        commandBody: "hello",
      });

      expect(state.runCliAgentMock).toHaveBeenCalledTimes(1);
      const call = state.runCliAgentMock.mock.calls[0]?.[0] as { prompt?: string } | undefined;
      expect(call?.prompt).toBe("hello");
      expect(state.runEmbeddedPiAgentMock).not.toHaveBeenCalled();
    });
  });

  it("runs a memory flush turn and updates session metadata", async () => {
    await withTempStore(async (storePath) => {
      const sessionKey = "main";
      const sessionEntry = {
        sessionId: "session",
        updatedAt: Date.now(),
        totalTokens: 80_000,
        compactionCount: 1,
      };

      await seedSessionStore({ storePath, sessionKey, entry: sessionEntry });

      const calls: Array<{ prompt?: string }> = [];
      state.runEmbeddedPiAgentMock.mockImplementation(async (params: EmbeddedRunParams) => {
        calls.push({ prompt: params.prompt });
        if (params.prompt?.includes("Pre-compaction memory flush.")) {
          return { payloads: [], meta: {} };
        }
        return {
          payloads: [{ text: "ok" }],
          meta: { agentMeta: { usage: { input: 1, output: 1 } } },
        };
      });

      const baseRun = createBaseRun({
        storePath,
        sessionEntry,
      });

      await runReplyAgentWithBase({
        baseRun,
        storePath,
        sessionKey,
        sessionEntry,
        commandBody: "hello",
      });

      expect(calls).toHaveLength(2);
      expect(calls[0]?.prompt).toContain("Pre-compaction memory flush.");
      expect(calls[0]?.prompt).toContain("Current time:");
      expect(calls[0]?.prompt).toMatch(/memory\/\d{4}-\d{2}-\d{2}\.md/);
      expect(calls[1]?.prompt).toBe("hello");

      const stored = JSON.parse(await fs.readFile(storePath, "utf-8"));
      expect(stored[sessionKey].memoryFlushAt).toBeTypeOf("number");
      expect(stored[sessionKey].memoryFlushCompactionCount).toBe(1);
    });
  });

  it("skips memory flush when disabled in config", async () => {
    await withTempStore(async (storePath) => {
      const sessionKey = "main";
      const sessionEntry = {
        sessionId: "session",
        updatedAt: Date.now(),
        totalTokens: 80_000,
        compactionCount: 1,
      };

      await seedSessionStore({ storePath, sessionKey, entry: sessionEntry });

      state.runEmbeddedPiAgentMock.mockImplementation(async () => ({
        payloads: [{ text: "ok" }],
        meta: { agentMeta: { usage: { input: 1, output: 1 } } },
      }));

      const baseRun = createBaseRun({
        storePath,
        sessionEntry,
        config: { agents: { defaults: { compaction: { memoryFlush: { enabled: false } } } } },
      });

      await runReplyAgentWithBase({
        baseRun,
        storePath,
        sessionKey,
        sessionEntry,
        commandBody: "hello",
      });

      expect(state.runEmbeddedPiAgentMock).toHaveBeenCalledTimes(1);
      const call = state.runEmbeddedPiAgentMock.mock.calls[0]?.[0] as
        | { prompt?: string }
        | undefined;
      expect(call?.prompt).toBe("hello");

      const stored = JSON.parse(await fs.readFile(storePath, "utf-8"));
      expect(stored[sessionKey].memoryFlushAt).toBeUndefined();
    });
  });

  it("skips memory flush after a prior flush in the same compaction cycle", async () => {
    await withTempStore(async (storePath) => {
      const sessionKey = "main";
      const sessionEntry = {
        sessionId: "session",
        updatedAt: Date.now(),
        totalTokens: 80_000,
        compactionCount: 2,
        memoryFlushCompactionCount: 2,
      };

      await seedSessionStore({ storePath, sessionKey, entry: sessionEntry });

      const calls: Array<{ prompt?: string }> = [];
      state.runEmbeddedPiAgentMock.mockImplementation(async (params: EmbeddedRunParams) => {
        calls.push({ prompt: params.prompt });
        return {
          payloads: [{ text: "ok" }],
          meta: { agentMeta: { usage: { input: 1, output: 1 } } },
        };
      });

      const baseRun = createBaseRun({
        storePath,
        sessionEntry,
      });

      await runReplyAgentWithBase({
        baseRun,
        storePath,
        sessionKey,
        sessionEntry,
        commandBody: "hello",
      });

      expect(calls.map((call) => call.prompt)).toEqual(["hello"]);
    });
  });

  it("increments compaction count when flush compaction completes", async () => {
    await withTempStore(async (storePath) => {
      const sessionKey = "main";
      const sessionEntry = {
        sessionId: "session",
        updatedAt: Date.now(),
        totalTokens: 80_000,
        compactionCount: 1,
      };

      await seedSessionStore({ storePath, sessionKey, entry: sessionEntry });

      state.runEmbeddedPiAgentMock.mockImplementation(async (params: EmbeddedRunParams) => {
        if (params.prompt?.includes("Pre-compaction memory flush.")) {
          params.onAgentEvent?.({
            stream: "compaction",
            data: { phase: "end", willRetry: false },
          });
          return { payloads: [], meta: {} };
        }
        return {
          payloads: [{ text: "ok" }],
          meta: { agentMeta: { usage: { input: 1, output: 1 } } },
        };
      });

      const baseRun = createBaseRun({
        storePath,
        sessionEntry,
      });

      await runReplyAgentWithBase({
        baseRun,
        storePath,
        sessionKey,
        sessionEntry,
        commandBody: "hello",
      });

      const stored = JSON.parse(await fs.readFile(storePath, "utf-8"));
      expect(stored[sessionKey].compactionCount).toBe(2);
      expect(stored[sessionKey].memoryFlushCompactionCount).toBe(2);
    });
  });
});
