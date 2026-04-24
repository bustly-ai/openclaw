import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCodes } from "../protocol/index.js";
import { DEFAULT_BUSTLY_HEARTBEAT_EVERY } from "../../bustly/heartbeats.js";

const mocks = vi.hoisted(() => ({
  readBustlyOAuthStateEnsuringFreshToken: vi.fn(),
  getBustlySupabaseAuthConfigEnsuringFreshToken: vi.fn(),
  loadBustlyRemoteAgentMetadata: vi.fn(),
  listBustlyWorkspaceAgents: vi.fn(),
  createBustlyWorkspaceAgent: vi.fn(),
  updateBustlyWorkspaceAgent: vi.fn(),
  deleteBustlyWorkspaceAgent: vi.fn(),
  listBustlyWorkspaceAgentSessions: vi.fn(),
  createBustlyWorkspaceAgentSession: vi.fn(),
  loadConfig: vi.fn(),
  scheduleBustlySessionTitleGeneration: vi.fn(),
}));

vi.mock("../../bustly-oauth.js", () => ({
  readBustlyOAuthStateEnsuringFreshToken: (options?: { forceRefresh?: boolean }) =>
    mocks.readBustlyOAuthStateEnsuringFreshToken(options),
}));

vi.mock("../../bustly/agent-presets.js", () => ({
  loadBustlyRemoteAgentMetadata: (slug: string) => mocks.loadBustlyRemoteAgentMetadata(slug),
}));

vi.mock("../../bustly/workspace-agents.js", () => ({
  listBustlyWorkspaceAgents: (params: unknown) => mocks.listBustlyWorkspaceAgents(params),
  createBustlyWorkspaceAgent: (params: unknown) => mocks.createBustlyWorkspaceAgent(params),
  updateBustlyWorkspaceAgent: (params: unknown) => mocks.updateBustlyWorkspaceAgent(params),
  deleteBustlyWorkspaceAgent: (params: unknown) => mocks.deleteBustlyWorkspaceAgent(params),
  listBustlyWorkspaceAgentSessions: (params: unknown) =>
    mocks.listBustlyWorkspaceAgentSessions(params),
  createBustlyWorkspaceAgentSession: (params: unknown) =>
    mocks.createBustlyWorkspaceAgentSession(params),
}));

vi.mock("../../config/config.js", () => ({
  loadConfig: () => mocks.loadConfig(),
}));

vi.mock("../../bustly/supabase.js", () => ({
  getBustlySupabaseAuthConfigEnsuringFreshToken: () =>
    mocks.getBustlySupabaseAuthConfigEnsuringFreshToken(),
}));

vi.mock("../../bustly/session-title.js", () => ({
  scheduleBustlySessionTitleGeneration: (params: unknown) =>
    mocks.scheduleBustlySessionTitleGeneration(params),
}));

import { bustlyAgentsHandlers } from "./bustly-agents.js";

async function invoke(
  method: keyof typeof bustlyAgentsHandlers,
  params: Record<string, unknown> = {},
) {
  const respond = vi.fn();
  const broadcast = vi.fn();
  await bustlyAgentsHandlers[method]({
    req: {} as never,
    params: params as never,
    respond: respond as never,
    context: { broadcast } as never,
    client: null,
    isWebchatConnect: () => false,
  });
  return { respond, broadcast };
}

