import crypto from "node:crypto";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("agent/request-telemetry");

export type RequestFactRow = {
  observed_at: string;
  request_id: string;
  service_origin: string;
  environment: string;
  status: string;
  trace_id?: string;
  run_id?: string;
  workspace_id?: string;
  end_user_id?: string;
  session_key?: string;
  channel?: string;
  capability?: string;
  route_key?: string;
  provider?: string;
  model?: string;
  status_code?: number;
  error_type?: string;
  error_message?: string;
  total_ms?: number;
  openclaw_pre_model_ms?: number;
  openclaw_first_token_wait_ms?: number;
  openclaw_stream_total_ms?: number;
  metadata?: Record<string, unknown>;
};

export type RequestPhaseRow = {
  observed_at: string;
  request_id: string;
  service_origin: string;
  phase_name: string;
  phase_order: number;
  status: string;
  start_at: string;
  end_at: string;
  duration_ms: number;
  trace_id?: string;
  run_id?: string;
  workspace_id?: string;
  end_user_id?: string;
  provider?: string;
  model?: string;
  metadata?: Record<string, unknown>;
};

export type PayloadRefRow = {
  request_id: string;
  blob_type: string;
  storage_provider: string;
  storage_uri: string;
  trace_id?: string;
  content_sha256?: string;
  size_bytes?: number;
  redaction_profile?: string;
  encrypted?: boolean;
  retention_expires_at?: string;
  metadata?: Record<string, unknown>;
};

export type TelemetryBatch = {
  requests: RequestFactRow[];
  phases: RequestPhaseRow[];
  payload_refs: PayloadRefRow[];
};

export function summarizeTelemetryBatch(batch: TelemetryBatch): Record<string, unknown> {
  const firstRequest = batch.requests[0];
  return {
    requestId: firstRequest?.request_id,
    serviceOrigin: firstRequest?.service_origin,
    environment: firstRequest?.environment,
    status: firstRequest?.status,
    routeKey: firstRequest?.route_key,
    provider: firstRequest?.provider,
    model: firstRequest?.model,
    requestCount: batch.requests.length,
    phaseCount: batch.phases.length,
    payloadRefCount: batch.payload_refs.length,
  };
}

export function summarizeBustlyGatewayDispatch(params: {
  requestId: string;
  traceId?: string;
  workspaceId?: string;
  provider?: string;
  model?: string;
  routeKey?: string;
  baseUrl?: string;
}): Record<string, unknown> {
  return {
    requestId: params.requestId,
    traceId: params.traceId,
    workspaceId: params.workspaceId,
    provider: params.provider,
    model: params.model,
    routeKey: params.routeKey,
    baseUrl: params.baseUrl,
  };
}

export type TelemetrySink = {
  sendBatch: (batch: TelemetryBatch) => Promise<void>;
};

