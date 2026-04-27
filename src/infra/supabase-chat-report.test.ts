import { beforeEach, describe, expect, it, vi } from "vitest";

const fsMocks = vi.hoisted(() => ({
  readFile: vi.fn(),
}));

const oauthMocks = vi.hoisted(() => ({
  readBustlyOAuthState: vi.fn(),
  bustlyNodeRequest: vi.fn(),
}));

const sessionMocks = vi.hoisted(() => ({
  loadSessionStore: vi.fn(),
  resolveStorePath: vi.fn(() => "/tmp/sessions.json"),
}));

function readJsonBody(body: unknown): unknown {
  if (typeof body !== "string") {
    throw new Error("expected string body");
  }
  return JSON.parse(body);
}

vi.mock("node:fs/promises", () => ({
  default: {
    readFile: fsMocks.readFile,
  },
}));

vi.mock("../bustly-oauth.js", () => ({
  readBustlyOAuthState: oauthMocks.readBustlyOAuthState,
  readBustlyOAuthStateEnsuringFreshToken: oauthMocks.readBustlyOAuthState,
  getBustlyAccessToken: (
    state: { user?: { supabaseAccessToken?: string; userAccessToken?: string } } | null | undefined,
  ) => state?.user?.supabaseAccessToken?.trim() ?? state?.user?.userAccessToken?.trim() ?? "",
}));

vi.mock("../bustly/http.js", () => ({
  bustlyNodeRequest: oauthMocks.bustlyNodeRequest,
}));

vi.mock("../config/sessions.js", () => ({
  loadSessionStore: sessionMocks.loadSessionStore,
  resolveStorePath: sessionMocks.resolveStorePath,
}));

vi.mock("../agents/agent-scope.js", () => ({
  resolveSessionAgentId: vi.fn(() => "main"),
}));

const { reportSessionCompletionToSupabase } = await import("./supabase-chat-report.js");

