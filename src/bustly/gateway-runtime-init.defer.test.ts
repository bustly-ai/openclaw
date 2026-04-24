import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BustlyOAuthState } from "../config/types.base.js";
import { ensureGatewayRuntimeInit } from "./gateway-runtime-init.js";

function createDeferredPromise<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitForExpectation(assertion: () => void, timeoutMs = 1000): Promise<void> {
  const startedAt = Date.now();
  // Keep polling lightweight; this test only waits for a mocked warmup entrypoint.
  while (Date.now() - startedAt < timeoutMs) {
    try {
      assertion();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  assertion();
}

const {
  oauthStateRef,
  bootstrapMock,
  ensureModelsJsonMock,
  ensurePiAuthJsonMock,
  loadEnabledBustlyWorkspaceBootstrapAgentsMock,
  ensureBustlyWorkspacePresetAgentsMock,
} = vi.hoisted(() => {
  return {
    oauthStateRef: { current: null as BustlyOAuthState | null },
    bootstrapMock: vi.fn<(params: unknown) => Promise<void>>(async () => {}),
    ensureModelsJsonMock: vi.fn<
      (config: unknown, agentDir: string) => Promise<{ agentDir: string; wrote: boolean }>
    >(async () => ({ agentDir: "", wrote: true })),
    ensurePiAuthJsonMock: vi.fn<
      (agentDir: string) => Promise<{ authPath: string; wrote: boolean }>
    >(async () => ({ authPath: "", wrote: true })),
    loadEnabledBustlyWorkspaceBootstrapAgentsMock:
      vi.fn<(options?: unknown) => Promise<unknown[]>>(),
    ensureBustlyWorkspacePresetAgentsMock: vi.fn<(params: unknown) => Promise<number>>(),
  };
});

vi.mock("../bustly-oauth.js", () => ({
  readBustlyOAuthState: vi.fn(() => oauthStateRef.current),
  setActiveWorkspaceId: vi.fn(),
}));

vi.mock("./workspace-bootstrap.js", () => ({
  initializeBustlyWorkspaceBootstrap: (params: unknown) => bootstrapMock(params),
  loadEnabledBustlyWorkspaceBootstrapAgents: (options?: unknown) =>
    loadEnabledBustlyWorkspaceBootstrapAgentsMock(options),
}));

vi.mock("../agents/models-config.js", () => ({
  ensureOpenClawModelsJson: (config: unknown, agentDir: string) =>
    ensureModelsJsonMock(config, agentDir),
}));

vi.mock("../agents/pi-auth-json.js", () => ({
  ensurePiAuthJsonFromAuthProfiles: (agentDir: string) => ensurePiAuthJsonMock(agentDir),
}));

vi.mock("./workspace-agents.js", () => ({
  ensureBustlyWorkspacePresetAgents: (params: unknown) =>
    ensureBustlyWorkspacePresetAgentsMock(params),
}));

describe("gateway-runtime-init deferred preset warmup", () => {
  let tempDir: string;
  let previousStateDir: string | undefined;
  let previousConfigPath: string | undefined;
  let previousWorkspaceTemplateBaseUrl: string | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), "openclaw-gateway-runtime-defer-"));
    previousStateDir = process.env.OPENCLAW_STATE_DIR;
    previousConfigPath = process.env.OPENCLAW_CONFIG_PATH;
    previousWorkspaceTemplateBaseUrl = process.env.BUSTLY_WORKSPACE_TEMPLATE_BASE_URL;
    process.env.OPENCLAW_STATE_DIR = path.join(tempDir, "state");
    process.env.OPENCLAW_CONFIG_PATH = path.join(tempDir, "state", "openclaw.json");
    delete process.env.BUSTLY_WORKSPACE_TEMPLATE_BASE_URL;
    oauthStateRef.current = {
      deviceId: "device-1",
      callbackPort: 17900,
      user: {
        userId: "u-1",
        userName: "Tester",
        userEmail: "tester@example.com",
        userAccessToken: "token-1",
        workspaceId: "workspace-1",
        skills: [],
      },
      supabase: {
        url: "https://example.supabase.co",
        anonKey: "anon-key",
      },
    };
    bootstrapMock.mockReset();
    bootstrapMock.mockResolvedValue(undefined);
    ensureModelsJsonMock.mockReset();
    ensureModelsJsonMock.mockResolvedValue({ agentDir: "", wrote: true });
    ensurePiAuthJsonMock.mockReset();
    ensurePiAuthJsonMock.mockResolvedValue({ authPath: "", wrote: true });
    loadEnabledBustlyWorkspaceBootstrapAgentsMock.mockReset();
    loadEnabledBustlyWorkspaceBootstrapAgentsMock.mockResolvedValue([
      { slug: "marketing", label: "Marketing", isMain: false, bootstrapMetadata: {} },
      { slug: "store-ops", label: "Store Ops", isMain: false, bootstrapMetadata: {} },
    ]);
    ensureBustlyWorkspacePresetAgentsMock.mockReset();
    ensureBustlyWorkspacePresetAgentsMock.mockResolvedValue(0);
  });

  afterEach(() => {
    if (previousStateDir === undefined) {
      delete process.env.OPENCLAW_STATE_DIR;
    } else {
      process.env.OPENCLAW_STATE_DIR = previousStateDir;
    }
    if (previousConfigPath === undefined) {
      delete process.env.OPENCLAW_CONFIG_PATH;
    } else {
      process.env.OPENCLAW_CONFIG_PATH = previousConfigPath;
    }
    if (previousWorkspaceTemplateBaseUrl === undefined) {
      delete process.env.BUSTLY_WORKSPACE_TEMPLATE_BASE_URL;
    } else {
      process.env.BUSTLY_WORKSPACE_TEMPLATE_BASE_URL = previousWorkspaceTemplateBaseUrl;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("does not block runtime initialization on preset agent warmup", async () => {
    const deferredWarmup = createDeferredPromise<number>();
    ensureBustlyWorkspacePresetAgentsMock.mockImplementationOnce(() => deferredWarmup.promise);

    const initPromise = ensureGatewayRuntimeInit({
      workspaceId: "workspace-1",
      gatewayPort: 18799,
      gatewayBind: "loopback",
      nodeManager: "pnpm",
      userAgent: "unit-test-agent",
      env: process.env,
      deferPresetAgentsSync: true,
    });

    await expect(
      waitForExpectation(() => {
        expect(loadEnabledBustlyWorkspaceBootstrapAgentsMock).toHaveBeenCalledTimes(1);
        expect(ensureBustlyWorkspacePresetAgentsMock).toHaveBeenCalledTimes(1);
      }),
    ).resolves.toBeUndefined();

    await expect(
      Promise.race([
        initPromise.then(() => "resolved"),
        new Promise((resolve) => setTimeout(() => resolve("pending"), 25)),
      ]),
    ).resolves.toBe("resolved");

    expect(loadEnabledBustlyWorkspaceBootstrapAgentsMock).toHaveBeenCalledTimes(1);
    expect(ensureBustlyWorkspacePresetAgentsMock).toHaveBeenCalledTimes(1);

    deferredWarmup.resolve(0);
    await initPromise;
  });
});
