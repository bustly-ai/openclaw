import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import "./test-helpers/fast-coding-tools.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as BustlyOAuth from "../bustly-oauth.js";
import type { OpenClawConfig } from "../config/config.js";
import { withEnvAsync } from "../test-utils/env.js";

function createMockUsage(input: number, output: number) {
  return {
    input,
    output,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: input + output,
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
    },
  };
}

const streamSimpleSpy = vi.fn((model: { api: string; provider: string; id: string }) => {
  throw new Error(
    `streamSimpleSpy called before mock initialization for ${model.provider}/${model.id}`,
  );
});

vi.mock("@mariozechner/pi-coding-agent", async () => {
  return await vi.importActual<typeof import("@mariozechner/pi-coding-agent")>(
    "@mariozechner/pi-coding-agent",
  );
});

vi.mock("@mariozechner/pi-ai", async () => {
  const actual = await vi.importActual<typeof import("@mariozechner/pi-ai")>("@mariozechner/pi-ai");

  const buildAssistantMessage = (model: { api: string; provider: string; id: string }) => ({
    role: "assistant" as const,
    content: [{ type: "text" as const, text: "ok" }],
    stopReason: "stop" as const,
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: createMockUsage(1, 1),
    timestamp: Date.now(),
  });

  const buildAssistantErrorMessage = (model: { api: string; provider: string; id: string }) => ({
    role: "assistant" as const,
    content: [],
    stopReason: "error" as const,
    errorMessage: "boom",
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: createMockUsage(0, 0),
    timestamp: Date.now(),
  });

  return {
    ...actual,
    complete: async (model: { api: string; provider: string; id: string }) => {
      if (model.id === "mock-error") {
        return buildAssistantErrorMessage(model);
      }
      return buildAssistantMessage(model);
    },
    completeSimple: async (model: { api: string; provider: string; id: string }) => {
      if (model.id === "mock-error") {
        return buildAssistantErrorMessage(model);
      }
      return buildAssistantMessage(model);
    },
    streamSimple: streamSimpleSpy.mockImplementation(
      (model: { api: string; provider: string; id: string }) => {
        const stream = actual.createAssistantMessageEventStream();
        queueMicrotask(() => {
          stream.push({
            type: "done",
            reason: "stop",
            message:
              model.id === "mock-error"
                ? buildAssistantErrorMessage(model)
                : buildAssistantMessage(model),
          });
          stream.end();
        });
        return stream;
      },
    ),
  };
});

let runEmbeddedPiAgent: typeof import("./pi-embedded-runner/run.js").runEmbeddedPiAgent;
let SessionManager: typeof import("@mariozechner/pi-coding-agent").SessionManager;
let tempRoot: string | undefined;
let agentDir: string;
let workspaceDir: string;
let sessionCounter = 0;
let runCounter = 0;

beforeAll(async () => {
  vi.useRealTimers();
  ({ runEmbeddedPiAgent } = await import("./pi-embedded-runner/run.js"));
  ({ SessionManager } = await import("@mariozechner/pi-coding-agent"));
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-embedded-agent-"));
  agentDir = path.join(tempRoot, "agent");
  workspaceDir = path.join(tempRoot, "workspace");
  await fs.mkdir(agentDir, { recursive: true });
  await fs.mkdir(workspaceDir, { recursive: true });
}, 180_000);

afterAll(async () => {
  if (!tempRoot) {
    return;
  }
  await fs.rm(tempRoot, { recursive: true, force: true });
  tempRoot = undefined;
});

const makeOpenAiConfig = (modelIds: string[]) =>
  ({
    models: {
      providers: {
        openai: {
          api: "openai-responses",
          apiKey: "sk-test",
          baseUrl: "https://example.com",
          models: modelIds.map((id) => ({
            id,
            name: `Mock ${id}`,
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 16_000,
            maxTokens: 2048,
          })),
        },
      },
    },
  }) satisfies OpenClawConfig;

const makeBustlyConfig = (modelIds: string[]) =>
  ({
    models: {
      providers: {
        bustly: {
          api: "openai-completions",
          apiKey: "gateway-test-key",
          baseUrl: "https://gw.bustly.ai/api/v1",
          models: modelIds.map((id) => ({
            id,
            name: `Bustly ${id}`,
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 16_000,
            maxTokens: 2048,
          })),
        },
      },
    },
  }) satisfies OpenClawConfig;