describe("reportSessionCompletionToSupabase", () => {
  beforeEach(() => {
    fsMocks.readFile.mockReset();
    oauthMocks.readBustlyOAuthState.mockReset();
    oauthMocks.bustlyNodeRequest.mockReset();
    sessionMocks.loadSessionStore.mockReset();
    sessionMocks.resolveStorePath.mockClear();
    oauthMocks.bustlyNodeRequest.mockResolvedValue(new Response("", { status: 201 }));
  });

  it("writes request metrics onto each assistant row in order", async () => {
    const sessionKey = "agent:main:main";
    const sessionFile = `/tmp/${Date.now()}-session.jsonl`;
    fsMocks.readFile.mockResolvedValue(
      [
        JSON.stringify({ type: "session", id: "session-1" }),
        JSON.stringify({
          type: "message",
          id: "user-1",
          timestamp: "2026-03-30T00:00:00.000Z",
          message: {
            id: "user-1",
            role: "user",
            content: "Hi",
          },
        }),
        JSON.stringify({
          type: "message",
          id: "assistant-1",
          timestamp: "2026-03-30T00:00:01.000Z",
          message: {
            id: "assistant-1",
            role: "assistant",
            content: "Hello",
          },
        }),
        JSON.stringify({
          type: "message",
          id: "assistant-2",
          timestamp: "2026-03-30T00:00:02.000Z",
          message: {
            id: "assistant-2",
            role: "assistant",
            content: "Done",
          },
        }),
      ].join("\n"),
    );
    oauthMocks.readBustlyOAuthState.mockReturnValue({
      supabase: {
        url: "https://example.supabase.co",
        anonKey: "anon-key",
      },
      user: {
        userId: "11111111-1111-4111-8111-111111111111",
        workspaceId: "22222222-2222-4222-8222-222222222222",
        userAccessToken: "access-token",
      },
    });
    sessionMocks.loadSessionStore.mockReturnValue({
      [sessionKey]: {
        sessionId: "session-1",
        sessionFile,
      },
    });

    await reportSessionCompletionToSupabase({
      sessionKey,
      messageSid: "run-123",
      assistantRequestMetrics: [
        {
          ttftMs: 120.4,
          ttlrMs: 200.2,
        },
        {
          ttftMs: 80.1,
          ttlrMs: 500.6,
        },
      ],
      cfg: {},
    });

    expect(oauthMocks.bustlyNodeRequest).toHaveBeenCalledTimes(2);
    const [, init] = oauthMocks.bustlyNodeRequest.mock.calls[1] ?? [];
    const body = readJsonBody(init?.body) as Array<{
      role?: string | null;
      metadata?: Record<string, unknown>;
    }>;
    expect(body).toHaveLength(3);
    expect(body[0]?.role).toBe("user");
    expect(body[0]?.metadata?.ttftMs).toBeUndefined();
    expect(body[0]?.metadata?.ttlrMs).toBeUndefined();
    expect(body[1]?.role).toBe("assistant");
    expect(body[1]?.metadata?.ttftMs).toBe(120);
    expect(body[1]?.metadata?.ttlrMs).toBe(200);
    expect(body[2]?.role).toBe("assistant");
    expect(body[2]?.metadata?.ttftMs).toBe(80);
    expect(body[2]?.metadata?.ttlrMs).toBe(501);
  });

  it("can report directly from sessionId and sessionFile without a session store entry", async () => {
    const sessionFile = `/tmp/${Date.now()}-direct-session.jsonl`;
    fsMocks.readFile.mockResolvedValue(
      [
        JSON.stringify({
          type: "message",
          id: "assistant-1",
          timestamp: "2026-03-30T00:00:01.000Z",
          message: {
            id: "assistant-1",
            role: "assistant",
            content: "Hello",
          },
        }),
      ].join("\n"),
    );
    oauthMocks.readBustlyOAuthState.mockReturnValue({
      supabase: {
        url: "https://example.supabase.co",
        anonKey: "anon-key",
      },
      user: {
        userId: "11111111-1111-4111-8111-111111111111",
        workspaceId: "22222222-2222-4222-8222-222222222222",
        userAccessToken: "access-token",
      },
    });
    sessionMocks.loadSessionStore.mockReturnValue({});

    await reportSessionCompletionToSupabase({
      sessionId: "session-direct-1",
      sessionFile,
      messageSid: "run-direct-123",
      assistantRequestMetrics: [{ ttftMs: 90.8, ttlrMs: 210.2 }],
      cfg: {},
    });

    expect(oauthMocks.bustlyNodeRequest).toHaveBeenCalledTimes(2);
    expect(sessionMocks.loadSessionStore).not.toHaveBeenCalled();
    const [, init] = oauthMocks.bustlyNodeRequest.mock.calls[1] ?? [];
    const body = readJsonBody(init?.body) as Array<{
      session_id?: string;
      session_key?: string;
      metadata?: Record<string, unknown>;
    }>;
    expect(body).toHaveLength(1);
    expect(body[0]?.session_id).toBe("session-direct-1");
    expect(body[0]?.session_key).toBe("session-direct-1");
    expect(body[0]?.metadata?.ttftMs).toBe(91);
    expect(body[0]?.metadata?.ttlrMs).toBe(210);
  });

  it("does not repost old transcript rows on cold start when the session already exists in supabase", async () => {
    const sessionFile = `/tmp/${Date.now()}-cold-start-session.jsonl`;
    fsMocks.readFile.mockResolvedValue(
      [
        JSON.stringify({
          type: "message",
          id: "assistant-old",
          timestamp: "2026-03-30T00:00:01.000Z",
          message: {
            id: "assistant-old",
            role: "assistant",
            content: "Earlier reply",
          },
        }),
        JSON.stringify({
          type: "message",
          id: "user-new",
          timestamp: "2026-03-30T00:01:00.000Z",
          message: {
            id: "user-new",
            role: "user",
            content: "Latest prompt",
          },
        }),
        JSON.stringify({
          type: "message",
          id: "assistant-new",
          timestamp: "2026-03-30T00:01:05.000Z",
          message: {
            id: "assistant-new",
            role: "assistant",
            content: "Latest reply",
          },
        }),
      ].join("\n"),
    );
    oauthMocks.readBustlyOAuthState.mockReturnValue({
      supabase: {
        url: "https://example.supabase.co",
        anonKey: "anon-key",
      },
      user: {
        userId: "11111111-1111-4111-8111-111111111111",
        workspaceId: "22222222-2222-4222-8222-222222222222",
        userAccessToken: "access-token",
      },
    });
    sessionMocks.loadSessionStore.mockReturnValue({});

    oauthMocks.bustlyNodeRequest
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ message_id: "assistant-old" }]), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response("", { status: 201 }));

    await reportSessionCompletionToSupabase({
      sessionId: "session-cold-start-1",
      sessionFile,
      messageSid: "run-cold-start-123",
      assistantRequestMetrics: [{ ttftMs: 101.2, ttlrMs: 305.8 }],
      cfg: {},
    });

    expect(oauthMocks.bustlyNodeRequest).toHaveBeenCalledTimes(2);
    const [, postInit] = oauthMocks.bustlyNodeRequest.mock.calls[1] ?? [];
    const body = readJsonBody(postInit?.body) as Array<{
      message_id?: string;
      metadata?: Record<string, unknown>;
    }>;
    expect(body).toHaveLength(2);
    expect(body.map((row) => row.message_id)).toEqual(["user-new", "assistant-new"]);
    expect(body[1]?.metadata?.ttftMs).toBe(101);
    expect(body[1]?.metadata?.ttlrMs).toBe(306);
  });
});
