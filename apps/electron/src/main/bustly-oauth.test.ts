import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { stateDir, verifySupabaseAuth, refreshSupabaseAuth, refreshBustlySession } = vi.hoisted(() => ({
  stateDir: `${process.env.TMPDIR || "/tmp"}/bustly-oauth-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  verifySupabaseAuth: vi.fn(),
  refreshSupabaseAuth: vi.fn(),
  refreshBustlySession: vi.fn(),
}));

vi.mock("./api/bustly.js", () => ({
  verifySupabaseAuth,
  refreshSupabaseAuth,
  refreshBustlySession,
}));

vi.mock("./defaults.js", () => ({
  resolveElectronIsolatedStateDir: () => stateDir,
}));

vi.mock("./logger.js", () => ({
  writeMainError: vi.fn(),
  writeMainInfo: vi.fn(),
  writeMainWarn: vi.fn(),
}));

import {
  buildBustlyLoginStateFromTokenResponse,
  completeBustlyLogin,
  getBustlyUserInfo,
  readBustlyOAuthState,
  refreshBustlyAccessToken,
} from "./bustly-oauth.js";

const oauthFile = join(stateDir, "bustlyOauth.json");

function writeOAuthState(params: { userName?: string; userEmail?: string; userAvatarUrl?: string }) {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(
    oauthFile,
    JSON.stringify({
      deviceId: "device-1",
      callbackPort: 17900,
      loggedInAt: Date.now(),
      user: {
        userId: "user-1",
        userName: params.userName ?? "",
        userEmail: params.userEmail ?? "owner@example.com",
        userAvatarUrl: params.userAvatarUrl,
        userAccessToken: "access-token",
        workspaceId: "workspace-1",
        skills: [],
      },
    }),
    "utf-8",
  );
}

describe("getBustlyUserInfo", () => {
  beforeEach(() => {
    rmSync(stateDir, { recursive: true, force: true });
    mkdirSync(stateDir, { recursive: true });
    verifySupabaseAuth.mockReset();
    refreshSupabaseAuth.mockReset();
    refreshBustlySession.mockReset();
  });

  afterAll(() => {
    rmSync(stateDir, { recursive: true, force: true });
  });

  it("backfills userName even when an avatar is already stored", async () => {
    writeOAuthState({
      userName: "",
      userEmail: "owner@example.com",
      userAvatarUrl: "https://cdn.example.com/avatar.png",
    });
    verifySupabaseAuth.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        email: "owner@example.com",
        user_metadata: {
          full_name: "Owner Name",
        },
      },
    });

    const userInfo = await getBustlyUserInfo();
    const persistedState = JSON.parse(readFileSync(oauthFile, "utf-8")) as {
      user?: { userName?: string };
    };

    expect(verifySupabaseAuth).toHaveBeenCalledTimes(1);
    expect(userInfo?.userName).toBe("Owner Name");
    expect(persistedState.user?.userName).toBe("Owner Name");
  });

  it("falls back to the email local part when Supabase does not provide a display name", async () => {
    writeOAuthState({
      userName: "",
      userEmail: "founder@example.com",
      userAvatarUrl: "https://cdn.example.com/avatar.png",
    });
    verifySupabaseAuth.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        email: "founder@example.com",
        user_metadata: {},
      },
    });

    const userInfo = await getBustlyUserInfo();

    expect(verifySupabaseAuth).toHaveBeenCalledTimes(1);
    expect(userInfo?.userName).toBe("founder");
  });

  it("maps the backend login response into the persisted v13 session shape without the Supabase refresh token", () => {
    writeOAuthState({
      userName: "",
      userEmail: "owner@example.com",
      userAvatarUrl: "https://cdn.example.com/avatar.png",
    });

    const loginState = buildBustlyLoginStateFromTokenResponse({
      userId: "user-1",
      userName: "Owner",
      userEmail: "owner@example.com",
      workspaceId: "workspace-1",
      skills: ["search-data"],
      accessToken: "bustly-access-token",
      refreshToken: "bustly-refresh-token",
      bustlySessionId: "session-123",
      supabaseAccessToken: "supabase-access-token",
      supabaseAccessTokenExpiresAt: 1777000000,
      capabilities: ["desktop-login"],
      extras: {
        supabase_session: {
          access_token: "supabase-access-token",
          expires_at: 1777000000,
          user: {
            user_metadata: {
              avatar_url: "https://cdn.example.com/avatar.png",
            },
          },
        },
      },
    });

    completeBustlyLogin({
      user: loginState,
      supabase: {
        url: "https://supabase.example.com",
        anonKey: "anon-key",
      },
    });

    const persistedState = JSON.parse(readFileSync(oauthFile, "utf-8")) as {
      user?: {
        supabaseAccessToken?: string;
        supabaseAccessTokenExpiresAt?: number;
        bustlySessionId?: string;
        bustlyRefreshToken?: string;
        capabilities?: string[];
        userRefreshToken?: string;
      };
    };

    expect(persistedState.user?.supabaseAccessToken).toBe("supabase-access-token");
    expect(persistedState.user?.supabaseAccessTokenExpiresAt).toBe(1777000000);
    expect(persistedState.user?.bustlySessionId).toBe("session-123");
    expect(persistedState.user?.bustlyRefreshToken).toBe("bustly-refresh-token");
    expect(persistedState.user?.capabilities).toEqual(["desktop-login"]);
    expect(persistedState.user?.userRefreshToken).toBeUndefined();
  });

  it("uses the Bustly refresh endpoint and stores the rotated v13 access token", async () => {
    writeFileSync(
      oauthFile,
      JSON.stringify({
        deviceId: "device-1",
        callbackPort: 17900,
        loggedInAt: Date.now(),
        user: {
          userId: "user-1",
          userName: "Owner",
          userEmail: "owner@example.com",
          userAvatarUrl: "https://cdn.example.com/avatar.png",
          userAccessToken: "supabase-access-token",
          supabaseAccessToken: "supabase-access-token",
          supabaseAccessTokenExpiresAt: 1777000000,
          bustlyRefreshToken: "bustly-refresh-token",
          bustlySessionId: "session-123",
          capabilities: ["desktop-login"],
          workspaceId: "workspace-1",
          skills: [],
        },
        supabase: {
          url: "https://supabase.example.com",
          anonKey: "anon-key",
        },
      }),
      "utf-8",
    );

    refreshBustlySession.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        accessToken: "bustly-access-token-2",
        refreshToken: "bustly-refresh-token-2",
        supabaseAccessToken: "supabase-access-token-2",
        supabaseAccessTokenExpiresAt: 1777001200,
        bustlySessionId: "session-123",
        capabilities: ["desktop-login"],
      },
    });

    const refreshed = await refreshBustlyAccessToken();
    const persistedState = JSON.parse(readFileSync(oauthFile, "utf-8")) as {
      user?: {
        supabaseAccessToken?: string;
        supabaseAccessTokenExpiresAt?: number;
        bustlyRefreshToken?: string;
        userRefreshToken?: string;
      };
    };

    expect(refreshed).toBe(true);
    expect(refreshBustlySession).toHaveBeenCalledTimes(1);
    expect(refreshSupabaseAuth).not.toHaveBeenCalled();
    expect(persistedState.user?.supabaseAccessToken).toBe("supabase-access-token-2");
    expect(persistedState.user?.supabaseAccessTokenExpiresAt).toBe(1777001200);
    expect(persistedState.user?.bustlyRefreshToken).toBe("bustly-refresh-token-2");
    expect(persistedState.user?.userRefreshToken).toBeUndefined();
  });

  it("refreshes legacy on-disk sessions that only have userRefreshToken", async () => {
    writeFileSync(
      oauthFile,
      JSON.stringify({
        deviceId: "device-1",
        callbackPort: 17900,
        loggedInAt: Date.now(),
        user: {
          userId: "user-1",
          userName: "Owner",
          userEmail: "owner@example.com",
          userAvatarUrl: "https://cdn.example.com/avatar.png",
          userAccessToken: "supabase-access-token",
          userRefreshToken: "legacy-bustly-refresh-token",
          workspaceId: "workspace-1",
          skills: [],
        },
        supabase: {
          url: "https://supabase.example.com",
          anonKey: "anon-key",
        },
      }),
      "utf-8",
    );

    refreshSupabaseAuth.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        access_token: "supabase-access-token-2",
        refresh_token: "legacy-bustly-refresh-token-2",
        expires_at: 1777001200,
        expires_in: 1200,
      },
    });

    const refreshed = await refreshBustlyAccessToken();
    const persistedState = JSON.parse(readFileSync(oauthFile, "utf-8")) as {
      user?: {
        supabaseAccessToken?: string;
        bustlyRefreshToken?: string;
        legacySupabaseRefreshToken?: string;
        userRefreshToken?: string;
      };
    };

    expect(refreshed).toBe(true);
    expect(refreshSupabaseAuth).toHaveBeenCalledTimes(1);
    expect(refreshBustlySession).not.toHaveBeenCalled();
    expect(persistedState.user?.supabaseAccessToken).toBe("supabase-access-token-2");
    expect(persistedState.user?.bustlyRefreshToken).toBeUndefined();
    expect(persistedState.user?.legacySupabaseRefreshToken).toBe("legacy-bustly-refresh-token-2");
    expect(persistedState.user?.userRefreshToken).toBeUndefined();
  });

  it("normalizes legacy on-disk state on read and rewrites it into the v13-compatible shape", () => {
    writeFileSync(
      oauthFile,
      JSON.stringify({
        deviceId: "device-1",
        callbackPort: 17900,
        loggedInAt: Date.now(),
        user: {
          userId: "user-1",
          userName: "Owner",
          userEmail: "owner@example.com",
          userAccessToken: "legacy-access-token",
          userRefreshToken: "legacy-supabase-refresh-token",
          sessionExpiresAt: 1777001200,
          workspaceId: "workspace-1",
          skills: [],
        },
        supabase: {
          url: "https://supabase.example.com",
          anonKey: "anon-key",
        },
      }),
      "utf-8",
    );

    const normalizedState = readBustlyOAuthState();
    const persistedState = JSON.parse(readFileSync(oauthFile, "utf-8")) as {
      user?: {
        userAccessToken?: string;
        supabaseAccessToken?: string;
        supabaseAccessTokenExpiresAt?: number;
        legacySupabaseRefreshToken?: string;
        userRefreshToken?: string;
        sessionExpiresAt?: number;
      };
    };

    expect(normalizedState?.user?.userAccessToken).toBe("legacy-access-token");
    expect(normalizedState?.user?.supabaseAccessToken).toBe("legacy-access-token");
    expect(normalizedState?.user?.supabaseAccessTokenExpiresAt).toBe(1777001200);
    expect(normalizedState?.user?.legacySupabaseRefreshToken).toBe("legacy-supabase-refresh-token");
    expect((normalizedState?.user as Record<string, unknown> | undefined)?.userRefreshToken).toBeUndefined();
    expect(persistedState.user?.userAccessToken).toBe("legacy-access-token");
    expect(persistedState.user?.supabaseAccessToken).toBe("legacy-access-token");
    expect(persistedState.user?.supabaseAccessTokenExpiresAt).toBe(1777001200);
    expect(persistedState.user?.legacySupabaseRefreshToken).toBe("legacy-supabase-refresh-token");
    expect(persistedState.user?.userRefreshToken).toBeUndefined();
    expect(persistedState.user?.sessionExpiresAt).toBeUndefined();
  });

  it("uses a future fallback expiry when refresh omits expiry fields", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-13T12:00:00Z"));

    try {
      writeFileSync(
        oauthFile,
        JSON.stringify({
          deviceId: "device-1",
          callbackPort: 17900,
          loggedInAt: Date.now(),
          user: {
            userId: "user-1",
            userName: "Owner",
            userEmail: "owner@example.com",
            userAvatarUrl: "https://cdn.example.com/avatar.png",
            userAccessToken: "supabase-access-token",
            supabaseAccessToken: "supabase-access-token",
            supabaseAccessTokenExpiresAt: 1,
            bustlyRefreshToken: "bustly-refresh-token",
            bustlySessionId: "session-123",
            capabilities: ["desktop-login"],
            workspaceId: "workspace-1",
            skills: [],
          },
          supabase: {
            url: "https://supabase.example.com",
            anonKey: "anon-key",
          },
        }),
        "utf-8",
      );

      refreshBustlySession.mockResolvedValue({
        ok: true,
        status: 200,
        data: {
          accessToken: "bustly-access-token-2",
          refreshToken: "bustly-refresh-token-2",
          supabaseAccessToken: "supabase-access-token-2",
          bustlySessionId: "session-123",
          capabilities: ["desktop-login"],
        },
      });

      const refreshed = await refreshBustlyAccessToken();
      const persistedState = JSON.parse(readFileSync(oauthFile, "utf-8")) as {
        user?: {
          supabaseAccessToken?: string;
          supabaseAccessTokenExpiresAt?: number;
          bustlyRefreshToken?: string;
        };
      };
      const expectedExpiresAt = Math.floor(Date.now() / 1000) + 5 * 60;

      expect(refreshed).toBe(true);
      expect(refreshBustlySession).toHaveBeenCalledTimes(1);
      expect(persistedState.user?.supabaseAccessToken).toBe("supabase-access-token-2");
      expect(persistedState.user?.supabaseAccessTokenExpiresAt).toBe(expectedExpiresAt);
      expect(persistedState.user?.supabaseAccessTokenExpiresAt).toBeGreaterThan(1);
      expect(persistedState.user?.bustlyRefreshToken).toBe("bustly-refresh-token-2");
    } finally {
      vi.useRealTimers();
    }
  });
});
