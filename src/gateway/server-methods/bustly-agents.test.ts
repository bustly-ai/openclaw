import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCodes } from "../protocol/index.js";

const mocks = vi.hoisted(() => ({
  readBustlyOAuthState: vi.fn(),
  listBustlyWorkspaceAgents: vi.fn(),
  createBustlyWorkspaceAgent: vi.fn(),
  updateBustlyWorkspaceAgent: vi.fn(),
  deleteBustlyWorkspaceAgent: vi.fn(),
  listBustlyWorkspaceAgentSessions: vi.fn(),
  createBustlyWorkspaceAgentSession: vi.fn(),
}));

vi.mock("../../bustly-oauth.js", () => ({
  readBustlyOAuthState: () => mocks.readBustlyOAuthState(),
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

import { bustlyAgentsHandlers } from "./bustly-agents.js";

async function invoke(
  method: keyof typeof bustlyAgentsHandlers,
  params: Record<string, unknown> = {},
) {
  const respond = vi.fn();
  await bustlyAgentsHandlers[method]({
    req: {} as never,
    params: params as never,
    respond: respond as never,
    context: {} as never,
    client: null,
    isWebchatConnect: () => false,
  });
  return respond;
}

describe("gateway bustly agent/session handlers", () => {
  beforeEach(() => {
    mocks.readBustlyOAuthState.mockReset();
    mocks.listBustlyWorkspaceAgents.mockReset();
    mocks.createBustlyWorkspaceAgent.mockReset();
    mocks.updateBustlyWorkspaceAgent.mockReset();
    mocks.deleteBustlyWorkspaceAgent.mockReset();
    mocks.listBustlyWorkspaceAgentSessions.mockReset();
    mocks.createBustlyWorkspaceAgentSession.mockReset();
  });

  it("lists empty agent list when workspace id is unavailable", async () => {
    mocks.readBustlyOAuthState.mockReturnValue(null);
    const respond = await invoke("bustly.agents.list");
    expect(respond).toHaveBeenCalledWith(true, [], undefined);
    expect(mocks.listBustlyWorkspaceAgents).not.toHaveBeenCalled();
  });

  it("lists agents for explicit workspace id", async () => {
    mocks.listBustlyWorkspaceAgents.mockReturnValue([
      { agentId: "bustly-workspace-1-overview", name: "Overview" },
    ]);
    const respond = await invoke("bustly.agents.list", { workspaceId: "workspace-1" });
    expect(mocks.listBustlyWorkspaceAgents).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      [{ agentId: "bustly-workspace-1-overview", name: "Overview" }],
      undefined,
    );
  });

  it("validates required fields for bustly.agents.create", async () => {
    const respond = await invoke("bustly.agents.create", { workspaceId: "workspace-1" });
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
    const respond = await invoke("bustly.agents.create", {
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
    });
  });

  it("passes through bustly agent update identity and skills", async () => {
    mocks.updateBustlyWorkspaceAgent.mockResolvedValue(undefined);
    const respond = await invoke("bustly.agents.update", {
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

  it("creates a bustly session and returns key/id", async () => {
    mocks.createBustlyWorkspaceAgentSession.mockResolvedValue({
      agentId: "bustly-workspace-1-overview",
      sessionKey: "agent:bustly-workspace-1-overview:conversation:abc",
      sessionId: "session-1",
      name: "Daily pulse",
      updatedAt: 100,
    });
    const respond = await invoke("bustly.sessions.create", {
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-overview",
      label: "Daily pulse",
    });
    expect(mocks.createBustlyWorkspaceAgentSession).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-overview",
      label: "Daily pulse",
    });
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
    mocks.readBustlyOAuthState.mockReturnValue({
      supabase: {
        url: "https://example.supabase.co",
        anonKey: "anon-key",
      },
      user: {
        userAccessToken: "access-token",
        workspaceId: "workspace-1",
        userId: "user-1",
        userEmail: "user@example.com",
        userName: "User One",
      },
    });
    const respond = await invoke("bustly.supabase.get-config");
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
});
