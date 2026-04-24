import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BustlyOAuthState } from "../config/types.base.js";
import { ensureGatewayRuntimeInit } from "./gateway-runtime-init.js";

const {
  oauthStateRef,
  bootstrapMock,
  ensureModelsJsonMock,
  ensurePiAuthJsonMock,
  loadEnabledBustlyWorkspaceBootstrapAgentsMock,
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

describe("gateway-runtime-init", () => {
  let tempDir: string;
  let previousStateDir: string | undefined;
  let previousConfigPath: string | undefined;
  let previousWorkspaceTemplateBaseUrl: string | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), "openclaw-gateway-runtime-init-"));
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
    ensureModelsJsonMock.mockReset();
    ensurePiAuthJsonMock.mockReset();
    loadEnabledBustlyWorkspaceBootstrapAgentsMock.mockReset();
    bootstrapMock.mockResolvedValue(undefined);
    ensureModelsJsonMock.mockResolvedValue({ agentDir: "", wrote: true });
    ensurePiAuthJsonMock.mockResolvedValue({ authPath: "", wrote: true });
    loadEnabledBustlyWorkspaceBootstrapAgentsMock.mockResolvedValue([
      { slug: "finance", label: "Finance", isMain: false, bootstrapMetadata: {} },
      { slug: "marketing", label: "Marketing", isMain: false, bootstrapMetadata: {} },
      { slug: "store-ops", label: "Store Ops", isMain: false, bootstrapMetadata: {} },
    ]);
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

  it("initializes the bustly gateway runtime without CLI onboarding", async () => {
    const result = await ensureGatewayRuntimeInit({
      workspaceId: "workspace-1",
      gatewayPort: 18799,
      gatewayBind: "loopback",
      nodeManager: "pnpm",
      userAgent: "unit-test-agent",
      env: process.env,
    });

    expect(result.workspaceId).toBe("workspace-1");
    expect(result.workspace).toContain(
      path.join("workspaces", "workspace-1", "agents", "finance"),
    );
    expect(result.gatewayPort).toBe(18799);
    expect(result.gatewayBind).toBe("loopback");
    expect(result.gatewayToken).toBeTruthy();

    const config = JSON.parse(readFileSync(process.env.OPENCLAW_CONFIG_PATH!, "utf-8")) as {
      gateway?: {
        mode?: string;
        port?: number;
        bind?: string;
        auth?: { mode?: string; token?: string };
      };
      skills?: {
        install?: {
          nodeManager?: string;
        };
      };
      agents?: {
        defaults?: {
          workspace?: string;
          model?: { primary?: string } | string;
        };
        list?: Array<{ id?: string; name?: string }>;
      };
      auth?: {
        profiles?: Record<string, unknown>;
      };
      models?: {
        providers?: Record<string, unknown>;
      };
      session?: {
        dmScope?: string;
      };
    };

    expect(config.gateway).toMatchObject({
      mode: "local",
      port: 18799,
      bind: "loopback",
    });
    expect(config.gateway?.auth?.mode).toBe("token");
    expect(config.gateway?.auth?.token).toBeTruthy();
    expect(config.skills?.install?.nodeManager).toBe("pnpm");
    expect(config.session?.dmScope).toBe("per-account-channel-peer");
    expect(config.agents?.defaults?.workspace).toBe(result.workspace);
    expect(
      (config.agents?.list ?? []).some((entry) => entry.id === "bustly-workspace-1-marketing"),
    ).toBe(true);
    expect(
      (config.agents?.list ?? []).some((entry) => entry.id === "bustly-workspace-1-store-ops"),
    ).toBe(true);
    expect(config.auth?.profiles).toBeTruthy();
    expect(Object.keys(config.models?.providers ?? {})).toEqual(["bustly"]);

    expect(bootstrapMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(ensureModelsJsonMock).toHaveBeenCalledTimes(1);
    expect(ensurePiAuthJsonMock).toHaveBeenCalledTimes(1);
    expect(ensureModelsJsonMock.mock.calls[0]?.[1]).toBe(
      path.join(process.env.OPENCLAW_STATE_DIR!, "agents", "main", "agent"),
    );
    expect(ensurePiAuthJsonMock).toHaveBeenCalledWith(
      path.join(process.env.OPENCLAW_STATE_DIR!, "agents", "main", "agent"),
    );
  });
});
