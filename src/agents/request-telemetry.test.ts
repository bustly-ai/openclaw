import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildBustlyTelemetryHeaders,
  summarizeBustlyGatewayDispatch,
  summarizeTelemetryBatch,
  OpenClawTelemetryRecorder,
  TelemetryIngestClient,
  type TelemetryBatch,
} from "./request-telemetry.js";

type FakeClock = {
  now: () => Date;
  perfNow: () => number;
  advance: (ms: number) => void;
};

function createFakeClock(): FakeClock {
  let current = Date.parse("2026-03-29T10:00:00.000Z");
  let perf = 0;
  return {
    now: () => new Date(current),
    perfNow: () => perf,
    advance: (ms) => {
      current += ms;
      perf += ms;
    },
  };
}

describe("buildBustlyTelemetryHeaders", () => {
  it("merges workspace, request, and trace headers into the outbound request", () => {
    expect(
      buildBustlyTelemetryHeaders({
        modelHeaders: { Authorization: "Bearer token" },
        optionHeaders: { "x-custom-header": "custom" },
        workspaceId: "workspace-123",
        requestId: "req_abc123",
        traceparent: "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01",
      }),
    ).toEqual({
      Authorization: "Bearer token",
      "x-custom-header": "custom",
      "X-Workspace-Id": "workspace-123",
      "x-request-id": "req_abc123",
      traceparent: "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01",
    });
  });

  it("omits the workspace header when no workspace id is available", () => {
    expect(
      buildBustlyTelemetryHeaders({
        requestId: "req_abc123",
        traceparent: "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01",
      }),
    ).toEqual({
      "x-request-id": "req_abc123",
      traceparent: "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01",
    });
  });
});

describe("summarizeBustlyGatewayDispatch", () => {
  it("builds a compact log payload for outbound gateway requests", () => {
    expect(
      summarizeBustlyGatewayDispatch({
        requestId: "req_abc123",
        traceId: "0123456789abcdef0123456789abcdef",
        workspaceId: "workspace-123",
        provider: "bustly",
        model: "chat.standard",
        routeKey: "chat.standard",
        baseUrl: "https://test-gw.bustly.ai/api/v1",
      }),
    ).toEqual({
      requestId: "req_abc123",
      traceId: "0123456789abcdef0123456789abcdef",
      workspaceId: "workspace-123",
      provider: "bustly",
      model: "chat.standard",
      routeKey: "chat.standard",
      baseUrl: "https://test-gw.bustly.ai/api/v1",
    });
  });
});

describe("summarizeTelemetryBatch", () => {
  it("captures the first request summary for ingest logs", () => {
    const batch: TelemetryBatch = {
      requests: [
        {
          observed_at: "2026-03-29T10:00:00.000Z",
          request_id: "req_abc123",
          service_origin: "openclaw",
          environment: "test",
          status: "ok",
          route_key: "chat.standard",
          provider: "bustly",
          model: "chat.standard",
        },
      ],
      phases: [{ request_id: "req_abc123" } as never],
      payload_refs: [],
    };

    expect(summarizeTelemetryBatch(batch)).toEqual({
      requestId: "req_abc123",
      serviceOrigin: "openclaw",
      environment: "test",
      status: "ok",
      routeKey: "chat.standard",
      provider: "bustly",
      model: "chat.standard",
      requestCount: 1,
      phaseCount: 1,
      payloadRefCount: 0,
    });
  });
});

describe("TelemetryIngestClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts request batches to telemetry-ingest with ingest headers", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new TelemetryIngestClient({
      baseUrl: "https://telemetry.example.com",
      serviceName: "openclaw",
      ingestKey: "ingest-secret",
      timeoutMs: 500,
    });

    const batch: TelemetryBatch = {
      requests: [
        {
          observed_at: "2026-03-29T10:00:00.000Z",
          request_id: "req_abc123",
          service_origin: "openclaw",
          environment: "test",
          status: "ok",
        },
      ],
      phases: [],
      payload_refs: [],
    };

    await client.sendBatch(batch);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://telemetry.example.com/api/v1/ingest/request-batch",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "content-type": "application/json",
          "x-service-name": "openclaw",
          "x-ingest-key": "ingest-secret",
        }),
      }),
    );
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual(batch);
  });
});

describe("OpenClawTelemetryRecorder", () => {
  it("emits request facts and phase timings for an embedded model run", async () => {
    const clock = createFakeClock();
    const sendBatch = vi.fn(async () => {});
    const recorder = new OpenClawTelemetryRecorder({
      sink: { sendBatch },
      serviceOrigin: "openclaw",
      environment: "test",
      requestId: "req_abc123",
      traceId: "0123456789abcdef0123456789abcdef",
      runId: "run_123",
      workspaceId: "11111111-1111-1111-1111-111111111111",
      endUserId: "user_123",
      sessionKey: "session:test",
      channel: "telegram",
      capability: "CHAT",
      provider: "bustly",
      model: "chat.standard",
      routeKey: "chat.standard",
      clock,
    });

    const sessionLoad = recorder.startPhase("openclaw.session.load");
    clock.advance(120);
    recorder.endPhase(sessionLoad);

    const promptBuild = recorder.startPhase("openclaw.prompt.build");
    clock.advance(80);
    recorder.endPhase(promptBuild);

    recorder.markModelDispatchStart();
    clock.advance(340);
    recorder.markFirstToken();
    clock.advance(410);
    recorder.completeModelStream();

    await recorder.emitRequest({
      status: "ok",
      metadata: { assistant_text_count: 1 },
    });

    expect(sendBatch).toHaveBeenCalledTimes(1);
    const [batch] = sendBatch.mock.calls[0] as [TelemetryBatch];
    expect(batch.requests).toHaveLength(1);
    expect(batch.phases).toHaveLength(4);
    expect(batch.requests[0]).toMatchObject({
      request_id: "req_abc123",
      service_origin: "openclaw",
      environment: "test",
      run_id: "run_123",
      workspace_id: "11111111-1111-1111-1111-111111111111",
      end_user_id: "user_123",
      session_key: "session:test",
      channel: "telegram",
      capability: "CHAT",
      provider: "bustly",
      model: "chat.standard",
      route_key: "chat.standard",
      openclaw_pre_model_ms: 200,
      openclaw_first_token_wait_ms: 340,
      openclaw_stream_total_ms: 750,
      total_ms: 950,
      metadata: { assistant_text_count: 1 },
    });
    expect(batch.phases.map((item) => item.phase_name)).toEqual([
      "openclaw.session.load",
      "openclaw.prompt.build",
      "openclaw.model.first_token_wait",
      "openclaw.model.stream_total",
    ]);
  });
});
