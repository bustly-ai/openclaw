import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserServerState } from "./server-context.js";
import { withFetchPreconnect } from "../test-utils/fetch-mock.js";

const mocks = vi.hoisted(() => ({
  isChromeCdpReady: vi.fn(async () => false),
  isChromeReachable: vi.fn(async () => true),
  launchOpenClawChrome: vi.fn(async () => {
    throw new Error("unexpected launch");
  }),
  resolveOpenClawUserDataDir: vi.fn(() => "/tmp/openclaw"),
  stopOpenClawChrome: vi.fn(async () => {}),
  ensureChromeExtensionRelayServer: vi.fn(async () => ({
    host: "127.0.0.1",
    port: 18002,
    baseUrl: "http://127.0.0.1:18002",
    cdpWsUrl: "ws://127.0.0.1:18002/cdp",
    extensionConnected: () => false,
    stop: async () => {},
  })),
  stopChromeExtensionRelayServer: vi.fn(async () => true),
}));

vi.mock("./chrome.js", () => ({
  isChromeCdpReady: mocks.isChromeCdpReady,
  isChromeReachable: mocks.isChromeReachable,
  launchOpenClawChrome: mocks.launchOpenClawChrome,
  resolveOpenClawUserDataDir: mocks.resolveOpenClawUserDataDir,
  stopOpenClawChrome: mocks.stopOpenClawChrome,
}));

vi.mock("./extension-relay.js", () => ({
  ensureChromeExtensionRelayServer: mocks.ensureChromeExtensionRelayServer,
  stopChromeExtensionRelayServer: mocks.stopChromeExtensionRelayServer,
  getChromeExtensionRelayAuthHeaders: vi.fn(() => ({})),
}));

import { createBrowserRouteContext } from "./server-context.js";

function makeBrowserState(): BrowserServerState {
  return {
    // oxlint-disable-next-line typescript/no-explicit-any
    server: null as any,
    port: 0,
    resolved: {
      enabled: true,
      controlPort: 18001,
      cdpProtocol: "http",
      cdpHost: "127.0.0.1",
      cdpIsLoopback: true,
      evaluateEnabled: false,
      remoteCdpTimeoutMs: 1500,
      remoteCdpHandshakeTimeoutMs: 3000,
      extraArgs: [],
      color: "#FF4500",
      headless: true,
      noSandbox: false,
      attachOnly: false,
      defaultProfile: "chrome",
      profiles: {
        chrome: {
          driver: "extension",
          cdpPort: 18002,
          cdpUrl: "http://127.0.0.1:18002",
          color: "#00AA00",
        },
      },
    },
    profiles: new Map(),
  };
}

describe("server-context relay guidance", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    mocks.isChromeCdpReady.mockReset();
    mocks.isChromeReachable.mockReset();
    mocks.ensureChromeExtensionRelayServer.mockReset();
    mocks.stopChromeExtensionRelayServer.mockReset();
  });

  it("returns extension-not-connected guidance when relay HTTP is up but extension websocket is down", async () => {
    mocks.isChromeReachable.mockResolvedValue(true);
    mocks.isChromeCdpReady.mockResolvedValue(false);

    const fetchMock = vi.fn(async (url: unknown) => {
      const raw = String(url);
      if (!raw.includes("/extension/status")) {
        throw new Error(`unexpected fetch: ${raw}`);
      }
      return {
        ok: true,
        json: async () => ({ connected: false }),
      } as unknown as Response;
    });
    global.fetch = withFetchPreconnect(fetchMock);

    const state = makeBrowserState();
    const ctx = createBrowserRouteContext({ getState: () => state });
    const chrome = ctx.forProfile("chrome");

    let message = "";
    try {
      await chrome.ensureBrowserAvailable();
      throw new Error("expected ensureBrowserAvailable to throw");
    } catch (err) {
      message = String(err);
    }
    expect(message).toMatch(/extension is not connected/i);
    expect(message).toMatch(/relay setup checklist/i);
  });

  it("returns relay-unreachable guidance when local relay endpoint is down", async () => {
    mocks.isChromeReachable.mockResolvedValue(false);
    mocks.isChromeCdpReady.mockResolvedValue(false);
    global.fetch = withFetchPreconnect(
      vi.fn(async () => {
        throw new Error("unexpected fetch");
      }),
    );

    const state = makeBrowserState();
    const ctx = createBrowserRouteContext({ getState: () => state });
    const chrome = ctx.forProfile("chrome");

    let message = "";
    try {
      await chrome.ensureBrowserAvailable();
      throw new Error("expected ensureBrowserAvailable to throw");
    } catch (err) {
      message = String(err);
    }
    expect(message).toMatch(/not reachable/i);
    expect(message).toMatch(/openclaw browser extension install/i);
    expect(mocks.ensureChromeExtensionRelayServer).toHaveBeenCalledTimes(1);
  });
});
