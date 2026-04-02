import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  startBrowserControlServiceFromConfig: vi.fn(async () => ({ ok: true })),
  dispatch: vi.fn(),
}));

vi.mock("./control-service.js", () => ({
  createBrowserControlContext: vi.fn(() => ({})),
  startBrowserControlServiceFromConfig: mocks.startBrowserControlServiceFromConfig,
}));

vi.mock("./routes/dispatcher.js", () => ({
  createBrowserRouteDispatcher: vi.fn(() => ({
    dispatch: mocks.dispatch,
  })),
}));

import { fetchBrowserJson } from "./client-fetch.js";

describe("fetchBrowserJson error handling", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.startBrowserControlServiceFromConfig.mockClear();
    mocks.dispatch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes through browser route errors so relay guidance reaches the agent", async () => {
    const relayMessage =
      'Bustly Browser Relay is running, but no browser tab is attached for profile "chrome".';
    mocks.dispatch.mockResolvedValue({
      status: 500,
      body: { error: relayMessage },
    });

    try {
      await fetchBrowserJson("/tabs/open", {
        method: "POST",
        body: JSON.stringify({ url: "https://example.com" }),
      });
      throw new Error("expected fetchBrowserJson to throw");
    } catch (err) {
      const message = String(err);
      expect(message).toContain(relayMessage);
      expect(message).not.toContain("Can't reach the OpenClaw browser control service");
    }
  });

  it("keeps network-level enhancement for absolute http browser control URLs", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchBrowserJson("http://127.0.0.1:18002/json/version", {
        timeoutMs: 250,
      }),
    ).rejects.toThrow(/Can't reach the OpenClaw browser control service/i);
  });
});

