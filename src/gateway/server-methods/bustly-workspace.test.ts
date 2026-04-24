import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCodes } from "../protocol/index.js";

const mocks = vi.hoisted(() => ({
  resolveActiveBustlyWorkspaceBinding: vi.fn(),
  setActiveBustlyWorkspace: vi.fn(),
}));

vi.mock("../../bustly/workspace-runtime.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../bustly/workspace-runtime.js")>();
  return {
    ...actual,
    resolveActiveBustlyWorkspaceBinding: (...args: unknown[]) =>
      mocks.resolveActiveBustlyWorkspaceBinding(...args),
    setActiveBustlyWorkspace: (...args: unknown[]) => mocks.setActiveBustlyWorkspace(...args),
  };
});

import { bustlyWorkspaceHandlers } from "./bustly-workspace.js";

async function invokeGetActive() {
  const respond = vi.fn();
  await bustlyWorkspaceHandlers["bustly.workspace.get-active"]({
    req: {} as never,
    params: {} as never,
    respond: respond as never,
    context: {} as never,
    client: null,
    isWebchatConnect: () => false,
  });
  return respond;
}

async function invokeSetActive(params: Record<string, unknown>) {
  const respond = vi.fn();
  await bustlyWorkspaceHandlers["bustly.workspace.set-active"]({
    req: {} as never,
    params: params as never,
    respond: respond as never,
    context: {} as never,
    client: null,
    isWebchatConnect: () => false,
  });
  return respond;
}

describe("gateway bustly.workspace methods", () => {
  beforeEach(() => {
    mocks.resolveActiveBustlyWorkspaceBinding.mockReset();
    mocks.setActiveBustlyWorkspace.mockReset();
  });

  it("returns current active bustly workspace", async () => {
    mocks.resolveActiveBustlyWorkspaceBinding.mockReturnValue({
      workspaceId: "workspace-1",
      agentId: "bustly-workspace-1-overview",
      workspaceDir: "/tmp/workspaces/workspace-1/agents/overview",
    });
    const respond = await invokeGetActive();
    expect(respond).toHaveBeenCalledWith(
      true,
      {
        workspaceId: "workspace-1",
        agentId: "bustly-workspace-1-overview",
        workspaceDir: "/tmp/workspaces/workspace-1/agents/overview",
      },
      undefined,
    );
  });

  it("returns INVALID_REQUEST when no active workspace exists", async () => {
    mocks.resolveActiveBustlyWorkspaceBinding.mockReturnValue(null);
    const respond = await invokeGetActive();
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: ErrorCodes.INVALID_REQUEST,
        message: expect.stringContaining("No active Bustly workspace"),
      }),
    );
  });

  it("returns INVALID_REQUEST when set-active omits workspaceId", async () => {
    const respond = await invokeSetActive({});
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: ErrorCodes.INVALID_REQUEST,
        message: "workspaceId is required",
      }),
    );
    expect(mocks.setActiveBustlyWorkspace).not.toHaveBeenCalled();
  });

  it("switches active workspace and returns updated binding", async () => {
    mocks.setActiveBustlyWorkspace.mockResolvedValue({
      workspaceId: "workspace-2",
      agentId: "bustly-workspace-2-overview",
      workspaceDir: "/tmp/workspaces/workspace-2/agents/overview",
    });
    const respond = await invokeSetActive({
      workspaceId: "workspace-2",
      workspaceName: "Workspace Two",
    });
    expect(mocks.setActiveBustlyWorkspace).toHaveBeenCalledWith({
      workspaceId: "workspace-2",
      workspaceName: "Workspace Two",
      allowCreateConfig: true,
      deferBootstrap: true,
      userAgent: "openclaw-cloud",
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      {
        workspaceId: "workspace-2",
        agentId: "bustly-workspace-2-overview",
        workspaceDir: "/tmp/workspaces/workspace-2/agents/overview",
      },
      undefined,
    );
  });
});
