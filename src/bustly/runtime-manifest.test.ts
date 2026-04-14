import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BustlyOAuthState } from "../config/types.base.js";
import {
  applyBustlyRuntimeManifest,
  fetchAndApplyBustlyRuntimeManifest,
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
  };
});

vi.mock("../bustly-oauth.js", () => ({
  readBustlyOAuthState: vi.fn(() => oauthStateRef.current),
  getBustlyAccessToken: vi.fn(
    (state: BustlyOAuthState | null | undefined) =>
      state?.user?.supabaseAccessToken?.trim() ?? state?.user?.userAccessToken?.trim() ?? "",
  ),
}));

vi.mock("./workspace-runtime.js", () => ({
  setActiveBustlyWorkspace: (params: unknown) => setActiveBustlyWorkspaceMock(params),
  resolveActiveBustlyWorkspaceBinding: () => resolveActiveBustlyWorkspaceBindingMock(),
}));

vi.mock("./workspace-agents.js", () => ({
  ensureBustlyWorkspacePresetAgents: (params: unknown) =>
    ensureBustlyWorkspacePresetAgentsMock(params),
}));

const fetchMock = vi.fn();
vi.mock("./control-plane-runtime.js", () => ({
  fetchBustlyRuntimeManifest: (params: unknown) => fetchMock(params),
}));

describe("bustly runtime manifest", () => {
  beforeEach(() => {
    fetchMock.mockReset();
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

  it("fetches manifest from control plane and applies it", async () => {
    fetchMock.mockResolvedValue({
      workspaceId: "workspace-1",
      runtimeId: "runtime-1",
      manifestRevision: "rev-1",
      manifest: {
        workspaceName: "Workspace One",
        selectedModel: "bustly/chat.standard",
        presetAgents: [{ slug: "growth", label: "Growth" }],
      },
    });

    const applied = await fetchAndApplyBustlyRuntimeManifest({
      userAgent: "openclaw-cloud",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(setActiveBustlyWorkspaceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        workspaceName: "Workspace One",
        selectedModelInput: "bustly/chat.standard",
        userAgent: "openclaw-cloud",
      }),
    );
    expect(applied.manifestRevision).toBe("rev-1");
  });
});
