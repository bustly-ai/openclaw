import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EmbeddedPiSubscribeContext } from "./pi-embedded-subscribe.handlers.types.js";
import { createInlineCodeState } from "../markdown/code-spans.js";
import {
  handleAgentEnd,
  handleAutoRetryEnd,
  handleAutoRetryStart,
} from "./pi-embedded-subscribe.handlers.lifecycle.js";
import { emitAgentEvent } from "../infra/agent-events.js";
import { OUTPUT_LIMIT_ERROR } from "./pi-embedded-openrouter.js";

vi.mock("../infra/agent-events.js", () => ({
  emitAgentEvent: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function createContext(
  lastAssistant: unknown,
  overrides?: { onAgentEvent?: (event: unknown) => void; provider?: string },
): EmbeddedPiSubscribeContext {
  return {
    params: {
      runId: "run-1",
      provider: overrides?.provider,
      config: {},
      sessionKey: "agent:main:main",
      onAgentEvent: overrides?.onAgentEvent,
    },
    state: {
      assistantTexts: [],
      lastAssistant: lastAssistant as EmbeddedPiSubscribeContext["state"]["lastAssistant"],
      lifecycleErrorEmitted: false,
      pendingCompactionRetry: 0,
      blockState: {
        thinking: true,
        final: true,
        inlineCode: createInlineCodeState(),
      },
    },
    log: {
      debug: vi.fn(),
      warn: vi.fn(),
    },
    flushBlockReplyBuffer: vi.fn(),
    resolveCompactionRetry: vi.fn(),
    maybeResolveCompactionWait: vi.fn(),
  } as unknown as EmbeddedPiSubscribeContext;
}

describe("handleAgentEnd", () => {
  it("logs the resolved error message when run ends with assistant error", () => {
    const onAgentEvent = vi.fn();
    const ctx = createContext(
      {
        role: "assistant",
        stopReason: "error",
        errorMessage: "bad request",
        content: [{ type: "text", text: "" }],
      },
      { onAgentEvent },
    );

    handleAgentEnd(ctx);

    const warn = vi.mocked(ctx.log.warn);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("runId=run-1");
    expect(warn.mock.calls[0]?.[0]).toContain("error=bad request");
    expect(onAgentEvent).toHaveBeenCalledWith({
      stream: "lifecycle",
      data: {
        phase: "error",
        error: "bad request",
      },
    });
  });

  it("keeps non-error run-end logging on debug only", () => {
    const ctx = createContext(undefined);

    handleAgentEnd(ctx);

    expect(ctx.log.warn).not.toHaveBeenCalled();
    expect(ctx.log.debug).toHaveBeenCalledWith(
      "embedded run agent end: runId=run-1 isError=false",
    );
  });

  it("suppresses terminal lifecycle events when the assistant error is retryable", () => {
    const onAgentEvent = vi.fn();
    const ctx = createContext(
      {
        role: "assistant",
        stopReason: "error",
        errorMessage: "429 too many requests",
        content: [{ type: "text", text: "" }],
      },
      { onAgentEvent },
    );

    handleAgentEnd(ctx);

    expect(vi.mocked(emitAgentEvent)).not.toHaveBeenCalled();
    expect(onAgentEvent).not.toHaveBeenCalled();
    expect(ctx.log.debug).toHaveBeenCalledWith(
      "embedded run agent end: runId=run-1 awaiting retry",
    );
  });

  it("emits lifecycle error for output-limit replies", () => {
    const onAgentEvent = vi.fn();
    const ctx = createContext(
      {
        role: "assistant",
        stopReason: "length",
        provider: "bustly",
        model: "chat.advanced",
        content: [{ type: "toolCall", id: "call_1", name: "write", arguments: {} }],
      },
      { onAgentEvent, provider: "bustly" },
    );

    handleAgentEnd(ctx);

    expect(ctx.state.lifecycleErrorEmitted).toBe(true);
    expect(vi.mocked(emitAgentEvent)).toHaveBeenCalledWith({
      runId: "run-1",
      stream: "lifecycle",
      data: {
        phase: "error",
        error: OUTPUT_LIMIT_ERROR,
        endedAt: expect.any(Number),
      },
    });
    expect(onAgentEvent).toHaveBeenCalledWith({
      stream: "lifecycle",
      data: {
        phase: "error",
        error: OUTPUT_LIMIT_ERROR,
      },
    });
  });

  it("emits reconnecting lifecycle state when auto-retry starts", () => {
    const onAgentEvent = vi.fn();
    const ctx = createContext(undefined, { onAgentEvent });

    handleAutoRetryStart(ctx, {
      attempt: 1,
      maxAttempts: 3,
      delayMs: 2000,
      errorMessage: "429 too many requests",
    });

    expect(vi.mocked(emitAgentEvent)).toHaveBeenCalledWith({
      runId: "run-1",
      stream: "lifecycle",
      data: {
        phase: "reconnecting",
        attempt: 1,
        maxAttempts: 3,
        delayMs: 2000,
        error: "429 too many requests",
      },
    });
    expect(onAgentEvent).toHaveBeenCalledWith({
      stream: "lifecycle",
      data: {
        phase: "reconnecting",
        attempt: 1,
        maxAttempts: 3,
        delayMs: 2000,
        error: "429 too many requests",
      },
    });
  });

  it("emits lifecycle error when auto-retry ends unsuccessfully", () => {
    const onAgentEvent = vi.fn();
    const ctx = createContext(undefined, { onAgentEvent });

    handleAutoRetryEnd(ctx, {
      success: false,
      finalError: "Retry delay exceeded",
    });

    expect(ctx.state.lifecycleErrorEmitted).toBe(true);
    expect(vi.mocked(emitAgentEvent)).toHaveBeenCalledWith({
      runId: "run-1",
      stream: "lifecycle",
      data: {
        phase: "error",
        endedAt: expect.any(Number),
        error: "Retry delay exceeded",
      },
    });
    expect(onAgentEvent).toHaveBeenCalledWith({
      stream: "lifecycle",
      data: {
        phase: "error",
        error: "Retry delay exceeded",
      },
    });
  });
});
