import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("root bustly oauth state", () => {
  let tempHome: string;
  let previousHome: string | undefined;
  let previousAccountApiBaseUrl: string | undefined;
  let previousApiBaseUrl: string | undefined;

  beforeEach(() => {
    tempHome = mkdtempSync(path.join(os.tmpdir(), "openclaw-root-bustly-oauth-"));
    previousHome = process.env.HOME;
    previousAccountApiBaseUrl = process.env.BUSTLY_ACCOUNT_API_BASE_URL;
    previousApiBaseUrl = process.env.BUSTLY_API_BASE_URL;
    process.env.HOME = tempHome;
    delete process.env.BUSTLY_ACCOUNT_API_BASE_URL;
    delete process.env.BUSTLY_API_BASE_URL;
    vi.resetModules();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
    if (previousAccountApiBaseUrl === undefined) {
      delete process.env.BUSTLY_ACCOUNT_API_BASE_URL;
    } else {
      process.env.BUSTLY_ACCOUNT_API_BASE_URL = previousAccountApiBaseUrl;
    }
    if (previousApiBaseUrl === undefined) {
      delete process.env.BUSTLY_API_BASE_URL;
    } else {
      process.env.BUSTLY_API_BASE_URL = previousApiBaseUrl;
    }
    rmSync(tempHome, { recursive: true, force: true });
  });

  function writeOauthState(state: unknown): string {
    const oauthPath = path.join(tempHome, ".bustly", "bustlyOauth.json");
    mkdirSync(path.dirname(oauthPath), { recursive: true });
    writeFileSync(oauthPath, JSON.stringify(state, null, 2), "utf-8");
    return oauthPath;
  }

  it("normalizes v13-style session fields on read", async () => {
    writeOauthState({
      deviceId: "device-1",
      callbackPort: 17900,
      user: {
        userId: "user-1",
        userName: "Owner",
        userEmail: "owner@example.com",
        workspaceId: "workspace-1",
        skills: [],
        supabaseAccessToken: "supabase-access-token",
        supabaseAccessTokenExpiresAt: 1777001200,
        bustlyRefreshToken: "bustly-refresh-token",
      },
      supabase: {
        url: "https://example.supabase.co",
        anonKey: "anon-key",
      },
    });

    const oauth = await import("./bustly-oauth.js");
    const state = oauth.readBustlyOAuthState();

    expect(state?.user?.supabaseAccessToken).toBe("supabase-access-token");
    expect(state?.user?.userAccessToken).toBe("supabase-access-token");
    expect(state?.user?.supabaseAccessTokenExpiresAt).toBe(1777001200);
    expect(state?.user?.bustlyRefreshToken).toBe("bustly-refresh-token");
  });

  it("refreshes the root owner session through bustly backend", async () => {
    const oauthPath = writeOauthState({
      deviceId: "device-1",
      callbackPort: 17900,
      loggedInAt: 1777000000000,
      user: {
        userId: "user-1",
        userName: "Owner",
        userEmail: "owner@example.com",
        workspaceId: "workspace-1",
        skills: [],
        userAccessToken: "stale-token",
        supabaseAccessToken: "stale-token",
        supabaseAccessTokenExpiresAt: 1,
        bustlyRefreshToken: "bustly-refresh-token",
      },
      supabase: {
        url: "https://example.supabase.co",
        anonKey: "anon-key",
      },
    });
    process.env.BUSTLY_ACCOUNT_API_BASE_URL = "https://test-bustly-account.bustly.ai";
    process.env.BUSTLY_API_BASE_URL = "https://legacy.example.com";

    const fetchMock = vi.fn(
      async (_input: string | URL | Request) =>
        new Response(
          JSON.stringify({
            status: "0",
            data: {
              supabaseAccessToken: "fresh-token",
              supabaseAccessTokenExpiresAt: 1777001200,
              refreshToken: "bustly-refresh-token-2",
              bustlySessionId: "session-1",
              capabilities: ["analytics"],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const oauth = await import("./bustly-oauth.js");
    const refreshed = await oauth.refreshBustlyAccessToken();

    expect(refreshed).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [firstCall] = fetchMock.mock.calls[0] ?? [];
    expect(firstCall).toBe("https://test-bustly-account.bustly.ai/api/oauth/api/v1/oauth/refresh");
    const persistedState = JSON.parse(readFileSync(oauthPath, "utf-8")) as {
      user?: Record<string, unknown>;
    };
    expect(persistedState.user?.userAccessToken).toBe("fresh-token");
    expect(persistedState.user?.supabaseAccessToken).toBe("fresh-token");
    expect(persistedState.user?.supabaseAccessTokenExpiresAt).toBe(1777001200);
    expect(persistedState.user?.bustlyRefreshToken).toBe("bustly-refresh-token-2");
    expect(persistedState.user?.bustlySessionId).toBe("session-1");
  });

  it("reads oauth state with an on-demand refresh when the stored session is expired", async () => {
    writeOauthState({
      deviceId: "device-1",
      callbackPort: 17900,
      loggedInAt: 1777000000000,
      user: {
        userId: "user-1",
        userName: "Owner",
        userEmail: "owner@example.com",
        workspaceId: "workspace-1",
        skills: [],
        userAccessToken: "stale-token",
        supabaseAccessToken: "stale-token",
        supabaseAccessTokenExpiresAt: 1,
        bustlyRefreshToken: "bustly-refresh-token",
      },
      supabase: {
        url: "https://example.supabase.co",
        anonKey: "anon-key",
      },
    });
    process.env.BUSTLY_ACCOUNT_API_BASE_URL = "https://test-bustly-account.bustly.ai";

    const fetchMock = vi.fn(
      async (_input: string | URL | Request) =>
        new Response(
          JSON.stringify({
            status: "0",
            data: {
              supabaseAccessToken: "fresh-token",
              supabaseAccessTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
              refreshToken: "bustly-refresh-token-2",
              bustlySessionId: "session-1",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const oauth = await import("./bustly-oauth.js");
    const state = await oauth.readBustlyOAuthStateEnsuringFreshToken();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(state?.user?.supabaseAccessToken).toBe("fresh-token");
    expect(state?.user?.userAccessToken).toBe("fresh-token");
  });
});
