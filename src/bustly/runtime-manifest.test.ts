import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BustlyOAuthState } from "../config/types.base.js";
import {
  applyBustlyRuntimeManifest,
  bootstrapBustlyRuntime,
  getBustlyRuntimeHealthSnapshot,
  getBustlyRuntimeHealthSnapshotEnsuringFreshToken,
} from "./runtime-manifest.js";

const {
  oauthStateRef,
  oauthFreshStateRef,
  readBustlyOAuthStateEnsuringFreshTokenMock,
  setActiveBustlyWorkspaceMock,
  resolveActiveBustlyWorkspaceBindingMock,
  ensureBustlyWorkspacePresetAgentsMock,
  loadEnabledBustlyRemoteAgentPresetsMock,
} = vi.hoisted(() => {
  return {
    oauthStateRef: { current: null as BustlyOAuthState | null },
    oauthFreshStateRef: { current: null as BustlyOAuthState | null },
    readBustlyOAuthStateEnsuringFreshTokenMock:
      vi.fn<(options?: { forceRefresh?: boolean }) => Promise<BustlyOAuthState | null>>(),
    setActiveBustlyWorkspaceMock: vi.fn(async () => ({
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-overview",
      workspaceDir: "/tmp/workspaces/workspace-1/agents/overview",
    })),
    resolveActiveBustlyWorkspaceBindingMock: vi.fn(() => ({
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-overview",
      workspaceDir: "/tmp/workspaces/workspace-1/agents/overview",
    })),
    ensureBustlyWorkspacePresetAgentsMock: vi.fn(async () => undefined),
    loadEnabledBustlyRemoteAgentPresetsMock: vi.fn(async () => []),
  };
});

vi.mock("../bustly-oauth.js", () => ({
  readBustlyOAuthState: vi.fn(() => oauthStateRef.current),
  readBustlyOAuthStateEnsuringFreshToken: (options?: { forceRefresh?: boolean }) =>
    readBustlyOAuthStateEnsuringFreshTokenMock(options),
  getBustlyAccessToken: (
    state: { user?: { supabaseAccessToken?: string; userAccessToken?: string } } | null | undefined,
  ) => state?.user?.supabaseAccessToken?.trim() ?? state?.user?.userAccessToken?.trim() ?? "",
}));

vi.mock("./workspace-runtime.js", () => ({
  setActiveBustlyWorkspace: (params: unknown) => setActiveBustlyWorkspaceMock(params),
  resolveActiveBustlyWorkspaceBinding: () => resolveActiveBustlyWorkspaceBindingMock(),
}));

vi.mock("./workspace-agents.js", () => ({
  ensureBustlyWorkspacePresetAgents: (params: unknown) =>
    ensureBustlyWorkspacePresetAgentsMock(params),
}));

vi.mock("./agent-presets.js", () => ({
  loadEnabledBustlyRemoteAgentPresets: (params: unknown) =>
    loadEnabledBustlyRemoteAgentPresetsMock(params),
}));

