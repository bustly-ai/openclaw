import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { stateDir, fetchMock } = vi.hoisted(() => ({
  stateDir: `${process.env.TMPDIR || "/tmp"}/bustly-api-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  fetchMock: vi.fn(),
}));

vi.mock("../defaults.js", () => ({
  resolveElectronIsolatedStateDir: () => stateDir,
}));

vi.mock("../logger.js", () => ({
  writeMainError: vi.fn(),
  writeMainInfo: vi.fn(),
  writeMainWarn: vi.fn(),
}));

vi.mock("../http-client.js", () => ({
  mainHttpFetch: fetchMock,
}));

import { refreshBustlySession, refreshSupabaseAuth } from "./bustly.js";

const oauthFile = join(stateDir, "bustlyOauth.json");

describe("refreshBustlySession", () => {
  beforeEach(() => {
    rmSync(stateDir, { recursive: true, force: true });
    mkdirSync(stateDir, { recursive: true });
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    process.env.BUSTLY_API_BASE_URL = "https://api.example.com/";
  });

  afterAll(() => {
    rmSync(stateDir, { recursive: true, force: true });
    delete process.env.BUSTLY_API_BASE_URL;
    vi.unstubAllGlobals();
  });

  it("posts refresh_token and unwraps the shared ApiResponse envelope", async () => {
    writeFileSync(
      oauthFile,
      JSON.stringify({
        deviceId: "device-1",
        callbackPort: 17900,
        user: {
          bustlyRefreshToken: "bustly-refresh-token",
          supabaseAccessToken: "supabase-access-token",
        },
      }),
      "utf-8",
    );

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "0",
          data: {
            accessToken: "bustly-access-token-2",
            refreshToken: "bustly-refresh-token-2",
            supabaseAccessToken: "supabase-access-token-2",
            supabaseAccessTokenExpiresAt: 1777001200,
            bustlySessionId: "session-123",
            capabilities: ["desktop-login"],
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const result = await refreshBustlySession();

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({
      accessToken: "bustly-access-token-2",
      refreshToken: "bustly-refresh-token-2",
      supabaseAccessToken: "supabase-access-token-2",
      supabaseAccessTokenExpiresAt: 1777001200,
      bustlySessionId: "session-123",
      capabilities: ["desktop-login"],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/api/oauth/api/v1/oauth/refresh");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    });
    expect(init.body).toBeInstanceOf(URLSearchParams);
    expect((init.body as URLSearchParams).toString()).toBe("refresh_token=bustly-refresh-token");
  });

  it("requires the Bustly refresh token for the Bustly-backed refresh endpoint", async () => {
    writeFileSync(
      oauthFile,
      JSON.stringify({
        deviceId: "device-1",
        callbackPort: 17900,
        user: {
          legacySupabaseRefreshToken: "legacy-refresh-token",
          supabaseAccessToken: "supabase-access-token",
        },
      }),
      "utf-8",
    );

    await expect(refreshBustlySession()).rejects.toThrow("Missing Bustly refresh token");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a failure when the envelope reports an error status", async () => {
    writeFileSync(
      oauthFile,
      JSON.stringify({
        deviceId: "device-1",
        callbackPort: 17900,
        user: {
          bustlyRefreshToken: "bustly-refresh-token",
        },
      }),
      "utf-8",
    );

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "1",
          message: "refresh failed",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const result = await refreshBustlySession();

    expect(result.ok).toBe(false);
    expect(result.errorText).toBe("refresh failed");
  });

  it("keeps a direct Supabase refresh fallback for legacy on-disk sessions", async () => {
    writeFileSync(
      oauthFile,
      JSON.stringify({
        deviceId: "device-1",
        callbackPort: 17900,
        user: {
          legacySupabaseRefreshToken: "legacy-supabase-refresh-token",
        },
        supabase: {
          url: "https://supabase.example.com",
          anonKey: "anon-key",
        },
      }),
      "utf-8",
    );

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "supabase-access-token-2",
          refresh_token: "legacy-supabase-refresh-token-2",
          expires_at: 1777001200,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const result = await refreshSupabaseAuth();

    expect(result.ok).toBe(true);
    expect(result.data?.access_token).toBe("supabase-access-token-2");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://supabase.example.com/auth/v1/token?grant_type=refresh_token");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Accept: "application/json",
      "Content-Type": "application/json",
      apikey: "anon-key",
    });
  });
});
