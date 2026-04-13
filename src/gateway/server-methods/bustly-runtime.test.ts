import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayRequestHandlers } from "./types.js";
import { bustlyRuntimeHandlers } from "./bustly-runtime.js";

const {
  readBustlyOAuthStateMock,
  getBustlyRuntimeHealthSnapshotMock,
  applyBustlyRuntimeManifestMock,
  createBustlyIssueReportArchiveMock,
} = vi.hoisted(() => ({
  readBustlyOAuthStateMock: vi.fn(),
  getBustlyRuntimeHealthSnapshotMock: vi.fn(),
  applyBustlyRuntimeManifestMock: vi.fn(),
  createBustlyIssueReportArchiveMock: vi.fn(),
}));

vi.mock("../../bustly-oauth.js", () => ({
  readBustlyOAuthState: () => readBustlyOAuthStateMock(),
}));

vi.mock("../../bustly/runtime-manifest.js", () => ({
  getBustlyRuntimeHealthSnapshot: () => getBustlyRuntimeHealthSnapshotMock(),
  applyBustlyRuntimeManifest: (params: unknown) => applyBustlyRuntimeManifestMock(params),
}));

vi.mock("../../bustly/issue-report.js", () => ({
  createBustlyIssueReportArchive: (params: unknown) => createBustlyIssueReportArchiveMock(params),
}));

async function invoke(
  handlers: GatewayRequestHandlers,
  method: string,
  params: Record<string, unknown> = {},
) {
  let response:
    | { ok: true; result: unknown; error: undefined }
    | { ok: false; result: undefined; error: { code: string; message: string } }
    | undefined;
  const handler = handlers[method];
  if (!handler) {
    throw new Error(`Missing handler for method: ${method}`);
  }
  await handler({
    req: { id: "1", method, params },
    params,
    client: undefined,
    isWebchatConnect: false,
    respond: (ok, result, error) => {
      if (ok) {
        response = { ok: true, result, error: undefined };
      } else {
        response = {
          ok: false,
          result: undefined,
          error: error as { code: string; message: string },
        };
      }
    },
    context: {
      logGateway: {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      },
      runtime: {
        log: () => {},
        error: () => {},
        exit: () => {},
      },
      cfg: {},
      wsClients: new Map(),
      wsServer: undefined,
    },
  } as Parameters<NonNullable<GatewayRequestHandlers[string]>>[0]);
  return response;
}

describe("gateway bustly.runtime methods", () => {
  beforeEach(() => {
    readBustlyOAuthStateMock.mockReset();
    getBustlyRuntimeHealthSnapshotMock.mockReset();
    applyBustlyRuntimeManifestMock.mockReset();
    createBustlyIssueReportArchiveMock.mockReset();
  });

  it("returns runtime health snapshot", async () => {
    getBustlyRuntimeHealthSnapshotMock.mockReturnValue({
      loggedIn: true,
      workspaceId: "workspace-1",
      userId: "u-1",
      userEmail: "u@example.com",
      hasSupabaseConfig: true,
      activeBinding: {
        workspaceId: "workspace-1",
        agentId: "bustly-workspace-1-overview",
        workspaceDir: "/tmp/workspaces/workspace-1/agents/overview",
      },
    });
    const respond = await invoke(bustlyRuntimeHandlers, "bustly.runtime.health");
    expect(respond).toEqual({
      ok: true,
      result: expect.objectContaining({
        loggedIn: true,
        workspaceId: "workspace-1",
      }),
      error: undefined,
    });
  });

  it("validates workspace id for runtime manifest apply", async () => {
    readBustlyOAuthStateMock.mockReturnValue(null);
    const respond = await invoke(
      bustlyRuntimeHandlers,
      "bustly.runtime.manifest.apply",
      {},
    );
    expect(respond).toEqual({
      ok: false,
      result: undefined,
      error: {
        code: "INVALID_REQUEST",
        message: "workspaceId is required",
      },
    });
  });

  it("applies runtime manifest with selected model aliases and preset agents", async () => {
    readBustlyOAuthStateMock.mockReturnValue({
      user: {
        workspaceId: "workspace-from-oauth",
      },
    });
    applyBustlyRuntimeManifestMock.mockResolvedValue({
      workspaceId: "workspace-from-oauth",
      agentId: "bustly-workspace-from-oauth-overview",
      workspaceDir: "/tmp/workspaces/workspace-from-oauth/agents/overview",
      presetAgentsApplied: 1,
    });
    const respond = await invoke(
      bustlyRuntimeHandlers,
      "bustly.runtime.manifest.apply",
      {
        model: "bustly/chat.standard",
        presetAgents: [{ slug: "growth", label: "Growth", icon: "ChartLine" }],
      },
    );
    expect(applyBustlyRuntimeManifestMock).toHaveBeenCalledWith({
      workspaceId: "workspace-from-oauth",
      workspaceName: undefined,
      agentName: undefined,
      selectedModelInput: "bustly/chat.standard",
      userAgent: undefined,
      baseUrl: undefined,
      presetAgents: [{ slug: "growth", label: "Growth", icon: "ChartLine", isMain: false }],
    });
    expect(respond).toEqual({
      ok: true,
      result: {
        workspaceId: "workspace-from-oauth",
        agentId: "bustly-workspace-from-oauth-overview",
        workspaceDir: "/tmp/workspaces/workspace-from-oauth/agents/overview",
        presetAgentsApplied: 1,
      },
      error: undefined,
    });
  });

  it("creates issue report archive via shared runtime utility", async () => {
    createBustlyIssueReportArchiveMock.mockResolvedValue({
      archivePath: "/tmp/reports/bustly-issue-report-20260413-010101.zip",
      stateDir: "/tmp/state/.bustly",
      outputDir: "/tmp/reports",
    });
    const respond = await invoke(
      bustlyRuntimeHandlers,
      "bustly.runtime.report-issue",
      { outputDir: "/tmp/reports", stateDir: "/tmp/state/.bustly" },
    );
    expect(createBustlyIssueReportArchiveMock).toHaveBeenCalledWith({
      outputDir: "/tmp/reports",
      stateDir: "/tmp/state/.bustly",
    });
    expect(respond).toEqual({
      ok: true,
      result: {
        archivePath: "/tmp/reports/bustly-issue-report-20260413-010101.zip",
        stateDir: "/tmp/state/.bustly",
        outputDir: "/tmp/reports",
      },
      error: undefined,
    });
  });
});
