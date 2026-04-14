import { afterEach, describe, expect, it, vi } from "vitest";

const {
  closeAllConnections,
  electronFetch,
  isReady,
  resolveProxy,
  setProxy,
  writeMainError,
  writeMainInfo,
  writeMainWarn,
} = vi.hoisted(() => ({
  closeAllConnections: vi.fn(),
  electronFetch: vi.fn(),
  isReady: vi.fn(() => true),
  resolveProxy: vi.fn().mockResolvedValue("DIRECT"),
  setProxy: vi.fn().mockResolvedValue(undefined),
  writeMainError: vi.fn(),
  writeMainInfo: vi.fn(),
  writeMainWarn: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    isReady,
  },
  session: {
    defaultSession: {
      closeAllConnections,
      fetch: electronFetch,
      resolveProxy,
      setProxy,
    },
  },
}));

vi.mock("./logger.js", () => ({
  writeMainError,
  writeMainInfo,
  writeMainWarn,
}));

import {
  initializeMainHttpClient,
  mainHttpFetch,
  resetMainHttpClientForTests,
  resolveMainHttpProxySettings,
} from "./http-client.js";

describe("main HTTP client", () => {
  afterEach(() => {
    resetMainHttpClientForTests();
    closeAllConnections.mockReset();
    electronFetch.mockReset();
    isReady.mockReset();
    isReady.mockReturnValue(true);
    resolveProxy.mockReset();
    resolveProxy.mockResolvedValue("DIRECT");
    setProxy.mockReset();
    setProxy.mockResolvedValue(undefined);
    writeMainError.mockReset();
    writeMainInfo.mockReset();
    writeMainWarn.mockReset();
  });

  it("defaults to the system proxy configuration", () => {
    const settings = resolveMainHttpProxySettings();

    expect(settings).toEqual({
      mode: "system",
      summary: "system",
    });
  });

  it("applies resolved proxy settings to the default Electron session", async () => {
    await initializeMainHttpClient();

    expect(setProxy).toHaveBeenCalledWith({ mode: "system" });
    expect(closeAllConnections).toHaveBeenCalledTimes(1);
    expect(writeMainInfo).toHaveBeenCalledWith("[HTTP] Main HTTP proxy configured system");
  });

  it("routes main-process fetches through the default Electron session", async () => {
    electronFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );

    const response = await mainHttpFetch("https://example.com/oauth/token", {
      body: JSON.stringify({ code: "abc" }),
      headers: { "Content-Type": "application/json" },
      label: "OAuth Token Exchange",
      method: "POST",
      timeoutMs: 12_345,
    });

    expect(response.status).toBe(200);
    expect(setProxy).toHaveBeenCalledWith({ mode: "system" });
    expect(resolveProxy).toHaveBeenCalledWith("https://example.com/oauth/token");
    expect(electronFetch).toHaveBeenCalledWith(
      "https://example.com/oauth/token",
      expect.objectContaining({
        body: JSON.stringify({ code: "abc" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );
  });
});