const nextSessionFile = () => {
  sessionCounter += 1;
  return path.join(workspaceDir, `session-${sessionCounter}.jsonl`);
};
const nextRunId = (prefix = "run-embedded-test") => `${prefix}-${++runCounter}`;
const nextSessionKey = () => `agent:test:embedded:${nextRunId("session-key")}`;
const immediateEnqueue = async <T>(task: () => Promise<T>) => task();

const runWithOrphanedSingleUserMessage = async (text: string, sessionKey: string) => {
  const sessionFile = nextSessionFile();
  const sessionManager = SessionManager.open(sessionFile);
  sessionManager.appendMessage({
    role: "user",
    content: [{ type: "text", text }],
    timestamp: Date.now(),
  });

  const cfg = makeOpenAiConfig(["mock-1"]);
  return await runEmbeddedPiAgent({
    sessionId: "session:test",
    sessionKey,
    sessionFile,
    workspaceDir,
    config: cfg,
    prompt: "hello",
    provider: "openai",
    model: "mock-1",
    timeoutMs: 5_000,
    agentDir,
    runId: nextRunId("orphaned-user"),
    enqueue: immediateEnqueue,
  });
};

const textFromContent = (content: unknown) => {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content) && content[0]?.type === "text") {
    return (content[0] as { text?: string }).text;
  }
  return undefined;
};

const readSessionEntries = async (sessionFile: string) => {
  const raw = await fs.readFile(sessionFile, "utf-8");
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { type?: string; customType?: string; data?: unknown });
};

const readSessionMessages = async (sessionFile: string) => {
  const entries = await readSessionEntries(sessionFile);
  return entries
    .filter((entry) => entry.type === "message")
    .map(
      (entry) => (entry as { message?: { role?: string; content?: unknown } }).message,
    ) as Array<{ role?: string; content?: unknown }>;
};

const runDefaultEmbeddedTurn = async (sessionFile: string, prompt: string, sessionKey: string) => {
  const cfg = makeOpenAiConfig(["mock-1"]);
  await runEmbeddedPiAgent({
    sessionId: "session:test",
    sessionKey,
    sessionFile,
    workspaceDir,
    config: cfg,
    prompt,
    provider: "openai",
    model: "mock-1",
    timeoutMs: 5_000,
    agentDir,
    runId: nextRunId("default-turn"),
    enqueue: immediateEnqueue,
  });
};

