import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ResolvedGatewayAuth } from "./auth.js";
import { createGatewayHttpServer } from "./server-http.js";
import { withTempConfig } from "./test-temp-config.js";

const {
  readBustlyOAuthStateMock,
  setBustlyAuthCodeMock,
  completeBustlyLoginMock,
  synchronizeBustlyWorkspaceContextMock,
} = vi.hoisted(() => ({
  readBustlyOAuthStateMock: vi.fn(),
  setBustlyAuthCodeMock: vi.fn(),
  completeBustlyLoginMock: vi.fn(),
  synchronizeBustlyWorkspaceContextMock: vi.fn(async () => null),
}));

vi.mock("../bustly-oauth.js", () => ({
  readBustlyOAuthState: () => readBustlyOAuthStateMock(),
  setBustlyAuthCode: (code: string) => setBustlyAuthCodeMock(code),
  completeBustlyLogin: (params: unknown) => completeBustlyLoginMock(params),
}));

vi.mock("../bustly/workspace-runtime.js", () => ({
  synchronizeBustlyWorkspaceContext: (params: unknown) =>
    synchronizeBustlyWorkspaceContextMock(params),
}));

function createRequest(params: {
  path: string;
  method?: string;
}): IncomingMessage {
  const headers: Record<string, string> = {
    host: "localhost:18789",
  };
  return {
    method: params.method ?? "GET",
    url: params.path,
    headers,
    socket: { remoteAddress: "127.0.0.1" },
  } as IncomingMessage;
}

function createResponse(): {
  res: ServerResponse;
  setHeader: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  getBody: () => string;
} {
  const setHeader = vi.fn();
  let body = "";
  const end = vi.fn((chunk?: unknown) => {
    if (typeof chunk === "string") {
      body = chunk;
      return;
    }
    if (chunk == null) {
      body = "";
      return;
    }
    body = JSON.stringify(chunk);
  });
  const res = {
    headersSent: false,
    statusCode: 200,
    setHeader,
    end,
  } as unknown as ServerResponse;
  return {
    res,
    setHeader,
    end,
    getBody: () => body,
  };
}

async function dispatchRequest(
  server: ReturnType<typeof createGatewayHttpServer>,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  server.emit("request", req, res);
  await new Promise((resolve) => setImmediate(resolve));
}

function createSuccessfulTokenExchangeResponse() {
  return {
    status: "0",
    code: "0",
    message: "ok",
    data: {
      accessToken: "unused",
      workspaceId: "workspace-1",
      userId: "user-1",
      userName: "User One",
      userEmail: "user@example.com",
      skills: ["search-data", "memory"],
      extras: {
        "bustly-search-data": {
          search_DATA_SUPABASE_URL: "https://example.supabase.co",
          search_DATA_SUPABASE_ANON_KEY: "anon-key",
          search_DATA_WORKSPACE_ID: "workspace-1",
        },
        supabase_session: {
          access_token: "supabase-access-token",
          refresh_token: "supabase-refresh-token",
          expires_in: 3600,
          expires_at: 1_750_000_000,
          token_type: "bearer",
          user: {
            user_metadata: {
              avatar_url: "https://cdn.example.com/avatar.png",
            },
          },
        },
      },
    },
  };
}

describe("gateway bustly oauth callback runtime sync", () => {
  beforeEach(() => {
    readBustlyOAuthStateMock.mockReset();
    setBustlyAuthCodeMock.mockReset();
    completeBustlyLoginMock.mockReset();
    synchronizeBustlyWorkspaceContextMock.mockReset();
    synchronizeBustlyWorkspaceContextMock.mockResolvedValue(null);
    vi.stubEnv("BUSTLY_API_BASE_URL", "https://api.bustly.example");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("syncs bustly runtime context after successful oauth callback login", async () => {
    readBustlyOAuthStateMock.mockReturnValue({
      loginTraceId: "trace-1",
    });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => createSuccessfulTokenExchangeResponse(),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const resolvedAuth: ResolvedGatewayAuth = {
      mode: "none",
      token: undefined,
      password: undefined,
      allowTailscale: false,
    };

    await withTempConfig({
      cfg: { gateway: { trustedProxies: [] } },
      prefix: "openclaw-bustly-oauth-callback-sync-test-",
      run: async () => {
        const server = createGatewayHttpServer({
          canvasHost: null,
          clients: new Set(),
          controlUiEnabled: false,
          controlUiBasePath: "/__control__",
          openAiChatCompletionsEnabled: false,
          openResponsesEnabled: false,
          handleHooksRequest: async () => false,
          resolvedAuth,
        });

        const response = createResponse();
        await dispatchRequest(
          server,
          createRequest({ path: "/authorize?code=oauth-code&state=trace-1" }),
          response.res,
        );

        expect(setBustlyAuthCodeMock).toHaveBeenCalledWith("oauth-code");
        expect(completeBustlyLoginMock).toHaveBeenCalledTimes(1);
        expect(synchronizeBustlyWorkspaceContextMock).toHaveBeenCalledWith({
          workspaceId: "workspace-1",
          allowCreateConfig: true,
          userAgent: "openclaw-cloud",
        });
        expect(response.res.statusCode).toBe(200);
        expect(response.getBody()).toContain("Login completed");
      },
    });
  });

  test("does not fail oauth callback response when runtime sync throws", async () => {
    readBustlyOAuthStateMock.mockReturnValue({
      loginTraceId: "trace-2",
    });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => createSuccessfulTokenExchangeResponse(),
    }));
    vi.stubGlobal("fetch", fetchMock);
    synchronizeBustlyWorkspaceContextMock.mockRejectedValueOnce(
      new Error("runtime sync failed"),
    );

    const resolvedAuth: ResolvedGatewayAuth = {
      mode: "none",
      token: undefined,
      password: undefined,
      allowTailscale: false,
    };

    await withTempConfig({
      cfg: { gateway: { trustedProxies: [] } },
      prefix: "openclaw-bustly-oauth-callback-sync-error-test-",
      run: async () => {
        const server = createGatewayHttpServer({
          canvasHost: null,
          clients: new Set(),
          controlUiEnabled: false,
          controlUiBasePath: "/__control__",
          openAiChatCompletionsEnabled: false,
          openResponsesEnabled: false,
          handleHooksRequest: async () => false,
          resolvedAuth,
        });

        const response = createResponse();
        await dispatchRequest(
          server,
          createRequest({ path: "/authorize?code=oauth-code&state=trace-2" }),
          response.res,
        );

        expect(completeBustlyLoginMock).toHaveBeenCalledTimes(1);
        expect(synchronizeBustlyWorkspaceContextMock).toHaveBeenCalledTimes(1);
        expect(response.res.statusCode).toBe(200);
        expect(response.getBody()).toContain("Login completed");
      },
    });
  });
});

