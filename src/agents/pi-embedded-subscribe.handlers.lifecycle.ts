import type { EmbeddedPiSubscribeContext } from "./pi-embedded-subscribe.handlers.types.js";
import { emitAgentEvent } from "../infra/agent-events.js";
import { createInlineCodeState } from "../markdown/code-spans.js";
import { formatAssistantErrorText } from "./pi-embedded-helpers.js";
import {
  isOutputLimitStopReason,
  OUTPUT_LIMIT_ERROR,
} from "./pi-embedded-openrouter.js";
import { isRetryableAssistantError } from "./pi-embedded-subscribe.retry.js";
import { isAssistantMessage } from "./pi-embedded-utils.js";

export {
  handleAutoCompactionEnd,
  handleAutoCompactionStart,
} from "./pi-embedded-subscribe.handlers.compaction.js";

export function handleAgentStart(ctx: EmbeddedPiSubscribeContext) {
  ctx.log.debug(`embedded run agent start: runId=${ctx.params.runId}`);
  emitAgentEvent({
    runId: ctx.params.runId,
    stream: "lifecycle",
    data: {
      phase: "start",
      startedAt: Date.now(),
    },
  });
  void ctx.params.onAgentEvent?.({
    stream: "lifecycle",
    data: { phase: "start" },
  });
}

export function handleAgentEnd(ctx: EmbeddedPiSubscribeContext) {
  const lastAssistant = ctx.state.lastAssistant;
  const isError = isAssistantMessage(lastAssistant) && lastAssistant.stopReason === "error";
  const isRetryableError = isAssistantMessage(lastAssistant)
    ? isRetryableAssistantError(lastAssistant)
    : false;
  const isOutputLimit = isAssistantMessage(lastAssistant) && isOutputLimitStopReason(lastAssistant);

  if (isRetryableError && lastAssistant) {
    ctx.log.debug(`embedded run agent end: runId=${ctx.params.runId} awaiting retry`);
  } else if (isOutputLimit && !ctx.state.lifecycleErrorEmitted) {
    ctx.state.lifecycleErrorEmitted = true;
    ctx.log.warn(
      `embedded run agent end: runId=${ctx.params.runId} error=${OUTPUT_LIMIT_ERROR}`,
    );
    emitAgentEvent({
      runId: ctx.params.runId,
      stream: "lifecycle",
      data: {
        phase: "error",
        error: OUTPUT_LIMIT_ERROR,
        endedAt: Date.now(),
      },
    });
    void ctx.params.onAgentEvent?.({
      stream: "lifecycle",
      data: {
        phase: "error",
        error: OUTPUT_LIMIT_ERROR,
      },
    });
  } else if (isError && lastAssistant && !ctx.state.lifecycleErrorEmitted) {
    const friendlyError = formatAssistantErrorText(lastAssistant, {
      cfg: ctx.params.config,
      sessionKey: ctx.params.sessionKey,
      provider: lastAssistant.provider,
      model: lastAssistant.model,
    });
    const errorText = (friendlyError || lastAssistant.errorMessage || "LLM request failed.").trim();
    ctx.log.warn(
      `embedded run agent end: runId=${ctx.params.runId} isError=true error=${errorText}`,
    );
    emitAgentEvent({
      runId: ctx.params.runId,
      stream: "lifecycle",
      data: {
        phase: "error",
        error: errorText,
        endedAt: Date.now(),
      },
    });
    void ctx.params.onAgentEvent?.({
      stream: "lifecycle",
      data: {
        phase: "error",
        error: errorText,
      },
    });
  } else if (isOutputLimit) {
    ctx.log.debug(
      `embedded run agent end: runId=${ctx.params.runId} output-limit error already emitted`,
    );
  } else if (isError) {
    ctx.log.debug(`embedded run agent end: runId=${ctx.params.runId} error already emitted`);
  } else {
    ctx.log.debug(`embedded run agent end: runId=${ctx.params.runId} isError=${isError}`);
    emitAgentEvent({
      runId: ctx.params.runId,
      stream: "lifecycle",
      data: {
        phase: "end",
        endedAt: Date.now(),
      },
    });
    void ctx.params.onAgentEvent?.({
      stream: "lifecycle",
      data: { phase: "end" },
    });
  }

  ctx.flushBlockReplyBuffer();

  ctx.state.blockState.thinking = false;
  ctx.state.blockState.final = false;
  ctx.state.blockState.inlineCode = createInlineCodeState();

  if (ctx.state.pendingCompactionRetry > 0) {
    ctx.resolveCompactionRetry();
  } else {
    ctx.maybeResolveCompactionWait();
  }
}

export function handleAutoRetryStart(
  ctx: EmbeddedPiSubscribeContext,
  evt: {
    attempt?: unknown;
    maxAttempts?: unknown;
    delayMs?: unknown;
    errorMessage?: unknown;
  },
) {
  emitAgentEvent({
    runId: ctx.params.runId,
    stream: "lifecycle",
    data: {
      phase: "reconnecting",
      attempt: typeof evt.attempt === "number" ? evt.attempt : undefined,
      maxAttempts: typeof evt.maxAttempts === "number" ? evt.maxAttempts : undefined,
      delayMs: typeof evt.delayMs === "number" ? evt.delayMs : undefined,
      error:
        typeof evt.errorMessage === "string" && evt.errorMessage.trim()
          ? evt.errorMessage.trim()
          : undefined,
    },
  });
  void ctx.params.onAgentEvent?.({
    stream: "lifecycle",
    data: {
      phase: "reconnecting",
      attempt: typeof evt.attempt === "number" ? evt.attempt : undefined,
      maxAttempts: typeof evt.maxAttempts === "number" ? evt.maxAttempts : undefined,
      delayMs: typeof evt.delayMs === "number" ? evt.delayMs : undefined,
      error:
        typeof evt.errorMessage === "string" && evt.errorMessage.trim()
          ? evt.errorMessage.trim()
          : undefined,
    },
  });
}

export function handleAutoRetryEnd(
  ctx: EmbeddedPiSubscribeContext,
  evt: {
    success?: unknown;
    finalError?: unknown;
  },
) {
  if (evt.success === true) {
    return;
  }
  const errorText =
    typeof evt.finalError === "string" && evt.finalError.trim()
      ? evt.finalError.trim()
      : "LLM request failed after retry attempts.";
  ctx.state.lifecycleErrorEmitted = true;
  emitAgentEvent({
    runId: ctx.params.runId,
    stream: "lifecycle",
    data: {
      phase: "error",
      endedAt: Date.now(),
      error: errorText,
    },
  });
  void ctx.params.onAgentEvent?.({
    stream: "lifecycle",
    data: {
      phase: "error",
      error: errorText,
    },
  });
}