describe("runEmbeddedPiAgent", () => {
  it("handles prompt error paths without dropping user state", async () => {
    const sessionFile = nextSessionFile();
    const cfg = makeOpenAiConfig(["mock-error"]);
    const sessionKey = nextSessionKey();
    const result = await runEmbeddedPiAgent({
      sessionId: "session:test",
      sessionKey,
      sessionFile,
      workspaceDir,
      config: cfg,
      prompt: "boom",
      provider: "openai",
      model: "mock-error",
      timeoutMs: 5_000,
      agentDir,
      runId: nextRunId("prompt-error"),
      enqueue: immediateEnqueue,
    });
    expect(result.payloads?.[0]?.isError).toBe(true);

    const messages = await readSessionMessages(sessionFile);
    const userIndex = messages.findIndex(
      (message) => message?.role === "user" && textFromContent(message.content) === "boom",
    );
    expect(userIndex).toBeGreaterThanOrEqual(0);
  });

  it("emits telemetry batches and forwards request correlation headers for bustly runs", async () => {
    streamSimpleSpy.mockClear();
    const sessionFile = nextSessionFile();
    const sessionKey = nextSessionKey();
    const cfg = makeBustlyConfig(["chat.standard"]);
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));
    const oauthSpy = vi.spyOn(BustlyOAuth, "readBustlyOAuthState").mockReturnValue({
      deviceId: "device",
      callbackPort: 17900,
      user: {
        userId: "user-123",
        userName: "User",
        userEmail: "user@example.com",
        userAccessToken: "oauth-token",
        workspaceId: "11111111-1111-1111-1111-111111111111",
        skills: [],
      },
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      await withEnvAsync(
        {
          OPENCLAW_TELEMETRY_INGEST_BASE_URL: "https://telemetry.example.com",
          OPENCLAW_TELEMETRY_INGEST_KEY: "ingest-secret",
          OPENCLAW_TELEMETRY_INGEST_SERVICE_NAME: "openclaw",
          OPENCLAW_TELEMETRY_INGEST_TIMEOUT_MS: "500",
          ENV: "test",
        },
        async () => {
          await runEmbeddedPiAgent({
            sessionId: "session:test",
            sessionKey,
            sessionFile,
            workspaceDir,
            config: cfg,
            prompt: "hello bustly",
            provider: "bustly",
            model: "chat.standard",
            timeoutMs: 5_000,
            agentDir,
            runId: nextRunId("bustly-telemetry"),
            enqueue: immediateEnqueue,
          });
        },
      );

      const telemetryCalls = fetchMock.mock.calls.filter(
        ([url]) => url === "https://telemetry.example.com/api/v1/ingest/request-batch",
      );
      expect(telemetryCalls).toHaveLength(1);
      const [url, init] = telemetryCalls[0] ?? [];
      expect(url).toBe("https://telemetry.example.com/api/v1/ingest/request-batch");
      const body = JSON.parse(String(init?.body)) as {
        requests: Array<Record<string, unknown>>;
        phases: Array<Record<string, unknown>>;
      };
      expect(body.requests[0]).toMatchObject({
        service_origin: "openclaw",
        environment: "test",
        route_key: "chat.standard",
        provider: "bustly",
        model: "chat.standard",
        workspace_id: "11111111-1111-1111-1111-111111111111",
        end_user_id: "user-123",
      });
      expect(body.requests[0]?.request_id).toEqual(expect.any(String));
      expect(body.requests[0]?.openclaw_pre_model_ms).toEqual(expect.any(Number));
      expect(body.requests[0]?.openclaw_stream_total_ms).toEqual(expect.any(Number));
      expect(body.phases.map((item) => item.phase_name)).toEqual(
        expect.arrayContaining([
          "openclaw.session.load",
          "openclaw.session.sanitize",
          "openclaw.prompt.build",
          "openclaw.prompt.images",
          "openclaw.model.stream_total",
        ]),
      );

      expect(streamSimpleSpy).toHaveBeenCalled();
      const [modelArg, _contextArg, optionsArg] = streamSimpleSpy.mock.calls.at(-1) ?? [];
      const requestIdValue = body.requests[0]?.request_id;
      const forwardedRequestId = typeof requestIdValue === "string" ? requestIdValue : "";
      expect((modelArg as { headers?: Record<string, string> })?.headers?.["x-request-id"]).toBe(
        forwardedRequestId,
      );
      expect((optionsArg as { headers?: Record<string, string> })?.headers?.["x-request-id"]).toBe(
        forwardedRequestId,
      );
      expect((optionsArg as { headers?: Record<string, string> })?.headers?.traceparent).toEqual(
        expect.stringMatching(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/),
      );
    } finally {
      globalThis.fetch = originalFetch;
      oauthSpy.mockRestore();
    }
  });

  it(
    "appends new user + assistant after existing transcript entries",
    { timeout: 20_000 },
    async () => {
      const sessionFile = nextSessionFile();
      const sessionKey = nextSessionKey();

      const sessionManager = SessionManager.open(sessionFile);
      sessionManager.appendMessage({
        role: "user",
        content: [{ type: "text", text: "seed user" }],
        timestamp: Date.now(),
      });
      sessionManager.appendMessage({
        role: "assistant",
        content: [{ type: "text", text: "seed assistant" }],
        stopReason: "stop",
        api: "openai-responses",
        provider: "openai",
        model: "mock-1",
        usage: createMockUsage(1, 1),
        timestamp: Date.now(),
      });

      await runDefaultEmbeddedTurn(sessionFile, "hello", sessionKey);

      const messages = await readSessionMessages(sessionFile);
      const seedUserIndex = messages.findIndex(
        (message) => message?.role === "user" && textFromContent(message.content) === "seed user",
      );
      const seedAssistantIndex = messages.findIndex(
        (message) =>
          message?.role === "assistant" && textFromContent(message.content) === "seed assistant",
      );
      const newUserIndex = messages.findIndex(
        (message) => message?.role === "user" && textFromContent(message.content) === "hello",
      );
      const newAssistantIndex = messages.findIndex(
        (message, index) => index > newUserIndex && message?.role === "assistant",
      );
      expect(seedUserIndex).toBeGreaterThanOrEqual(0);
      expect(seedAssistantIndex).toBeGreaterThan(seedUserIndex);
      expect(newUserIndex).toBeGreaterThan(seedAssistantIndex);
      expect(newAssistantIndex).toBeGreaterThan(newUserIndex);
    },
  );

  it("repairs orphaned user messages and continues", async () => {
    const result = await runWithOrphanedSingleUserMessage("orphaned user", nextSessionKey());

    expect(result.meta.error).toBeUndefined();
    expect(result.payloads?.length ?? 0).toBeGreaterThan(0);
  });
});
