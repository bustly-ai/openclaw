import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { stateDir, verifySupabaseAuth, refreshSupabaseAuth } = vi.hoisted(() => ({
  stateDir: `${process.env.TMPDIR || "/tmp"}/bustly-oauth-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  verifySupabaseAuth: vi.fn(),
  refreshSupabaseAuth: vi.fn(),
}));

vi.mock("./api/bustly.js", () => ({
  verifySupabaseAuth,
  refreshSupabaseAuth,
}));

vi.mock("./defaults.js", () => ({
  resolveElectronIsolatedStateDir: () => stateDir,
}));

vi.mock("./logger.js", () => ({
  writeMainError: vi.fn(),
  writeMainInfo: vi.fn(),
  writeMainWarn: vi.fn(),
}));

import { getBustlyUserInfo } from "./bustly-oauth.js";

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
        userRefreshToken: "refresh-token",
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
});