describe("bustly runtime manifest", () => {
  beforeEach(() => {
    oauthFreshStateRef.current = null;
    readBustlyOAuthStateEnsuringFreshTokenMock.mockReset();
    readBustlyOAuthStateEnsuringFreshTokenMock.mockImplementation(async () => {
      return oauthFreshStateRef.current ?? oauthStateRef.current;
    });
    setActiveBustlyWorkspaceMock.mockClear();
    resolveActiveBustlyWorkspaceBindingMock.mockClear();
    ensureBustlyWorkspacePresetAgentsMock.mockClear();
    loadEnabledBustlyRemoteAgentPresetsMock.mockClear();
  });

  it("returns runtime health snapshot", () => {
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

    const health = getBustlyRuntimeHealthSnapshot();
    expect(health).toMatchObject({
      loggedIn: true,
      workspaceId: "workspace-1",
      userId: "u-1",
      userEmail: "tester@example.com",
      hasSupabaseConfig: true,
    });
    expect(resolveActiveBustlyWorkspaceBindingMock).toHaveBeenCalledTimes(1);
  });

  it("prefers supabase access token in runtime health snapshot", () => {
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

    const health = getBustlyRuntimeHealthSnapshot();
    expect(health.loggedIn).toBe(true);
  });

  it("returns runtime health snapshot from refreshed oauth state", async () => {
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
      supabase: {
        url: "https://example.supabase.co",
        anonKey: "anon-key",
      },
    };
    oauthFreshStateRef.current = {
      ...oauthStateRef.current,
      user: {
        ...oauthStateRef.current.user!,
        supabaseAccessToken: "fresh-jwt-token",
        userAccessToken: "fresh-jwt-token",
      },
    };

    const health = await getBustlyRuntimeHealthSnapshotEnsuringFreshToken();

    expect(readBustlyOAuthStateEnsuringFreshTokenMock).toHaveBeenCalledTimes(1);
    expect(health.loggedIn).toBe(true);
    expect(health.workspaceId).toBe("workspace-1");
  });

  it("applies runtime manifest and forwards preset agents", async () => {
    oauthStateRef.current = null;
    const applied = await applyBustlyRuntimeManifest({
      workspaceId: "workspace-1",
      workspaceName: "Workspace One",
      selectedModelInput: "bustly/chat.standard",
      presetAgents: [{ slug: "growth", label: "Growth", icon: "ChartLine" }],
      userAgent: "cp-agent",
    });

    expect(setActiveBustlyWorkspaceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        workspaceName: "Workspace One",
        selectedModelInput: "bustly/chat.standard",
        userAgent: "cp-agent",
        allowCreateConfig: true,
      }),
    );
    expect(ensureBustlyWorkspacePresetAgentsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        workspaceName: "Workspace One",
        presets: [{ slug: "growth", label: "Growth", icon: "ChartLine", isMain: undefined }],
      }),
    );
    expect(applied).toMatchObject({
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-overview",
      presetAgentsApplied: 1,
    });
  });

  it("bootstraps runtime with shared remote presets when none are provided", async () => {
    oauthStateRef.current = {
      deviceId: "device-1",
      callbackPort: 17900,
      user: {
        userId: "u-1",
        userName: "Tester",
        userEmail: "tester@example.com",
        userAccessToken: "token-1",
        workspaceId: "workspace-from-oauth",
        skills: [],
      },
    };
    loadEnabledBustlyRemoteAgentPresetsMock.mockResolvedValue([
      { slug: "overview", label: "Overview", icon: "Robot", order: 0, isMain: true },
      { slug: "marketing", label: "Marketing", icon: "TrendUp", order: 40 },
    ]);

    const applied = await bootstrapBustlyRuntime({
      selectedModelInput: "bustly/chat.ultra",
      userAgent: "desktop-gateway",
    });

    expect(loadEnabledBustlyRemoteAgentPresetsMock).toHaveBeenCalledWith({
      env: undefined,
    });
    expect(setActiveBustlyWorkspaceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-from-oauth",
        selectedModelInput: "bustly/chat.ultra",
        userAgent: "desktop-gateway",
      }),
    );
    expect(ensureBustlyWorkspacePresetAgentsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-from-oauth",
        presets: [
          { slug: "overview", label: "Overview", icon: "Robot", isMain: true },
          { slug: "marketing", label: "Marketing", icon: "TrendUp", isMain: undefined },
        ],
      }),
    );
    expect(applied.presetAgentsApplied).toBe(2);
  });

  it("falls back to oauth workspace id and validates missing workspace", async () => {
    oauthStateRef.current = {
      deviceId: "device-1",
      callbackPort: 17900,
      user: {
        userId: "u-1",
        userName: "Tester",
        userEmail: "tester@example.com",
        userAccessToken: "token-1",
        workspaceId: "workspace-from-oauth",
        skills: [],
      },
    };

    await applyBustlyRuntimeManifest({
      selectedModelInput: "bustly/chat.ultra",
    });
    expect(setActiveBustlyWorkspaceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-from-oauth",
      }),
    );

    oauthStateRef.current = null;
    await expect(
      applyBustlyRuntimeManifest({
        selectedModelInput: "bustly/chat.ultra",
      }),
    ).rejects.toThrow("workspaceId is required");
  });
});
