import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BustlyOAuthState } from "../config/types.base.js";
import { ensureBustlyCloudReady } from "./workspace-runtime.js";

const {
  oauthStateRef,
  readBustlyOAuthStateEnsuringFreshTokenMock,
  refreshDefaultInstalledSkillsSnapshotMock,
  ensureGatewayRuntimeInitMock,
} = vi.hoisted(() => ({
  oauthStateRef: { current: null as BustlyOAuthState | null },
  readBustlyOAuthStateEnsuringFreshTokenMock:
    vi.fn<(options?: { forceRefresh?: boolean }) => Promise<BustlyOAuthState | null>>(),
  refreshDefaultInstalledSkillsSnapshotMock: vi.fn(async () => {}),
  ensureGatewayRuntimeInitMock: vi.fn<(options: unknown) => Promise<unknown>>(),
}));

vi.mock("../bustly-oauth.js", () => ({
  readBustlyOAuthStateEnsuringFreshToken: (options?: { forceRefresh?: boolean }) =>
    readBustlyOAuthStateEnsuringFreshTokenMock(options),
  getBustlyAccessToken: (
    state: { user?: { supabaseAccessToken?: string; userAccessToken?: string } } | null | undefined,
  ) => state?.user?.supabaseAccessToken?.trim() ?? state?.user?.userAccessToken?.trim() ?? "",
}));

vi.mock("./skill-catalog.js", () => ({
  refreshBustlyDefaultInstalledSkillsSnapshot: () => refreshDefaultInstalledSkillsSnapshotMock(),
}));

vi.mock("./gateway-runtime-init.js", () => ({
  ensureGatewayRuntimeInit: (options: unknown) => ensureGatewayRuntimeInitMock(options),
}));

describe("workspace-runtime cloud startup", () => {
  beforeEach(() => {
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
    readBustlyOAuthStateEnsuringFreshTokenMock.mockReset();
    readBustlyOAuthStateEnsuringFreshTokenMock.mockImplementation(
      async () => oauthStateRef.current,
    );
    refreshDefaultInstalledSkillsSnapshotMock.mockReset();
    refreshDefaultInstalledSkillsSnapshotMock.mockResolvedValue(undefined);
    ensureGatewayRuntimeInitMock.mockReset();
    ensureGatewayRuntimeInitMock.mockResolvedValue({
      success: true,
      configPath: "/tmp/openclaw.json",
      gatewayPort: 18799,
      gatewayBind: "loopback",
      gatewayToken: "token-2",
      workspace: "/tmp/workspaces/workspace-1/agents/overview",
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-overview",
    });
  });

  afterEach(() => {
    oauthStateRef.current = null;
  });

  it("uses lightweight preset warmup for cloud startup", async () => {
    const binding = await ensureBustlyCloudReady({
      userAgent: "cloud-test-agent",
    });

    expect(binding.workspaceId).toBe("workspace-1");
    expect(refreshDefaultInstalledSkillsSnapshotMock).toHaveBeenCalledTimes(1);
    expect(ensureGatewayRuntimeInitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        userAgent: "cloud-test-agent",
        deferPresetAgentsSync: true,
      }),
    );
  });
});
