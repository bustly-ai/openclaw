import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BustlyOAuthState } from "../config/types.base.js";
import {
  applyBustlyRuntimeManifest,
  bootstrapBustlyRuntime,
  getBustlyRuntimeHealthSnapshot,
} from "./runtime-manifest.js";

const {
  oauthStateRef,
  setActiveBustlyWorkspaceMock,
  resolveActiveBustlyWorkspaceBindingMock,
  ensureBustlyWorkspacePresetAgentsMock,
} = vi.hoisted(() => {
  return {
    oauthStateRef: { current: null as BustlyOAuthState | null },
    setActiveBustlyWorkspaceMock: vi.fn<
      (params: unknown) => Promise<{
        workspaceId: string;
        agentId: string;
        workspaceDir: string;
      }>
    >(async () => ({
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-overview",
      workspaceDir: "/tmp/workspaces/workspace-1/agents/overview",
    })),
    resolveActiveBustlyWorkspaceBindingMock: vi.fn<
      () => {
        workspaceId: string;
        agentId: string;
        workspaceDir: string;
      }
    >(() => ({
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-overview",
      workspaceDir: "/tmp/workspaces/workspace-1/agents/overview",
    })),
    ensureBustlyWorkspacePresetAgentsMock: vi.fn<(params: unknown) => Promise<number>>(
      async () => 0,
    ),
  };
});

vi.mock("../bustly-oauth.js", () => ({
  readBustlyOAuthState: vi.fn(() => oauthStateRef.current),
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

describe("bustly runtime manifest", () => {
  beforeEach(() => {
    oauthStateRef.current = null;
    setActiveBustlyWorkspaceMock.mockReset();
    setActiveBustlyWorkspaceMock.mockResolvedValue({
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-overview",
      workspaceDir: "/tmp/workspaces/workspace-1/agents/overview",
    });
    resolveActiveBustlyWorkspaceBindingMock.mockReset();
    resolveActiveBustlyWorkspaceBindingMock.mockReturnValue({
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-overview",
      workspaceDir: "/tmp/workspaces/workspace-1/agents/overview",
    });
    ensureBustlyWorkspacePresetAgentsMock.mockReset();
    ensureBustlyWorkspacePresetAgentsMock.mockResolvedValue(0);
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

  it("applies runtime manifest and forwards preset agents", async () => {
    oauthStateRef.current = null;
    ensureBustlyWorkspacePresetAgentsMock.mockResolvedValueOnce(1);
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
    ensureBustlyWorkspacePresetAgentsMock.mockResolvedValueOnce(2);

    const applied = await bootstrapBustlyRuntime({
      selectedModelInput: "bustly/chat.ultra",
      userAgent: "desktop-gateway",
    });

    expect(setActiveBustlyWorkspaceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-from-oauth",
        selectedModelInput: "bustly/chat.ultra",
        userAgent: "desktop-gateway",
      }),
    );
    const bootstrapArgs = ensureBustlyWorkspacePresetAgentsMock.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(bootstrapArgs?.workspaceId).toBe("workspace-from-oauth");
    expect(Object.prototype.hasOwnProperty.call(bootstrapArgs ?? {}, "presets")).toBe(false);
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