type TelemetryIngestClientOptions = {
  baseUrl: string;
  serviceName: string;
  ingestKey: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

type PhaseHandle = {
  phaseName: string;
  phaseOrder: number;
  startAt: Date;
  startPerf: number;
  provider?: string;
  model?: string;
  metadata: Record<string, unknown>;
};

type TelemetryClock = {
  now: () => Date;
  perfNow: () => number;
};

type OpenClawTelemetryRecorderOptions = {
  sink: TelemetrySink;
  serviceOrigin: string;
  environment: string;
  requestId: string;
  capability: string;
  traceId?: string;
  runId?: string;
  workspaceId?: string;
  endUserId?: string;
  sessionKey?: string;
  channel?: string;
  routeKey?: string;
  provider?: string;
  model?: string;
  clock?: TelemetryClock;
};

type EmitRequestOptions = {
  status: string;
  statusCode?: number;
  errorType?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
};

type TraceContext = {
  requestId: string;
  traceId: string;
  traceparent: string;
};

const DEFAULT_TIMEOUT_MS = 2_500;
const defaultClock: TelemetryClock = {
  now: () => new Date(),
  perfNow: () => performance.now(),
};

function durationMs(startPerf: number, endPerf: number): number {
  return Math.max(0, Math.round(endPerf - startPerf));
}

export function createTelemetryTraceContext(): TraceContext {
  const requestId = `req_${crypto.randomUUID().replace(/-/g, "")}`;
  const traceId = crypto.randomBytes(16).toString("hex");
  const spanId = crypto.randomBytes(8).toString("hex");
  return {
    requestId,
    traceId,
    traceparent: `00-${traceId}-${spanId}-01`,
  };
}

export function buildBustlyTelemetryHeaders(params: {
  modelHeaders?: Record<string, string>;
  optionHeaders?: Record<string, string>;
  workspaceId?: string | null;
  requestId: string;
  traceparent: string;
}): Record<string, string> {
  const mergedHeaders = {
    ...params.modelHeaders,
    ...params.optionHeaders,
  };
  if (params.workspaceId?.trim()) {
    mergedHeaders["X-Workspace-Id"] = params.workspaceId.trim();
  }
  mergedHeaders["x-request-id"] = params.requestId;
  mergedHeaders.traceparent = params.traceparent;
  return mergedHeaders;
}

export class TelemetryIngestClient implements TelemetrySink {
  readonly baseUrl: string;
  readonly serviceName: string;
  readonly ingestKey: string;
  readonly timeoutMs: number;
  readonly fetchImpl: typeof fetch | undefined;
  readonly enabled: boolean;

  constructor(options: TelemetryIngestClientOptions) {
    this.baseUrl = options.baseUrl.trim().replace(/\/+$/, "");
    this.serviceName = options.serviceName.trim();
    this.ingestKey = options.ingestKey.trim();
    this.timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.enabled = Boolean(this.baseUrl && this.serviceName && this.ingestKey && this.fetchImpl);
  }

  async sendBatch(batch: TelemetryBatch): Promise<void> {
    if (!this.enabled || !this.fetchImpl) {
      return;
    }

    const batchSummary = summarizeTelemetryBatch(batch);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/api/v1/ingest/request-batch`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-service-name": this.serviceName,
          "x-ingest-key": this.ingestKey,
        },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) {
        log.warn("telemetry ingest request-batch failed", {
          ...batchSummary,
          baseUrl: this.baseUrl,
          status: response.status,
          serviceName: this.serviceName,
        });
        return;
      }
      log.info("telemetry ingest request-batch accepted", {
        ...batchSummary,
        baseUrl: this.baseUrl,
        status: response.status,
        serviceName: this.serviceName,
      });
    } catch (error) {
      log.warn("telemetry ingest request-batch failed", {
        ...batchSummary,
        baseUrl: this.baseUrl,
        serviceName: this.serviceName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export function createTelemetryIngestClientFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): TelemetrySink {
  const baseUrl = env.OPENCLAW_TELEMETRY_INGEST_BASE_URL?.trim() ?? "";
  const serviceName = env.OPENCLAW_TELEMETRY_INGEST_SERVICE_NAME?.trim() || "openclaw";
  const ingestKey = env.OPENCLAW_TELEMETRY_INGEST_KEY?.trim() ?? "";
  const timeoutMs = Number.parseInt(env.OPENCLAW_TELEMETRY_INGEST_TIMEOUT_MS ?? "", 10);
  return new TelemetryIngestClient({
    baseUrl,
    serviceName,
    ingestKey,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS,
  });
}

export class OpenClawTelemetryRecorder {
  readonly sink: TelemetrySink;
  readonly serviceOrigin: string;
  readonly environment: string;
  readonly requestId: string;
  readonly capability: string;
  readonly traceId?: string;
  readonly runId?: string;
  readonly workspaceId?: string;
  readonly endUserId?: string;
  readonly sessionKey?: string;
  readonly channel?: string;
  readonly routeKey?: string;
  readonly provider?: string;
  readonly model?: string;
  readonly clock: TelemetryClock;
  readonly requestStartedAt: Date;
  readonly requestStartedPerf: number;
  readonly phases: RequestPhaseRow[] = [];
  private phaseOrder = 0;
  private modelDispatchedAt?: Date;
  private modelDispatchedPerf?: number;
  private streamHandle?: PhaseHandle;
  private openclawPreModelMs?: number;
  private openclawFirstTokenWaitMs?: number;
  private openclawStreamTotalMs?: number;

  constructor(options: OpenClawTelemetryRecorderOptions) {
    this.sink = options.sink;
    this.serviceOrigin = options.serviceOrigin;
    this.environment = options.environment;
    this.requestId = options.requestId;
    this.capability = options.capability;
    this.traceId = options.traceId;
    this.runId = options.runId;
    this.workspaceId = options.workspaceId;
    this.endUserId = options.endUserId;
    this.sessionKey = options.sessionKey;
    this.channel = options.channel;
    this.routeKey = options.routeKey;
    this.provider = options.provider;
    this.model = options.model;
    this.clock = options.clock ?? defaultClock;
    this.requestStartedAt = this.clock.now();
    this.requestStartedPerf = this.clock.perfNow();
  }

  startPhase(
    phaseName: string,
    options?: {
      provider?: string;
      model?: string;
      metadata?: Record<string, unknown>;
    },
  ): PhaseHandle {
    const handle: PhaseHandle = {
      phaseName,
      phaseOrder: this.phaseOrder,
      startAt: this.clock.now(),
      startPerf: this.clock.perfNow(),
      provider: options?.provider,
      model: options?.model,
      metadata: { ...options?.metadata },
    };
    this.phaseOrder += 1;
    return handle;
  }

  endPhase(
    handle: PhaseHandle,
    options?: {
      status?: string;
      provider?: string;
      model?: string;
      metadata?: Record<string, unknown>;
    },
  ): number {
    const endAt = this.clock.now();
    const endPerf = this.clock.perfNow();
    const duration = durationMs(handle.startPerf, endPerf);
    this.phases.push({
      observed_at: endAt.toISOString(),
      request_id: this.requestId,
      service_origin: this.serviceOrigin,
      phase_name: handle.phaseName,
      phase_order: handle.phaseOrder,
      status: options?.status ?? "ok",
      start_at: handle.startAt.toISOString(),
      end_at: endAt.toISOString(),
      duration_ms: duration,
      trace_id: this.traceId,
      run_id: this.runId,
      workspace_id: this.workspaceId,
      end_user_id: this.endUserId,
      provider: options?.provider ?? handle.provider,
      model: options?.model ?? handle.model,
      metadata: {
        ...handle.metadata,
        ...options?.metadata,
      },
    });
    return duration;
  }

  markModelDispatchStart(): void {
    if (this.modelDispatchedPerf !== undefined) {
      return;
    }
    this.modelDispatchedAt = this.clock.now();
    this.modelDispatchedPerf = this.clock.perfNow();
    this.openclawPreModelMs = durationMs(this.requestStartedPerf, this.modelDispatchedPerf);
    this.streamHandle = this.startPhase("openclaw.model.stream_total", {
      provider: this.provider,
      model: this.model,
    });
  }

  markFirstToken(): void {
    if (this.modelDispatchedAt === undefined || this.modelDispatchedPerf === undefined) {
      return;
    }
    if (this.openclawFirstTokenWaitMs !== undefined) {
      return;
    }
    const endAt = this.clock.now();
    const endPerf = this.clock.perfNow();
    const duration = durationMs(this.modelDispatchedPerf, endPerf);
    this.openclawFirstTokenWaitMs = duration;
    this.phases.push({
      observed_at: endAt.toISOString(),
      request_id: this.requestId,
      service_origin: this.serviceOrigin,
      phase_name: "openclaw.model.first_token_wait",
      phase_order: this.phaseOrder,
      status: "ok",
      start_at: this.modelDispatchedAt.toISOString(),
      end_at: endAt.toISOString(),
      duration_ms: duration,
      trace_id: this.traceId,
      run_id: this.runId,
      workspace_id: this.workspaceId,
      end_user_id: this.endUserId,
      provider: this.provider,
      model: this.model,
      metadata: {},
    });
    this.phaseOrder += 1;
    log.info("model first token received", {
      requestId: this.requestId,
      traceId: this.traceId,
      provider: this.provider,
      model: this.model,
      routeKey: this.routeKey,
      openclawFirstTokenWaitMs: duration,
    });
  }

  completeModelStream(status = "ok"): number | undefined {
    if (!this.streamHandle) {
      return undefined;
    }
    const duration = this.endPhase(this.streamHandle, { status });
    this.streamHandle = undefined;
    this.openclawStreamTotalMs = duration;
    return duration;
  }

  async emitRequest(options: EmitRequestOptions): Promise<void> {
    const observedAt = this.clock.now();
    const totalMs = durationMs(this.requestStartedPerf, this.clock.perfNow());
    const batch = {
      requests: [
        {
          observed_at: observedAt.toISOString(),
          request_id: this.requestId,
          service_origin: this.serviceOrigin,
          environment: this.environment,
          status: options.status,
          trace_id: this.traceId,
          run_id: this.runId,
          workspace_id: this.workspaceId,
          end_user_id: this.endUserId,
          session_key: this.sessionKey,
          channel: this.channel,
          capability: this.capability,
          route_key: this.routeKey,
          provider: this.provider,
          model: this.model,
          status_code: options.statusCode,
          error_type: options.errorType,
          error_message: options.errorMessage,
          total_ms: totalMs,
          openclaw_pre_model_ms: this.openclawPreModelMs,
          openclaw_first_token_wait_ms: this.openclawFirstTokenWaitMs,
          openclaw_stream_total_ms: this.openclawStreamTotalMs,
          metadata: { ...options.metadata },
        },
      ],
      phases: this.phases.slice(),
      payload_refs: [],
    } satisfies TelemetryBatch;
    log.info("openclaw request completed", {
      requestId: this.requestId,
      traceId: this.traceId,
      provider: this.provider,
      model: this.model,
      routeKey: this.routeKey,
      status: options.status,
      totalMs,
      openclawPreModelMs: this.openclawPreModelMs,
      openclawFirstTokenWaitMs: this.openclawFirstTokenWaitMs,
      openclawStreamTotalMs: this.openclawStreamTotalMs,
      phaseCount: this.phases.length,
    });
    await this.sink.sendBatch(batch);
  }
}
