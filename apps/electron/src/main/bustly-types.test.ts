import { describe, expect, it } from "vitest";

import type { BustlyOAuthUser } from "./bustly-types.js";
import { normalizeBustlyOAuthState } from "./bustly-types.js";

type LegacyBustlyOAuthUserInput = BustlyOAuthUser & {
  userRefreshToken?: string;
  sessionExpiresAt?: number;
};

describe("BustlyOAuthState v13 contract", () => {
  it("keeps the compatibility access-token alias while rejecting the legacy field name", () => {
    const _validV13User: BustlyOAuthUser = {
      userId: "user-1",
      userName: "Owner",
      userEmail: "owner@example.com",
      workspaceId: "workspace-1",
      skills: [],
      userAccessToken: "supabase-access-token",
      bustlyRefreshToken: "bustly-refresh-token",
      legacySupabaseRefreshToken: "legacy-refresh-token",
      supabaseAccessToken: "supabase-access-token",
      supabaseAccessTokenExpiresAt: 1777000000,
      bustlySessionId: "session-123",
      capabilities: ["desktop-login"],
    };

    void _validV13User;

    // @ts-expect-error legacy Supabase refresh tokens are input-only and must not be part of the persisted contract.
    const _invalidV13User: BustlyOAuthUser = {
      userId: "user-1",
      userName: "Owner",
      userEmail: "owner@example.com",
      workspaceId: "workspace-1",
      skills: [],
      userAccessToken: "legacy-access-token",
      bustlyRefreshToken: "bustly-refresh-token",
      supabaseAccessToken: "supabase-access-token",
      supabaseAccessTokenExpiresAt: 1777000000,
      bustlySessionId: "session-123",
      capabilities: ["desktop-login"],
      userRefreshToken: "legacy-refresh-token",
    };

    void _invalidV13User;
  });

  it("normalizes legacy state into the v13 session shape without dropping the access-token alias", () => {
    const legacyUser = {
      userId: "user-1",
      userName: "Owner",
      userEmail: "owner@example.com",
      workspaceId: "workspace-1",
      skills: [],
      userAccessToken: "legacy-access-token",
      userRefreshToken: "legacy-refresh-token",
      bustlyRefreshToken: "bustly-refresh-token",
      supabaseAccessToken: "supabase-access-token",
      supabaseAccessTokenExpiresAt: 1777000000,
      bustlySessionId: "session-123",
      capabilities: ["desktop-login"],
      sessionExpiresAt: 1777000000,
    } satisfies LegacyBustlyOAuthUserInput;

    const normalized = normalizeBustlyOAuthState({
      deviceId: "device-1",
      callbackPort: 17900,
      loggedInAt: 1776000000000,
      user: legacyUser,
    });

    expect(normalized?.user?.supabaseAccessToken).toBe("supabase-access-token");
    expect(normalized?.user?.userAccessToken).toBe("supabase-access-token");
    expect(normalized?.user?.supabaseAccessTokenExpiresAt).toBe(1777000000);
    expect(normalized?.user?.bustlyRefreshToken).toBe("bustly-refresh-token");
    expect(normalized?.user?.legacySupabaseRefreshToken).toBe("legacy-refresh-token");
    expect(normalized?.user?.bustlySessionId).toBe("session-123");
    expect(normalized?.user?.capabilities).toEqual(["desktop-login"]);
    expect((normalized?.user as Record<string, unknown> | undefined)?.userRefreshToken).toBeUndefined();
    expect((normalized?.user as Record<string, unknown> | undefined)?.sessionExpiresAt).toBeUndefined();
    expect((normalized?.user as Record<string, unknown> | undefined)?.sessionExpiresIn).toBeUndefined();
    expect((normalized?.user as Record<string, unknown> | undefined)?.sessionTokenType).toBeUndefined();
  });

  it("keeps the v13 session fields intact when they are already present", () => {
    const normalized = normalizeBustlyOAuthState({
      deviceId: "device-1",
      callbackPort: 17900,
      user: {
        userId: "user-1",
        userName: "Owner",
        userEmail: "owner@example.com",
        workspaceId: "workspace-1",
        skills: [],
        userAccessToken: "supabase-access-token",
        bustlySessionId: "session-123",
        supabaseAccessToken: "supabase-access-token",
        supabaseAccessTokenExpiresAt: 1777000000,
        capabilities: ["desktop-login"],
        bustlyRefreshToken: "bustly-refresh-token",
      },
    });

    expect(normalized?.user?.bustlySessionId).toBe("session-123");
    expect(normalized?.user?.supabaseAccessToken).toBe("supabase-access-token");
    expect(normalized?.user?.supabaseAccessTokenExpiresAt).toBe(1777000000);
    expect(normalized?.user?.capabilities).toEqual(["desktop-login"]);
    expect(normalized?.user?.bustlyRefreshToken).toBe("bustly-refresh-token");
    expect(normalized?.user?.legacySupabaseRefreshToken).toBeUndefined();
    expect(normalized?.user?.userAccessToken).toBe("supabase-access-token");
    expect((normalized?.user as Record<string, unknown> | undefined)?.userRefreshToken).toBeUndefined();
    expect((normalized?.user as Record<string, unknown> | undefined)?.sessionExpiresAt).toBeUndefined();
  });
});
