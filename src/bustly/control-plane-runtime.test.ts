import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchBustlyRuntimeManifest,
  hasBustlyControlPlaneRuntimeIdentity,
  resolveBustlyControlPlaneRuntimeIdentity,
  verifyBustlyGatewayTokenWithControlPlane,
} from "./control-plane-runtime.js";

describe("bustly control plane runtime helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves cloud runtime identity from env", () => {
    const identity = resolveBustlyControlPlaneRuntimeIdentity({
      BUSTLY_CONTROL_PLANE_BASE_URL: "https://cp.example.com/",
      BUSTLY_RUNTIME_WORKSPACE_ID: "workspace-1",
      BUSTLY_RUNTIME_ID: "runtime-1",
      BUSTLY_RUNTIME_TOKEN: "runtime-token",
    } as NodeJS.ProcessEnv);

    expect(identity).toEqual({
      baseUrl: "https://cp.example.com",
      workspaceId: "workspace-1",
      runtimeId: "runtime-1",
      runtimeToken: "runtime-token",
    });
    expect(
      hasBustlyControlPlaneRuntimeIdentity({
        BUSTLY_CONTROL_PLANE_BASE_URL: "https://cp.example.com",
        BUSTLY_RUNTIME_WORKSPACE_ID: "workspace-1",
        BUSTLY_RUNTIME_ID: "runtime-1",
        BUSTLY_RUNTIME_TOKEN: "runtime-token",
      } as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it("verifies gateway token via control plane", async () => {
    const fetchImpl = vi.fn(async (_input: URL | string, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      const body = init?.body;
      expect(typeof body).toBe("string");
      expect(JSON.parse(body as string)).toMatchObject({
        workspaceId: "workspace-1",
        runtimeId: "runtime-1",
        runtimeToken: "runtime-token",
        gatewayToken: "gateway-token",
      });
      return new Response(
        JSON.stringify({
          valid: true,
          expiresAt: "2026-04-14T12:00:00.000Z",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    });

    const result = await verifyBustlyGatewayTokenWithControlPlane({
      gatewayToken: "gateway-token",
      authSurface: "http",
      env: {
        BUSTLY_CONTROL_PLANE_BASE_URL: "https://cp.example.com",
        BUSTLY_RUNTIME_WORKSPACE_ID: "workspace-1",
        BUSTLY_RUNTIME_ID: "runtime-1",
        BUSTLY_RUNTIME_TOKEN: "runtime-token",
      } as NodeJS.ProcessEnv,
      fetchImpl,
    });

    expect(result).toEqual({
      ok: true,
      expiresAt: "2026-04-14T12:00:00.000Z",
    });
  });

  it("maps control plane verification failures to gateway reasons", async () => {
    const result = await verifyBustlyGatewayTokenWithControlPlane({
      gatewayToken: "bad-token",
      authSurface: "ws-control-ui",
      env: {
        BUSTLY_CONTROL_PLANE_BASE_URL: "https://cp.example.com",
        BUSTLY_RUNTIME_WORKSPACE_ID: "workspace-1",
        BUSTLY_RUNTIME_ID: "runtime-1",
        BUSTLY_RUNTIME_TOKEN: "runtime-token",
      } as NodeJS.ProcessEnv,
      fetchImpl: vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "invalid_gateway_token" }), { status: 401 }),
      ),
    });

    expect(result).toEqual({
      ok: false,
      reason: "token_mismatch",
    });
  });

  it("fetches runtime manifest from control plane", async () => {
    const result = await fetchBustlyRuntimeManifest({
      env: {
        BUSTLY_CONTROL_PLANE_BASE_URL: "https://cp.example.com",
        BUSTLY_RUNTIME_WORKSPACE_ID: "workspace-1",
        BUSTLY_RUNTIME_ID: "runtime-1",
        BUSTLY_RUNTIME_TOKEN: "runtime-token",
      } as NodeJS.ProcessEnv,
      fetchImpl: vi.fn(async (input) => {
        expect(String(input)).toContain("/runtime/manifest?");
        return new Response(
          JSON.stringify({
            workspaceId: "workspace-1",
            runtimeId: "runtime-1",
            manifestRevision: "rev-1",
            manifest: {
              workspaceName: "Workspace One",
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }),
    });

    expect(result).toEqual({
      workspaceId: "workspace-1",
      runtimeId: "runtime-1",
      manifestRevision: "rev-1",
      manifest: {
        workspaceName: "Workspace One",
      },
    });
  });
});
