import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  registerBustlyRuntimeWithControlPlane,
  startBustlyControlPlaneRuntimeSignals,
} from "./control-plane-runtime-signals.js";

describe("bustly control plane runtime signals", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("registers runtime with deployment metadata", async () => {
    const fetchImpl = vi.fn(async (_input: string, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      const body = init?.body;
      expect(typeof body).toBe("string");
      expect(JSON.parse(body as string)).toMatchObject({
        workspaceId: "workspace-1",
        runtimeId: "runtime-1",
        runtimeToken: "runtime-token",
        hostId: "openclaw-cloud",
        privateIp: "127.0.0.1",
        publicEndpoint: "http://127.0.0.1:18789",
        port: 18789,
      });
      return new Response(JSON.stringify({ accepted: true }), { status: 202 });
    });

    await registerBustlyRuntimeWithControlPlane({
      bindHost: "0.0.0.0",
      port: 18789,
      env: {
        BUSTLY_CONTROL_PLANE_BASE_URL: "https://cp.example.com",
        BUSTLY_RUNTIME_WORKSPACE_ID: "workspace-1",
        BUSTLY_RUNTIME_ID: "runtime-1",
        BUSTLY_RUNTIME_TOKEN: "runtime-token",
      } as NodeJS.ProcessEnv,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain("/runtime/register");
  });

  it("starts heartbeat and health loop for cloud runtime", async () => {
    const fetchImpl = vi.fn(async (_input: string, _init?: RequestInit) => {
      return new Response(JSON.stringify({ accepted: true }), { status: 202 });
    });

    const handle = await startBustlyControlPlaneRuntimeSignals({
      bindHost: "127.0.0.1",
      port: 18789,
      intervalMs: 10_000,
      env: {
        BUSTLY_CONTROL_PLANE_BASE_URL: "https://cp.example.com",
        BUSTLY_RUNTIME_WORKSPACE_ID: "workspace-1",
        BUSTLY_RUNTIME_ID: "runtime-1",
        BUSTLY_RUNTIME_TOKEN: "runtime-token",
      } as NodeJS.ProcessEnv,
      fetchImpl,
    });

    expect(handle.enabled).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain("/runtime/register");
    expect(String(fetchImpl.mock.calls[1]?.[0])).toContain("/runtime/heartbeat");
    expect(String(fetchImpl.mock.calls[2]?.[0])).toContain("/runtime/health");

    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchImpl).toHaveBeenCalledTimes(5);

    handle.stop();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });
});
