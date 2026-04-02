import type { StreamFn } from "@mariozechner/pi-agent-core";
import type {
  Api,
  AssistantMessage,
  AssistantMessageEvent,
  AssistantMessageEventStream,
  Context,
  Model,
  StreamOptions,
} from "@mariozechner/pi-ai";
import { createModelPayloadLogger } from "../agents/model-payload-log.js";
import {
  recordAssistantRequestEnd,
  recordAssistantRequestFirstDelta,
  recordAssistantRequestStart,
} from "./assistant-request-metrics.js";

type ModelRequestOptions = StreamOptions & Record<string, unknown>;

type ModelRequestFn = (
  model: Model<Api>,
  context: Context,
  options?: ModelRequestOptions,
) => AssistantMessageEventStream | Promise<AssistantMessageEventStream>;

type ModelRequestPayloadLogParams = {
  env?: NodeJS.ProcessEnv;
  sessionId?: string;
  sessionKey?: string;
  provider?: string;
  modelId?: string;
  modelApi?: string | null;
  workspaceDir?: string;
};

function hasAssistantOutput(message: AssistantMessage): boolean {
  if (!Array.isArray(message.content) || message.content.length === 0) {
    return false;
  }
  return message.content.some((block) => {
    if (!block || typeof block !== "object") {
      return false;
    }
    if (block.type === "text") {
      return typeof block.text === "string" && block.text.length > 0;
    }
    if (block.type === "thinking") {
      return typeof block.thinking === "string" && block.thinking.length > 0;
    }
    if (block.type === "toolCall") {
      return true;
    }
    return false;
  });
}

function shouldMarkFirstResponse(event: AssistantMessageEvent): boolean {
  return (
    event.type === "text_start" ||
    event.type === "text_delta" ||
    event.type === "text_end" ||
    event.type === "thinking_start" ||
    event.type === "thinking_delta" ||
    event.type === "thinking_end" ||
    event.type === "toolcall_start" ||
    event.type === "toolcall_delta" ||
    event.type === "toolcall_end"
  );
}

function wrapAssistantMessageEventStreamWithMetrics(
  stream: AssistantMessageEventStream,
  params: {
    runId: string;
    startedAtMs: number;
  },
): AssistantMessageEventStream {
  const { runId, startedAtMs } = params;
  recordAssistantRequestStart(runId, startedAtMs);

  let firstResponseRecorded = false;
  let endRecorded = false;

  const markFirstResponse = (atMs = Date.now()) => {
    if (firstResponseRecorded) {
      return;
    }
    firstResponseRecorded = true;
    recordAssistantRequestFirstDelta(runId, atMs);
  };

  const markEnd = (atMs = Date.now()) => {
    if (endRecorded) {
      return;
    }
    endRecorded = true;
    recordAssistantRequestEnd(runId, atMs);
  };

  const wrappedStream = Object.create(stream) as AssistantMessageEventStream;
  wrappedStream[Symbol.asyncIterator] = async function* () {
    try {
      for await (const event of stream) {
        const now = Date.now();
        if (shouldMarkFirstResponse(event)) {
          markFirstResponse(now);
        }
        if (event.type === "done") {
          if (hasAssistantOutput(event.message)) {
            markFirstResponse(now);
          }
          markEnd(now);
        } else if (event.type === "error") {
          if (hasAssistantOutput(event.error)) {
            markFirstResponse(now);
          }
          markEnd(now);
        }
        yield event;
      }
    } catch (error) {
      markEnd();
      throw error;
    }
  };
  wrappedStream.result = async () => {
    try {
      const result = await stream.result();
      const now = Date.now();
      if (hasAssistantOutput(result)) {
        markFirstResponse(now);
      }
      markEnd(now);
      return result;
    } catch (error) {
      markEnd();
      throw error;
    }
  };
  return wrappedStream;
}

export function runTrackedModelRequest<TApi extends Api, TOptions extends ModelRequestOptions>(params: {
  runId: string;
  request: (
    model: Model<TApi>,
    context: Context,
    options?: TOptions,
  ) => AssistantMessageEventStream | Promise<AssistantMessageEventStream>;
  model: Model<TApi>;
  context: Context;
  options?: TOptions;
  startedAtMs?: number;
  payloadLog?: ModelRequestPayloadLogParams;
}): AssistantMessageEventStream | Promise<AssistantMessageEventStream> {
  const startedAtMs = params.startedAtMs ?? Date.now();
  const payloadLogger = createModelPayloadLogger({
    env: params.payloadLog?.env,
    runId: params.runId,
    sessionId: params.payloadLog?.sessionId,
    sessionKey: params.payloadLog?.sessionKey,
    provider: params.payloadLog?.provider ?? params.model.provider,
    modelId: params.payloadLog?.modelId ?? params.model.id,
    modelApi: params.payloadLog?.modelApi ?? params.model.api,
    workspaceDir: params.payloadLog?.workspaceDir,
  });
  const request = payloadLogger
    ? (payloadLogger.wrapStreamFn(params.request as unknown as StreamFn) as unknown as ModelRequestFn)
    : (params.request as ModelRequestFn);
  const response = request(params.model as Model<Api>, params.context, params.options);
  const wrap = (stream: AssistantMessageEventStream) =>
    wrapAssistantMessageEventStreamWithMetrics(stream, {
      runId: params.runId,
      startedAtMs,
    });
  if (response && typeof (response as Promise<AssistantMessageEventStream>).then === "function") {
    return (response as Promise<AssistantMessageEventStream>).then(wrap);
  }
  return wrap(response as AssistantMessageEventStream);
}

export function wrapStreamFnWithModelRequestTracking(
  streamFn: StreamFn,
  params: {
    runId: string;
    payloadLog?: ModelRequestPayloadLogParams;
  },
): StreamFn {
  const wrapped: StreamFn = (model, context, options) =>
    runTrackedModelRequest({
      runId: params.runId,
      request: streamFn as ModelRequestFn,
      model: model as Model<Api>,
      context: context as Context,
      options: options as ModelRequestOptions,
      payloadLog: params.payloadLog,
    }) as ReturnType<StreamFn>;
  return wrapped;
}

export function wrapStreamFnWithModelRequestMetrics(streamFn: StreamFn, runId: string): StreamFn {
  return wrapStreamFnWithModelRequestTracking(streamFn, { runId });
}
