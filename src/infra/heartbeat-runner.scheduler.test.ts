import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as bustlyOAuthModule from "../bustly-oauth.js";
import * as configModule from "../config/config.js";
import type { OpenClawConfig } from "../config/config.js";
import { startHeartbeatRunner } from "./heartbeat-runner.js";
import { requestHeartbeatNow, resetHeartbeatWakeStateForTests } from "./heartbeat-wake.js";

describe("startHeartbeatRunner", () => {
  function startDefaultRunner(runOnce: Parameters<typeof startHeartbeatRunner>[0]["runOnce"]) {
    return startHeartbeatRunner({
      cfg: {
        agents: { defaults: { heartbeat: { every: "30m" } } },
      } as OpenClawConfig,
      runOnce,
    });
  }

  beforeEach(() => {
    vi.spyOn(bustlyOAuthModule, "readBustlyOAuthState").mockReturnValue(null);
  });

  afterEach(() => {
    resetHeartbeatWakeStateForTests();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("updates scheduling when config changes without restart", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));

    const runSpy = vi.fn().mockResolvedValue({ status: "ran", durationMs: 1 });

    const runner = startDefaultRunner(runSpy);

    await vi.advanceTimersByTimeAsync(30 * 60_000 + 1_000);

    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(runSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ agentId: "main", reason: "interval" }),
    );

    runner.updateConfig({
      agents: {
        defaults: { heartbeat: { every: "30m" } },
        list: [
          { id: "main", heartbeat: { every: "10m" } },
          { id: "ops", heartbeat: { every: "15m" } },
        ],
      },
    } as OpenClawConfig);

    await vi.advanceTimersByTimeAsync(10 * 60_000 + 1_000);

    expect(runSpy).toHaveBeenCalledTimes(2);
    expect(runSpy.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ agentId: "main", heartbeat: { every: "10m" } }),
    );

    await vi.advanceTimersByTimeAsync(5 * 60_000 + 1_000);

    expect(runSpy).toHaveBeenCalledTimes(3);
    expect(runSpy.mock.calls[2]?.[0]).toEqual(
      expect.objectContaining({ agentId: "ops", heartbeat: { every: "15m" } }),
    );

    runner.stop();
  });

  it("continues scheduling after runOnce throws an unhandled error", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));

    let callCount = 0;
    const runSpy = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // First call throws (simulates crash during session compaction)
        throw new Error("session compaction error");
      }
      return { status: "ran", durationMs: 1 };
    });

    const runner = startDefaultRunner(runSpy);

    // First heartbeat fires and throws
    await vi.advanceTimersByTimeAsync(30 * 60_000 + 1_000);
    expect(runSpy).toHaveBeenCalledTimes(1);

    // Second heartbeat should still fire (scheduler must not be dead)
    await vi.advanceTimersByTimeAsync(30 * 60_000 + 1_000);
    expect(runSpy).toHaveBeenCalledTimes(2);

    runner.stop();
  });

  it("cleanup is idempotent and does not clear a newer runner's handler", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));

    const runSpy1 = vi.fn().mockResolvedValue({ status: "ran", durationMs: 1 });
    const runSpy2 = vi.fn().mockResolvedValue({ status: "ran", durationMs: 1 });

    const cfg = {
      agents: { defaults: { heartbeat: { every: "30m" } } },
    } as OpenClawConfig;

    // Start runner A
    const runnerA = startHeartbeatRunner({ cfg, runOnce: runSpy1 });

    // Start runner B (simulates lifecycle reload)
    const runnerB = startHeartbeatRunner({ cfg, runOnce: runSpy2 });

    // Stop runner A (stale cleanup) — should NOT kill runner B's handler
    runnerA.stop();

    // Runner B should still fire
    await vi.advanceTimersByTimeAsync(30 * 60_000 + 1_000);
    expect(runSpy2).toHaveBeenCalledTimes(1);
    expect(runSpy1).not.toHaveBeenCalled();

    // Double-stop should be safe (idempotent)
    runnerA.stop();

    runnerB.stop();
  });

  it("run() returns skipped when runner is stopped", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));

    const runSpy = vi.fn().mockResolvedValue({ status: "ran", durationMs: 1 });

    const runner = startDefaultRunner(runSpy);

    runner.stop();

    // After stopping, no heartbeats should fire
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    expect(runSpy).not.toHaveBeenCalled();
  });

  it("reschedules timer when runOnce returns requests-in-flight", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));

    let callCount = 0;
    const runSpy = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { status: "skipped", reason: "requests-in-flight" };
      }
      return { status: "ran", durationMs: 1 };
    });

    const runner = startHeartbeatRunner({
      cfg: {
        agents: { defaults: { heartbeat: { every: "30m" } } },
      } as OpenClawConfig,
      runOnce: runSpy,
    });

    // First heartbeat returns requests-in-flight
    await vi.advanceTimersByTimeAsync(30 * 60_000 + 1_000);
    expect(runSpy).toHaveBeenCalledTimes(1);

    // Timer should be rescheduled; next heartbeat should still fire
    await vi.advanceTimersByTimeAsync(30 * 60_000 + 1_000);
    expect(runSpy).toHaveBeenCalledTimes(2);

    runner.stop();
  });

  it("routes targeted wake requests to the requested agent/session", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));

    const runSpy = vi.fn().mockResolvedValue({ status: "ran", durationMs: 1 });
    const runner = startHeartbeatRunner({
      cfg: {
        agents: {
          defaults: { heartbeat: { every: "30m" } },
          list: [
            { id: "main", heartbeat: { every: "30m" } },
            { id: "ops", heartbeat: { every: "15m" } },
          ],
        },
      } as OpenClawConfig,
      runOnce: runSpy,
    });

    requestHeartbeatNow({
      reason: "cron:job-123",
      agentId: "ops",
      sessionKey: "agent:ops:discord:channel:alerts",
      coalesceMs: 0,
    });
    await vi.advanceTimersByTimeAsync(1);

    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(runSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "ops",
        reason: "cron:job-123",
        sessionKey: "agent:ops:discord:channel:alerts",
      }),
    );

    runner.stop();
  });

  it("does not double-run the same agent when targeted and interval wakes are queued together", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));

    const runSpy = vi.fn().mockResolvedValue({ status: "ran", durationMs: 1 });
    const runner = startHeartbeatRunner({
      cfg: {
        agents: {
          defaults: { heartbeat: { every: "30m" } },
          list: [
            { id: "main", heartbeat: { every: "30m" } },
            { id: "ops", heartbeat: { every: "30m" } },
          ],
        },
      } as OpenClawConfig,
      runOnce: runSpy,
    });

    // Move to the first due boundary, then queue both:
    // - a targeted wake for ops
    // - an interval wake (generic due-agent sweep)
    vi.setSystemTime(new Date(30 * 60_000));
    requestHeartbeatNow({
      reason: "wake",
      agentId: "ops",
      sessionKey: "agent:ops:discord:channel:alerts",
      coalesceMs: 0,
    });
    requestHeartbeatNow({
      reason: "interval",
      coalesceMs: 0,
    });
    await vi.advanceTimersByTimeAsync(1);

    const calledAgents = runSpy.mock.calls.map((call) => call[0]?.agentId);
    expect(calledAgents.filter((agentId) => agentId === "ops")).toHaveLength(1);
    expect(calledAgents.filter((agentId) => agentId === "main")).toHaveLength(1);
    expect(runSpy).toHaveBeenCalledTimes(2);

    runner.stop();
  });

  it("runs due heartbeat agents in parallel", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));

    let resolveMain: ((value: { status: "ran"; durationMs: number }) => void) | undefined;
    let resolveOps: ((value: { status: "ran"; durationMs: number }) => void) | undefined;
    const mainPromise = new Promise<{ status: "ran"; durationMs: number }>((resolve) => {
      resolveMain = resolve;
    });
    const opsPromise = new Promise<{ status: "ran"; durationMs: number }>((resolve) => {
      resolveOps = resolve;
    });
    const runSpy = vi.fn().mockImplementation(async ({ agentId }: { agentId: string }) => {
      if (agentId === "main") {
        return await mainPromise;
      }
      return await opsPromise;
    });

    const runner = startHeartbeatRunner({
      cfg: {
        agents: {
          defaults: { heartbeat: { every: "30m" } },
          list: [
            { id: "main", heartbeat: { every: "30m" } },
            { id: "ops", heartbeat: { every: "30m" } },
          ],
        },
      } as OpenClawConfig,
      runOnce: runSpy,
    });

    await vi.advanceTimersByTimeAsync(30 * 60_000 + 1_000);

    expect(runSpy).toHaveBeenCalledTimes(2);
    expect(runSpy.mock.calls.map((call) => call[0]?.agentId)).toEqual(
      expect.arrayContaining(["main", "ops"]),
    );

    resolveMain?.({ status: "ran", durationMs: 1 });
    resolveOps?.({ status: "ran", durationMs: 1 });
    await vi.advanceTimersByTimeAsync(0);

    runner.stop();
  });

  it("refreshes config before targeted wake when the requested agent is not in the current runner state", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));

    const refreshedConfig = {
      agents: {
        defaults: { heartbeat: { every: "30m" } },
        list: [{ id: "bustly-workspace-2-store-ops", heartbeat: { every: "30m" } }],
      },
    } as OpenClawConfig;
    const loadConfigSpy = vi.spyOn(configModule, "loadConfig").mockReturnValue(refreshedConfig);

    const runSpy = vi.fn().mockResolvedValue({ status: "ran", durationMs: 1 });
    const runner = startHeartbeatRunner({
      cfg: {
        agents: {
          defaults: { heartbeat: { every: "30m" } },
          list: [{ id: "bustly-workspace-1-store-ops", heartbeat: { every: "30m" } }],
        },
      } as OpenClawConfig,
      runOnce: runSpy,
    });

    requestHeartbeatNow({
      reason: "wake",
      agentId: "bustly-workspace-2-store-ops",
      coalesceMs: 0,
    });
    await vi.advanceTimersByTimeAsync(1);

    expect(loadConfigSpy).toHaveBeenCalledTimes(1);
    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(runSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        cfg: refreshedConfig,
        agentId: "bustly-workspace-2-store-ops",
        heartbeat: { every: "30m" },
        reason: "wake",
      }),
    );

    runner.stop();
  });

  it("only schedules Bustly heartbeat agents from the active workspace", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    vi.mocked(bustlyOAuthModule.readBustlyOAuthState).mockReturnValue({
      user: {
        workspaceId: "workspace-1",
      },
    } as unknown as ReturnType<typeof bustlyOAuthModule.readBustlyOAuthState>);

    const runSpy = vi.fn().mockResolvedValue({ status: "ran", durationMs: 1 });
    const runner = startHeartbeatRunner({
      cfg: {
        agents: {
          list: [
            { id: "bustly-workspace-1-overview", heartbeat: { every: "30m" } },
            { id: "bustly-workspace-2-overview", heartbeat: { every: "30m" } },
          ],
        },
      } as OpenClawConfig,
      runOnce: runSpy,
    });

    await vi.advanceTimersByTimeAsync(30 * 60_000 + 1_000);

    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(runSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "bustly-workspace-1-overview",
      }),
    );

    runner.stop();
  });
});
