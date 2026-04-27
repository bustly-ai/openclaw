import { beforeEach, describe, expect, it, vi } from "vitest";

const oauthMocks = vi.hoisted(() => ({
  readBustlyOAuthStateMock: vi.fn(),
  readBustlyOAuthStateEnsuringFreshTokenMock: vi.fn(),
  bustlyNodeRequestMock: vi.fn(),
}));

vi.mock("../bustly-oauth.js", () => ({
  readBustlyOAuthState: () => oauthMocks.readBustlyOAuthStateMock(),
  readBustlyOAuthStateEnsuringFreshToken: (options?: { forceRefresh?: boolean }) =>
    oauthMocks.readBustlyOAuthStateEnsuringFreshTokenMock(options),
  getBustlyAccessToken: (
    state:
      | {
          user?: {
            supabaseAccessToken?: string;
            userAccessToken?: string;
          };
        }
      | null
      | undefined,
  ) => state?.user?.supabaseAccessToken?.trim() ?? state?.user?.userAccessToken?.trim() ?? "",
}));

vi.mock("./http.js", () => ({
  bustlyNodeRequest: oauthMocks.bustlyNodeRequestMock,
}));

import { bustlySupabaseFetch, getBustlySupabaseAuthConfigEnsuringFreshToken } from "./supabase.js";

describe("bustly supabase auth helpers", () => {
  beforeEach(() => {
    oauthMocks.readBustlyOAuthStateMock.mockReset();
    oauthMocks.readBustlyOAuthStateEnsuringFreshTokenMock.mockReset();
    oauthMocks.bustlyNodeRequestMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("passes refresh options through to oauth state resolution", async () => {
    oauthMocks.readBustlyOAuthStateEnsuringFreshTokenMock.mockResolvedValue({
      supabase: { url: "https://example.supabase.co", anonKey: "anon-key" },
      user: {
        workspaceId: "workspace-1",
        userId: "user-1",
        userEmail: "owner@example.com",
        userName: "Owner",
        supabaseAccessToken: "fresh-token",
      },
    });

    const config = await getBustlySupabaseAuthConfigEnsuringFreshToken({
      forceRefresh: true,
    });

    expect(oauthMocks.readBustlyOAuthStateEnsuringFreshTokenMock).toHaveBeenCalledWith({
      forceRefresh: true,
    });
    expect(config?.accessToken).toBe("fresh-token");
  });

  it("forces one refresh-and-retry on supabase 401 responses", async () => {
    oauthMocks.readBustlyOAuthStateEnsuringFreshTokenMock
      .mockResolvedValueOnce({
        supabase: { url: "https://example.supabase.co", anonKey: "anon-key" },
        user: {
          workspaceId: "workspace-1",
          userId: "user-1",
          userEmail: "owner@example.com",
          userName: "Owner",
          supabaseAccessToken: "stale-token",
        },
      })
      .mockResolvedValueOnce({
        supabase: { url: "https://example.supabase.co", anonKey: "anon-key" },
        user: {
          workspaceId: "workspace-1",
          userId: "user-1",
          userEmail: "owner@example.com",
          userName: "Owner",
          supabaseAccessToken: "fresh-token",
        },
      });

    oauthMocks.bustlyNodeRequestMock
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: "workspace-1" }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    const response = await bustlySupabaseFetch({
      path: "rest/v1/workspaces?select=id",
    });

    expect(response.status).toBe(200);
    expect(oauthMocks.bustlyNodeRequestMock).toHaveBeenCalledTimes(2);
    const firstHeaders = oauthMocks.bustlyNodeRequestMock.mock.calls[0]?.[1]?.headers as Record<
      string,
      string
    >;
    const secondHeaders = oauthMocks.bustlyNodeRequestMock.mock.calls[1]?.[1]?.headers as Record<
      string,
      string
    >;
    expect(firstHeaders.Authorization).toBe("Bearer stale-token");
    expect(secondHeaders.Authorization).toBe("Bearer fresh-token");
    expect(oauthMocks.readBustlyOAuthStateEnsuringFreshTokenMock).toHaveBeenNthCalledWith(
      1,
      undefined,
    );
    expect(oauthMocks.readBustlyOAuthStateEnsuringFreshTokenMock).toHaveBeenNthCalledWith(2, {
      forceRefresh: true,
    });
  });
});
