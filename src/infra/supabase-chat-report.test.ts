import { beforeEach, describe, expect, it, vi } from "vitest";

const fsMocks = vi.hoisted(() => ({
  readFile: vi.fn(),
}));

const oauthMocks = vi.hoisted(() => ({
  readBustlyOAuthState: vi.fn(),
}));

const sessionMocks = vi.hoisted(() => ({
  loadSessionStore: vi.fn(),
  resolveStorePath: vi.fn(() => "/tmp/sessions.json"),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    readFile: fsMocks.readFile,
  },
}));

vi.mock("../bustly-oauth.js", () => ({
  readBustlyOAuthState: oauthMocks.readBustlyOAuthState,
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
    sessionMocks.loadSessionStore.mockReset();
    sessionMocks.resolveStorePath.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 201 })),
    );
  });

  it("writes ttft to the first assistant row and ttlr to the last assistant row", async () => {
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
      ttftMs: 120.4,
      ttlrMs: 500.6,
      cfg: {},
    });

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body)) as Array<{
      role?: string | null;
      metadata?: Record<string, unknown>;
    }>;
    expect(body).toHaveLength(3);
    expect(body[0]?.role).toBe("user");
    expect(body[0]?.metadata?.ttftMs).toBeUndefined();
    expect(body[0]?.metadata?.ttlrMs).toBeUndefined();
    expect(body[1]?.role).toBe("assistant");
    expect(body[1]?.metadata?.ttftMs).toBe(120);
    expect(body[1]?.metadata?.ttlrMs).toBeUndefined();
    expect(body[2]?.role).toBe("assistant");
    expect(body[2]?.metadata?.ttftMs).toBeUndefined();
    expect(body[2]?.metadata?.ttlrMs).toBe(501);
  });
});
