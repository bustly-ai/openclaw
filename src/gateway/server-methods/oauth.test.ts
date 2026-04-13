import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readBustlyOAuthState: vi.fn(),
  updateBustlyOAuthState: vi.fn(),
  isBustlyLoggedIn: vi.fn(),
  getBustlyUserInfo: vi.fn(),
  logoutBustly: vi.fn(),
  initBustlyOAuthFlow: vi.fn(),
}));

vi.mock("../../bustly-oauth.js", () => ({
  readBustlyOAuthState: () => mocks.readBustlyOAuthState(),
  updateBustlyOAuthState: (updates: unknown) => mocks.updateBustlyOAuthState(updates),
  isBustlyLoggedIn: () => mocks.isBustlyLoggedIn(),
  getBustlyUserInfo: () => mocks.getBustlyUserInfo(),
  logoutBustly: () => mocks.logoutBustly(),
  initBustlyOAuthFlow: () => mocks.initBustlyOAuthFlow(),
}));

import { oauthHandlers } from "./oauth.js";

async function invoke(method: keyof typeof oauthHandlers, params: Record<string, unknown> = {}) {
  const respond = vi.fn();
  await oauthHandlers[method]({
    req: {} as never,
    params: params as never,
    respond: respond as never,
    context: {} as never,
    client: null,
    isWebchatConnect: () => false,
  });
  return respond;
}

describe("gateway oauth handlers", () => {
  beforeEach(() => {
    mocks.readBustlyOAuthState.mockReset();
    mocks.updateBustlyOAuthState.mockReset();
    mocks.isBustlyLoggedIn.mockReset();
    mocks.getBustlyUserInfo.mockReset();
    mocks.logoutBustly.mockReset();
    mocks.initBustlyOAuthFlow.mockReset();
  });

  it("cancels login by trace id", async () => {
    mocks.readBustlyOAuthState.mockReturnValue({
      loginTraceId: "trace-1",
    });
    const respond = await invoke("oauth.cancel", {
      loginTraceId: "trace-1",
    });
    expect(mocks.updateBustlyOAuthState).toHaveBeenCalledWith({
      loginTraceId: undefined,
      authCode: undefined,
      expiresAt: undefined,
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      {
        canceled: true,
        loginTraceId: "trace-1",
      },
      undefined,
    );
  });

  it("cancels all pending logins when trace id is omitted", async () => {
    mocks.readBustlyOAuthState.mockReturnValue({
      loginTraceId: "trace-2",
      authCode: "code-2",
      expiresAt: Date.now() + 60_000,
    });
    const respond = await invoke("oauth.cancel", {});
    expect(mocks.updateBustlyOAuthState).toHaveBeenCalledWith({
      loginTraceId: undefined,
      authCode: undefined,
      expiresAt: undefined,
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      {
        canceled: true,
        loginTraceId: null,
      },
      undefined,
    );
  });
});