describe("gateway bustly agent/session handlers", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mocks.loadBustlyRemoteAgentMetadata.mockReset();
    mocks.readBustlyOAuthStateEnsuringFreshToken.mockReset();
    mocks.getBustlySupabaseAuthConfigEnsuringFreshToken.mockReset();
    mocks.listBustlyWorkspaceAgents.mockReset();
    mocks.createBustlyWorkspaceAgent.mockReset();
    mocks.updateBustlyWorkspaceAgent.mockReset();
    mocks.deleteBustlyWorkspaceAgent.mockReset();
    mocks.listBustlyWorkspaceAgentSessions.mockReset();
    mocks.createBustlyWorkspaceAgentSession.mockReset();
    mocks.loadConfig.mockReset();
    mocks.scheduleBustlySessionTitleGeneration.mockReset();
    mocks.loadConfig.mockReturnValue({ providers: [] });
  });

  it("returns remote agent config for a slug", async () => {
    mocks.loadBustlyRemoteAgentMetadata.mockResolvedValue({
      label: "Marketing",
      icon: "Web3_Avatar_1.png",
      skills: ["ads-core-ops", "commerce-core-ops"],
      useCases: [
        {
          label: "Campaign Diagnosis",
          prompt: "Find wasted spend.",
        },
      ],
    });
    const { respond } = await invoke("bustly.agents.get-config", { slug: "marketing" });
    expect(mocks.loadBustlyRemoteAgentMetadata).toHaveBeenCalledWith("marketing");
    expect(respond).toHaveBeenCalledWith(
      true,
      {
        slug: "marketing",
        label: "Marketing",
        icon: "Web3_Avatar_1.png",
        skills: ["ads-core-ops", "commerce-core-ops"],
        useCases: [
          {
            label: "Campaign Diagnosis",
            prompt: "Find wasted spend.",
          },
        ],
      },
      undefined,
    );
  });

  it("validates bustly.agents.get-config slug", async () => {
    const { respond } = await invoke("bustly.agents.get-config", {});
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: ErrorCodes.INVALID_REQUEST,
        message: "slug is required",
      }),
    );
  });

  it("lists empty agent list when workspace id is unavailable", async () => {
    mocks.readBustlyOAuthStateEnsuringFreshToken.mockResolvedValue(null);
    const { respond } = await invoke("bustly.agents.list");
    expect(respond).toHaveBeenCalledWith(true, [], undefined);
    expect(mocks.listBustlyWorkspaceAgents).not.toHaveBeenCalled();
  });

  it("lists agents for explicit workspace id", async () => {
    mocks.listBustlyWorkspaceAgents.mockReturnValue([
      { agentId: "bustly-workspace-1-overview", agentName: "overview", name: "Overview" },
      { agentId: "bustly-workspace-1-marketing", agentName: "marketing", name: "Marketing" },
    ]);
    const { respond } = await invoke("bustly.agents.list", { workspaceId: "workspace-1" });
    expect(mocks.listBustlyWorkspaceAgents).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      [{ agentId: "bustly-workspace-1-marketing", agentName: "marketing", name: "Marketing" }],
      undefined,
    );
  });

  it("validates required fields for bustly.agents.create", async () => {
    const { respond } = await invoke("bustly.agents.create", { workspaceId: "workspace-1" });
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: ErrorCodes.INVALID_REQUEST,
        message: "name is required",
      }),
    );
  });

  it("creates a bustly agent", async () => {
    mocks.createBustlyWorkspaceAgent.mockResolvedValue({
      agentId: "bustly-workspace-1-growth",
      workspaceDir: "/tmp/workspaces/workspace-1/agents/growth",
    });
    const { respond } = await invoke("bustly.agents.create", {
      workspaceId: "workspace-1",
      name: "growth",
      icon: "TrendUp",
      workspaceName: "Workspace One",
    });
    expect(mocks.createBustlyWorkspaceAgent).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      workspaceName: "Workspace One",
      agentName: "growth",
      displayName: "growth",
      icon: "TrendUp",
      heartbeat: {
        every: DEFAULT_BUSTLY_HEARTBEAT_EVERY,
        target: "none",
      },
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      {
        workspaceId: "workspace-1",
        agentId: "bustly-workspace-1-growth",
        workspaceDir: "/tmp/workspaces/workspace-1/agents/growth",
      },
      undefined,
    );
  });

  it("passes through bustly agent metadata fields", async () => {
    mocks.createBustlyWorkspaceAgent.mockResolvedValue({
      agentId: "bustly-workspace-1-growth",
      workspaceDir: "/tmp/workspaces/workspace-1/agents/growth",
    });
    await invoke("bustly.agents.create", {
      workspaceId: "workspace-1",
      name: "growth",
      description: "Run growth reporting.",
      skills: ["ads", "reporting"],
    });
    expect(mocks.createBustlyWorkspaceAgent).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      workspaceName: undefined,
      agentName: "growth",
      displayName: "growth",
      description: "Run growth reporting.",
      skills: ["ads", "reporting"],
      icon: undefined,
      heartbeat: {
        every: DEFAULT_BUSTLY_HEARTBEAT_EVERY,
        target: "none",
      },
    });
  });

  it("passes through bustly agent update identity and skills", async () => {
    mocks.updateBustlyWorkspaceAgent.mockResolvedValue(undefined);
    const { respond } = await invoke("bustly.agents.update", {
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-growth",
      name: "Growth Ops",
      identityMarkdown: "# IDENTITY\n\n## Mission\n\nRun growth ops.",
      skills: null,
    });
    expect(mocks.updateBustlyWorkspaceAgent).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-growth",
      displayName: "Growth Ops",
      identityMarkdown: "# IDENTITY\n\n## Mission\n\nRun growth ops.",
      skills: null,
      icon: undefined,
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      {
        ok: true,
        workspaceId: "workspace-1",
        agentId: "bustly-workspace-1-growth",
      },
      undefined,
    );
  });

  it("hides heartbeat main sessions outside develop mode", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.listBustlyWorkspaceAgentSessions.mockReturnValue([]);

    const { respond } = await invoke("bustly.sessions.list", {
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-overview",
    });

    expect(mocks.listBustlyWorkspaceAgentSessions).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-overview",
      includeHeartbeatMainSessions: false,
    });
    expect(respond).toHaveBeenCalledWith(true, [], undefined);
  });

  it("shows heartbeat main sessions in develop mode", async () => {
    vi.stubEnv("OPENCLAW_PROFILE", "dev");
    mocks.listBustlyWorkspaceAgentSessions.mockReturnValue([
      {
        agentId: "bustly-workspace-1-overview",
        sessionKey: "agent:bustly-workspace-1-overview:main",
        kind: "heartbeat",
        name: "Heartbeat",
        updatedAt: 100,
      },
    ]);

    const { respond } = await invoke("bustly.sessions.list", {
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-overview",
    });

    expect(mocks.listBustlyWorkspaceAgentSessions).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-overview",
      includeHeartbeatMainSessions: true,
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      [
        {
          agentId: "bustly-workspace-1-overview",
          sessionKey: "agent:bustly-workspace-1-overview:main",
          kind: "heartbeat",
          name: "Heartbeat",
          updatedAt: 100,
        },
      ],
      undefined,
    );
  });

  it("shows heartbeat main sessions in electron develop mode", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OPENCLAW_PROFILE", "bustly");
    vi.stubEnv("OPENCLAW_ELECTRON_DEV", "1");
    mocks.listBustlyWorkspaceAgentSessions.mockReturnValue([
      {
        agentId: "bustly-workspace-1-overview",
        sessionKey: "agent:bustly-workspace-1-overview:main",
        kind: "heartbeat",
        name: "Heartbeat",
        updatedAt: 100,
      },
    ]);

    const { respond } = await invoke("bustly.sessions.list", {
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-overview",
    });

    expect(mocks.listBustlyWorkspaceAgentSessions).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-overview",
      includeHeartbeatMainSessions: true,
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      [
        {
          agentId: "bustly-workspace-1-overview",
          sessionKey: "agent:bustly-workspace-1-overview:main",
          kind: "heartbeat",
          name: "Heartbeat",
          updatedAt: 100,
        },
      ],
      undefined,
    );
  });

  it("creates a bustly session and returns key/id", async () => {
    mocks.createBustlyWorkspaceAgentSession.mockResolvedValue({
      agentId: "bustly-workspace-1-overview",
      sessionKey: "agent:bustly-workspace-1-overview:conversation:abc",
      sessionId: "session-1",
      name: "Daily pulse",
      updatedAt: 100,
    });
    const { respond, broadcast } = await invoke("bustly.sessions.create", {
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-overview",
      label: "Daily pulse",
      promptExcerpt: "Summarize today's pipeline failures",
      sampleRouteKey: "chat.advanced",
    });
    expect(mocks.createBustlyWorkspaceAgentSession).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-overview",
      label: "Daily pulse",
    });
    expect(mocks.scheduleBustlySessionTitleGeneration).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-overview",
      sessionKey: "agent:bustly-workspace-1-overview:conversation:abc",
      sessionId: "session-1",
      seedLabel: "Daily pulse",
      promptExcerpt: "Summarize today's pipeline failures",
      sampleRouteKey: "chat.advanced",
      cfg: { providers: [] },
      onLabelUpdated: expect.any(Function),
    });
    const onLabelUpdated = mocks.scheduleBustlySessionTitleGeneration.mock.calls[0]?.[0]
      ?.onLabelUpdated as ((payload: unknown) => void) | undefined;
    expect(onLabelUpdated).toBeTypeOf("function");
    onLabelUpdated?.({
      agentId: "bustly-workspace-1-overview",
      sessionKey: "agent:bustly-workspace-1-overview:conversation:abc",
      label: "Pipeline failures",
      updatedAt: 200,
    });
    expect(broadcast).toHaveBeenCalledWith(
      "bustly.session.label.updated",
      {
        agentId: "bustly-workspace-1-overview",
        sessionKey: "agent:bustly-workspace-1-overview:conversation:abc",
        label: "Pipeline failures",
        updatedAt: 200,
      },
      { dropIfSlow: true },
    );
    expect(respond).toHaveBeenCalledWith(
      true,
      {
        workspaceId: "workspace-1",
        agentId: "bustly-workspace-1-overview",
        sessionKey: "agent:bustly-workspace-1-overview:conversation:abc",
        sessionId: "session-1",
        name: "Daily pulse",
        updatedAt: 100,
      },
      undefined,
    );
  });

  it("returns supabase config payload", async () => {
    mocks.getBustlySupabaseAuthConfigEnsuringFreshToken.mockResolvedValue({
      url: "https://example.supabase.co",
      anonKey: "anon-key",
      accessToken: "access-token",
      workspaceId: "workspace-1",
      userId: "user-1",
      userEmail: "user@example.com",
      userName: "User One",
    });
    const { respond } = await invoke("bustly.supabase.get-config");
    expect(respond).toHaveBeenCalledWith(
      true,
      {
        url: "https://example.supabase.co",
        anonKey: "anon-key",
        accessToken: "access-token",
        workspaceId: "workspace-1",
        userId: "user-1",
        userEmail: "user@example.com",
        userName: "User One",
      },
      undefined,
    );
  });

  it("refreshes bustly supabase config before returning it", async () => {
    mocks.readBustlyOAuthStateEnsuringFreshToken.mockResolvedValue({
      supabase: {
        url: "https://example.supabase.co",
        anonKey: "anon-key",
      },
      user: {
        userAccessToken: "stale-token",
        workspaceId: "workspace-1",
        userId: "user-1",
        userEmail: "user@example.com",
        userName: "User One",
      },
    });
    mocks.getBustlySupabaseAuthConfigEnsuringFreshToken.mockResolvedValue({
      url: "https://example.supabase.co",
      anonKey: "anon-key",
      accessToken: "fresh-token",
      workspaceId: "workspace-1",
      userId: "user-1",
      userEmail: "user@example.com",
      userName: "User One",
    });

    const { respond } = await invoke("bustly.supabase.get-config");

    expect(mocks.getBustlySupabaseAuthConfigEnsuringFreshToken).toHaveBeenCalledTimes(1);
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        accessToken: "fresh-token",
      }),
      undefined,
    );
  });
});
