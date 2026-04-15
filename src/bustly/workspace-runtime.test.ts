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

const {
  oauthStateRef,
  setActiveWorkspaceIdMock,
  bootstrapMock,
  resolveFirstAccessibleWorkspaceMock,
} = vi.hoisted(() => {
  return {
    oauthStateRef: { current: null as BustlyOAuthState | null },
    setActiveWorkspaceIdMock: vi.fn<(workspaceId: string) => void>(),
    bootstrapMock: vi.fn(async () => {}),
    resolveFirstAccessibleWorkspaceMock: vi.fn(async () => null),
  };
});
const { ensureModelsJsonMock, ensurePiAuthJsonMock } = vi.hoisted(() => {
  return {
    ensureModelsJsonMock: vi.fn(async () => ({ agentDir: "", wrote: true })),
    ensurePiAuthJsonMock: vi.fn(async () => ({ authPath: "", wrote: true })),
  };
});

vi.mock("../bustly-oauth.js", () => ({
  readBustlyOAuthState: vi.fn(() => oauthStateRef.current),
  getBustlyAccessToken: (
    state: { user?: { supabaseAccessToken?: string; userAccessToken?: string } } | null | undefined,
  ) => state?.user?.supabaseAccessToken?.trim() ?? state?.user?.userAccessToken?.trim() ?? "",
  setActiveWorkspaceId: (workspaceId: string) => setActiveWorkspaceIdMock(workspaceId),
}));

vi.mock("./workspace-bootstrap.js", () => ({
  initializeBustlyWorkspaceBootstrap: (params: unknown) => bootstrapMock(params),
}));

vi.mock("../agents/models-config.js", () => ({
  ensureOpenClawModelsJson: (config: unknown, agentDir: string) => ensureModelsJsonMock(config, agentDir),
}));

vi.mock("../agents/pi-auth-json.js", () => ({
  ensurePiAuthJsonFromAuthProfiles: (agentDir: string) => ensurePiAuthJsonMock(agentDir),
}));

vi.mock("./supabase.js", () => ({
  resolveFirstAccessibleBustlyWorkspace: () => resolveFirstAccessibleWorkspaceMock(),
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
    resolveFirstAccessibleWorkspaceMock.mockReset();
    resolveFirstAccessibleWorkspaceMock.mockResolvedValue(null);
    ensureModelsJsonMock.mockReset();
    ensureModelsJsonMock.mockResolvedValue({ agentDir: "", wrote: true });
    ensurePiAuthJsonMock.mockReset();
    ensurePiAuthJsonMock.mockResolvedValue({ authPath: "", wrote: true });
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

  it("accepts a supabase access token even when platform token is stale", async () => {
    oauthStateRef.current = {
      deviceId: "device-1",
      callbackPort: 17900,
      user: {
        userId: "u-1",
        userName: "Tester",
        userEmail: "tester@example.com",
        userAccessToken: "platform-token",
        supabaseAccessToken: "jwt-token",
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
      gateway?: {
        mode?: string;
        auth?: { token?: string };
      };
      agents?: { defaults?: { workspace?: string } };
      models?: { providers?: Record<string, unknown> };
    };
    expect(config.gateway?.mode).toBe("local");
    expect(config.gateway?.auth?.token).toBeTruthy();
    expect(config.agents?.defaults?.workspace).toBe(binding.workspaceDir);
    expect(Object.keys(config.models?.providers ?? {})).toEqual(["bustly"]);
    expect(ensureModelsJsonMock).toHaveBeenCalledTimes(1);
    expect(ensurePiAuthJsonMock).toHaveBeenCalledTimes(1);
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

  it("does not persist a workspace switch when bootstrap fails", async () => {
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

    bootstrapMock.mockRejectedValueOnce(
      new Error("Workspace workspace-2 not found for bootstrap."),
    );
    await expect(
      setActiveBustlyWorkspace({
        workspaceId: "workspace-2",
        allowCreateConfig: true,
      }),
    ).rejects.toThrow("Workspace workspace-2 not found for bootstrap.");

    expect(setActiveWorkspaceIdMock).not.toHaveBeenCalled();

    const config = JSON.parse(readFileSync(process.env.OPENCLAW_CONFIG_PATH!, "utf-8")) as {
      models?: {
        providers?: {
          bustly?: {
            headers?: Record<string, string>;
          };
        };
      };
    };
    expect(config.models?.providers?.bustly?.headers?.["X-Workspace-Id"]).toBe("workspace-1");
  });

  it("falls back to the first accessible workspace when target workspace is missing", async () => {
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

    bootstrapMock.mockRejectedValueOnce(
      new Error("Workspace workspace-2 not found for bootstrap."),
    );
    resolveFirstAccessibleWorkspaceMock.mockResolvedValueOnce({
      id: "workspace-3",
      name: "Fallback Workspace",
      status: "ACTIVE",
    });

    const switched = await setActiveBustlyWorkspace({
      workspaceId: "workspace-2",
      allowCreateConfig: true,
    });

    expect(switched?.workspaceId).toBe("workspace-3");
    expect(resolveFirstAccessibleWorkspaceMock).toHaveBeenCalledTimes(1);
    expect(setActiveWorkspaceIdMock).toHaveBeenCalledWith("workspace-3");

    const config = JSON.parse(readFileSync(process.env.OPENCLAW_CONFIG_PATH!, "utf-8")) as {
      models?: {
        providers?: {
          bustly?: {
            headers?: Record<string, string>;
          };
        };
      };
    };
    expect(config.models?.providers?.bustly?.headers?.["X-Workspace-Id"]).toBe("workspace-3");
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
