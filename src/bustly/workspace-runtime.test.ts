import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BustlyOAuthState } from "../config/types.base.js";
import {
  ensureBustlyCloudReady,
  setActiveBustlyWorkspace,
  synchronizeBustlyWorkspaceContext,
} from "./workspace-runtime.js";

const { oauthStateRef, setActiveWorkspaceIdMock, bootstrapMock, fetchAndApplyManifestMock } =
  vi.hoisted(() => {
    return {
      oauthStateRef: { current: null as BustlyOAuthState | null },
      setActiveWorkspaceIdMock: vi.fn<(workspaceId: string) => void>(),
      bootstrapMock: vi.fn(async () => {}),
      fetchAndApplyManifestMock: vi.fn(async () => ({
        workspaceId: "workspace-1",
        agentId: "bustly-workspace-1-overview",
        workspaceDir: "/tmp/workspaces/workspace-1/agents/overview",
        presetAgentsApplied: 0,
        manifestRevision: "rev-1",
      })),
    };
  });

vi.mock("../bustly-oauth.js", () => ({
  readBustlyOAuthState: vi.fn(() => oauthStateRef.current),
  readBustlyOAuthStateEnsuringFreshToken: vi.fn(async () => oauthStateRef.current),
  getBustlyAccessToken: vi.fn(
    (state: BustlyOAuthState | null | undefined) =>
      state?.user?.supabaseAccessToken?.trim() ?? state?.user?.userAccessToken?.trim() ?? "",
  ),
  setActiveWorkspaceId: (workspaceId: string) => setActiveWorkspaceIdMock(workspaceId),
}));

vi.mock("./workspace-bootstrap.js", () => ({
  initializeBustlyWorkspaceBootstrap: (params: unknown) => bootstrapMock(params),
}));

vi.mock("./runtime-manifest.js", () => ({
  fetchAndApplyBustlyRuntimeManifest: (params: unknown) => fetchAndApplyManifestMock(params),
}));

describe("workspace-runtime", () => {
  let tempDir: string;
  let previousStateDir: string | undefined;
  let previousConfigPath: string | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), "openclaw-bustly-runtime-"));
    previousStateDir = process.env.OPENCLAW_STATE_DIR;
    previousConfigPath = process.env.OPENCLAW_CONFIG_PATH;
    process.env.OPENCLAW_STATE_DIR = path.join(tempDir, "state");
    process.env.OPENCLAW_CONFIG_PATH = path.join(tempDir, "state", "openclaw.json");
    oauthStateRef.current = null;
    setActiveWorkspaceIdMock.mockReset();
    bootstrapMock.mockReset();
    bootstrapMock.mockResolvedValue(undefined);
    fetchAndApplyManifestMock.mockReset();
    fetchAndApplyManifestMock.mockResolvedValue({
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-overview",
      workspaceDir: "/tmp/workspaces/workspace-1/agents/overview",
      presetAgentsApplied: 0,
      manifestRevision: "rev-1",
    });
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
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("fails cloud preflight when oauth token is missing", async () => {
    oauthStateRef.current = {
      deviceId: "device-1",
      callbackPort: 17900,
      user: {
        userId: "u-1",
        userName: "Tester",
        userEmail: "tester@example.com",
        workspaceId: "workspace-1",
        skills: [],
      },
    };
    await expect(ensureBustlyCloudReady()).rejects.toThrow(
      "No Bustly token found in ~/.bustly/bustlyOauth.json",
    );
  });

  it("initializes config and workspace binding for cloud mode", async () => {
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
    const binding = await ensureBustlyCloudReady({
      userAgent: "cloud-test-agent",
    });
    expect(binding.workspaceId).toBe("workspace-1");
    expect(binding.agentId).toBe("bustly-workspace-1-overview");
    expect(binding.workspaceDir).toContain(
      path.join("workspaces", "workspace-1", "agents", "overview"),
    );
    expect(bootstrapMock).toHaveBeenCalledTimes(1);
    const configPath = process.env.OPENCLAW_CONFIG_PATH!;
    const config = JSON.parse(readFileSync(configPath, "utf-8")) as {
      agents?: { defaults?: { workspace?: string } };
      models?: { providers?: Record<string, unknown> };
    };
    expect(config.agents?.defaults?.workspace).toBe(binding.workspaceDir);
    expect(Object.keys(config.models?.providers ?? {})).toEqual(["bustly"]);
  });

  it("accepts v13 owner session shape during cloud preflight", async () => {
    oauthStateRef.current = {
      deviceId: "device-1",
      callbackPort: 17900,
      user: {
        userId: "u-1",
        userName: "Tester",
        userEmail: "tester@example.com",
        supabaseAccessToken: "token-1",
        supabaseAccessTokenExpiresAt: 1777001200,
        bustlyRefreshToken: "refresh-1",
        workspaceId: "workspace-1",
        skills: [],
      },
      supabase: {
        url: "https://example.supabase.co",
        anonKey: "anon-key",
      },
    };

    const binding = await ensureBustlyCloudReady({
      userAgent: "cloud-test-agent",
    });

    expect(binding.workspaceId).toBe("workspace-1");
    expect(bootstrapMock).toHaveBeenCalledTimes(1);
  });

  it("prefers control plane manifest preflight in cloud runtime mode", async () => {
    const binding = await ensureBustlyCloudReady({
      env: {
        OPENCLAW_STATE_DIR: path.join(tempDir, "state"),
        OPENCLAW_CONFIG_PATH: path.join(tempDir, "state", "openclaw.json"),
        BUSTLY_CONTROL_PLANE_BASE_URL: "https://cp.example.com",
        BUSTLY_RUNTIME_WORKSPACE_ID: "workspace-1",
        BUSTLY_RUNTIME_ID: "runtime-1",
        BUSTLY_RUNTIME_TOKEN: "runtime-token",
      } as NodeJS.ProcessEnv,
      userAgent: "openclaw-cloud",
    });

    expect(fetchAndApplyManifestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userAgent: "openclaw-cloud",
      }),
    );
    expect(binding.workspaceId).toBe("workspace-1");
  });

  it("is idempotent when switching to the current workspace", async () => {
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
    await synchronizeBustlyWorkspaceContext({
      workspaceId: "workspace-1",
      allowCreateConfig: true,
    });
    const switched = await setActiveBustlyWorkspace({
      workspaceId: "workspace-1",
      allowCreateConfig: true,
    });
    expect(switched?.workspaceId).toBe("workspace-1");
    expect(setActiveWorkspaceIdMock).not.toHaveBeenCalled();
  });

  it("preserves openclaw-lark plugin settings during cloud preflight", async () => {
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
    mkdirSync(path.dirname(process.env.OPENCLAW_CONFIG_PATH!), { recursive: true });
    writeFileSync(
      process.env.OPENCLAW_CONFIG_PATH!,
      JSON.stringify(
        {
          plugins: {
            entries: {
              "openclaw-lark": {
                enabled: true,
              },
            },
          },
        },
        null,
        2,
      ),
      "utf-8",
    );

    await ensureBustlyCloudReady({
      userAgent: "cloud-test-agent",
    });

    const next = JSON.parse(readFileSync(process.env.OPENCLAW_CONFIG_PATH!, "utf-8")) as {
      plugins?: { entries?: Record<string, { enabled?: boolean }> };
    };
    expect(next.plugins?.entries?.["openclaw-lark"]?.enabled).toBe(true);
  });
});
