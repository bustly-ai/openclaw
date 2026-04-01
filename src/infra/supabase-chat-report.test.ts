import fs from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { reportSessionCompletionToSupabase } from "./supabase-chat-report.js";

const { readBustlyOAuthState, resolveSessionAgentId, resolveStorePath, loadSessionStore } =
  vi.hoisted(() => ({
    readBustlyOAuthState: vi.fn(),
    resolveSessionAgentId: vi.fn(),
    resolveStorePath: vi.fn(),
    loadSessionStore: vi.fn(),
  }));

vi.mock("../bustly-oauth.js", () => ({
  readBustlyOAuthState,
}));

vi.mock("../agents/agent-scope.js", () => ({
  resolveSessionAgentId,
}));

vi.mock("../config/sessions.js", async () => {
  const actual =
    await vi.importActual<typeof import("../config/sessions.js")>("../config/sessions.js");
  return {
    ...actual,
    resolveStorePath,
    loadSessionStore,
  };
});

describe("reportSessionCompletionToSupabase", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("enriches assistant metadata with latest run timings and token totals", async () => {
    readBustlyOAuthState.mockReturnValue({
      supabase: {
        url: "https://example.supabase.co",
        anonKey: "anon-key",
      },
      user: {
        userId: "2af519fc-3590-486d-aedf-91393a633b96",
        workspaceId: "173cb0fb-c801-4588-86aa-a1797cffa414",
        userAccessToken: "access-token",
      },
    });
    resolveSessionAgentId.mockReturnValue("main");
    resolveStorePath.mockReturnValue("/tmp/sessions.json");
    loadSessionStore.mockReturnValue({
      main: {
        sessionId: "sess-1",
        updatedAt: Date.now(),
        sessionFile: "/tmp/session-main.jsonl",
        totalTokens: 15460,
        totalTokensFresh: true,
        inputTokens: 15439,
        outputTokens: 21,
        latestRunTtftMs: 4554,
        latestRunTtlrMs: 6800,
      },
    });

    vi.spyOn(fs, "readFile").mockResolvedValue(
      [
        JSON.stringify({
          type: "message",
          id: "assistant-1",
          parentId: "user-1",
          timestamp: "2026-03-30T03:06:10.763Z",
          message: {
            role: "assistant",
            model: "chat.advanced",
            provider: "bustly",
            usage: {
              input: 0,
              output: 0,
              totalTokens: 0,
            },
            content: [{ type: "text", text: "早上好！" }],
          },
        }),
      ].join("\n"),
    );

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock);

    await reportSessionCompletionToSupabase({
      sessionKey: "main",
      messageSid: "run-1774839963983-c53ivqa",
      cfg: {} as never,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] ?? [];
    const rows = JSON.parse(String(init?.body));
    expect(rows).toHaveLength(1);
    const metadata = rows[0]?.metadata;
    expect(metadata?.messageSid).toBe("run-1774839963983-c53ivqa");
    expect(metadata?.ttftMs).toBe(4554);
    expect(metadata?.ttlrMs).toBe(6800);
    expect(metadata?.raw?.message?.usage?.totalTokens).toBe(15460);
    expect(metadata?.raw?.message?.usage?.input).toBe(15439);
    expect(metadata?.raw?.message?.usage?.output).toBe(21);
  });
});
