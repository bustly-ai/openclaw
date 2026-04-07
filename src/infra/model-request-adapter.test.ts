import fs from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type AssistantMessageEvent,
} from "@mariozechner/pi-ai";
import {
  consumeCompletedAssistantRequestMetrics,
  resetAssistantRequestMetricsForTest,
} from "./assistant-request-metrics.js";
import { runTrackedModelRequest } from "./model-request-adapter.js";
import { withStateDirEnv } from "../test-helpers/state-dir-env.js";

function createMockAssistantStream(events: AssistantMessageEvent[], result?: AssistantMessage) {
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

describe("model-request-adapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetAssistantRequestMetricsForTest();
  });

  it("records ttft and ttlr for streamed text output", async () => {
    const message: AssistantMessage = {
      role: "assistant",
      content: [{ type: "text", text: "Hello" }],
      stopReason: "stop",
      api: "openai-completions",
      provider: "bustly",
      model: "chat.standard",
      timestamp: 0,
      usage: {
        input: 1,
        output: 1,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 2,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
    };
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValueOnce(180);
    nowSpy.mockReturnValueOnce(420);

    const eventStream = await Promise.resolve(
      runTrackedModelRequest({
        runId: "run-1",
        startedAtMs: 100,
        request: () =>
          createMockAssistantStream(
            [
              {
                type: "text_delta",
                contentIndex: 0,
                delta: "Hello",
                partial: message,
              },
              {
                type: "done",
                reason: "stop",
                message,
              },
            ],
            message,
          ),
        model: {} as never,
        context: {} as never,
      }),
    );

    for await (const _event of eventStream) {
      void _event;
    }

    expect(consumeCompletedAssistantRequestMetrics("run-1")).toEqual([
      { ttftMs: 80, ttlrMs: 320 },
    ]);
  });

  it("records tool-only model responses from the same adapter", async () => {
    const toolMessage: AssistantMessage = {
      role: "assistant",
      content: [
        {
          type: "toolCall",
          id: "call_1",
          name: "enter_agent_loop",
          arguments: { reason: "needs tools" },
        },
      ],
      stopReason: "toolUse",
      api: "openai-completions",
      provider: "bustly",
      model: "chat.standard",
      timestamp: 0,
      usage: {
        input: 1,
        output: 1,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 2,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
    };
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValueOnce(115);
    nowSpy.mockReturnValueOnce(200);

    const eventStream = await Promise.resolve(
      runTrackedModelRequest({
        runId: "run-2",
        startedAtMs: 100,
        request: () =>
          createMockAssistantStream(
            [
              {
                type: "toolcall_start",
                contentIndex: 0,
                partial: {
                  ...toolMessage,
                  content: [],
                },
              },
              {
                type: "done",
                reason: "toolUse",
                message: toolMessage,
              },
            ],
            toolMessage,
          ),
        model: {} as never,
        context: {} as never,
      }),
    );

    for await (const _event of eventStream) {
      void _event;
    }

    expect(consumeCompletedAssistantRequestMetrics("run-2")).toEqual([
      { ttftMs: 15, ttlrMs: 100 },
    ]);
  });

  it("records metrics when callers only await result()", async () => {
    const message: AssistantMessage = {
      role: "assistant",
      content: [{ type: "text", text: "Hello" }],
      stopReason: "stop",
      api: "openai-completions",
      provider: "bustly",
      model: "chat.standard",
      timestamp: 0,
      usage: {
        input: 1,
        output: 1,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 2,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
    };
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValueOnce(120);

    const eventStream = await Promise.resolve(
      runTrackedModelRequest({
        runId: "run-3",
        startedAtMs: 100,
        request: () => createMockAssistantStream([], message),
        model: {} as never,
        context: {} as never,
      }),
    );

    await eventStream.result();

    expect(consumeCompletedAssistantRequestMetrics("run-3")).toEqual([
      { ttftMs: 20, ttlrMs: 20 },
    ]);
  });

  it("writes payload logs from the shared adapter layer", async () => {
    await withStateDirEnv("model-request-adapter-", async ({ stateDir }) => {
      vi.stubEnv("OPENCLAW_PAYLOAD_LOG", "1");
      const message: AssistantMessage = {
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
        stopReason: "stop",
        api: "openai-completions",
        provider: "bustly",
        model: "chat.standard",
        timestamp: 0,
        usage: {
          input: 1,
          output: 1,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 2,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
      };
      const payload = { model: "chat.standard", messages: [{ role: "user", content: "hi" }] };

      const eventStream = await Promise.resolve(
        runTrackedModelRequest({
          runId: "run-fast-gate",
          request: (_model, _context, options) => {
            options?.onPayload?.(payload);
            return createMockAssistantStream([], message);
          },
          model: {
            id: "chat.standard",
            provider: "bustly",
            api: "openai-completions",
            baseUrl: "https://gw.bustly.ai/api/v1",
          } as never,
          context: {} as never,
          payloadLog: {
            env: process.env,
            sessionKey: "agent:test:conversation:1",
            workspaceDir: "/tmp/workspace",
          },
        }),
      );

      await eventStream.result();

      const payloadLogPath = path.join(stateDir, "logs", "model-payload.jsonl");
      const fileText = await waitForFileText(payloadLogPath);
      const lines = fileText
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));

      expect(lines).toHaveLength(2);
      expect(lines[0]).toMatchObject({
        stage: "request",
        runId: "run-fast-gate",
        sessionKey: "agent:test:conversation:1",
      });
      expect(lines[0].request.request).toEqual(payload);
      expect(lines[1]).toMatchObject({
        stage: "response",
        runId: "run-fast-gate",
        sessionKey: "agent:test:conversation:1",
      });
      expect(lines[1].response.message).toEqual(message);
    });
    vi.unstubAllEnvs();
  });
});
