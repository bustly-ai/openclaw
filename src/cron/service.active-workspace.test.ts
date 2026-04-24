import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as bustlyOAuthModule from "../bustly-oauth.js";
import { CronService } from "./service.js";
import { setupCronServiceSuite } from "./service.test-harness.js";

const ACTIVE_WORKSPACE_ID = "73d9c86d-6ed8-49cb-9db8-a721404cc3ae";
const INACTIVE_WORKSPACE_AGENT_ID = "bustly-1e9fb8c0-finance";
const ACTIVE_WORKSPACE_AGENT_ID = "bustly-73d9c86d-marketing";

const { logger: noopLogger, makeStorePath } = setupCronServiceSuite({
  prefix: "openclaw-cron-active-workspace-",
  baseTimeIso: "2026-04-24T16:00:00.000Z",
});

async function writeStoreJobs(storePath: string, jobs: unknown[]) {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify({ version: 1, jobs }, null, 2), "utf-8");
}

function createCronService(params: {
  storePath: string;
  enqueueSystemEvent: ReturnType<typeof vi.fn>;
  requestHeartbeatNow: ReturnType<typeof vi.fn>;
}) {
  return new CronService({
    storePath: params.storePath,
    cronEnabled: true,
    log: noopLogger,
    enqueueSystemEvent: params.enqueueSystemEvent as never,
    requestHeartbeatNow: params.requestHeartbeatNow as never,
    runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" as const })) as never,
    defaultAgentId: ACTIVE_WORKSPACE_AGENT_ID,
  });
}

describe("CronService active workspace scheduling", () => {
  beforeEach(() => {
    vi.spyOn(bustlyOAuthModule, "readBustlyOAuthState").mockReturnValue({
      user: {
        workspaceId: ACTIVE_WORKSPACE_ID,
      },
    } as unknown as ReturnType<typeof bustlyOAuthModule.readBustlyOAuthState>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs only due jobs in the active workspace during startup catch-up", async () => {
    const store = await makeStorePath();
    const enqueueSystemEvent = vi.fn();
    const requestHeartbeatNow = vi.fn();
    const dueAt = Date.parse("2026-04-24T15:59:00.000Z");

    await writeStoreJobs(store.storePath, [
      {
        id: "active-job",
        agentId: ACTIVE_WORKSPACE_AGENT_ID,
        name: "active",
        enabled: true,
        createdAtMs: dueAt - 60_000,
        updatedAtMs: dueAt - 60_000,
        schedule: { kind: "every", everyMs: 60_000, anchorMs: dueAt - 60_000 },
        sessionTarget: "main",
        wakeMode: "next-heartbeat",
        payload: { kind: "systemEvent", text: "active tick" },
        state: { nextRunAtMs: dueAt },
      },
      {
        id: "inactive-job",
        agentId: INACTIVE_WORKSPACE_AGENT_ID,
        name: "inactive",
        enabled: true,
        createdAtMs: dueAt - 60_000,
        updatedAtMs: dueAt - 60_000,
        schedule: { kind: "every", everyMs: 60_000, anchorMs: dueAt - 60_000 },
        sessionTarget: "main",
        wakeMode: "next-heartbeat",
        payload: { kind: "systemEvent", text: "inactive tick" },
        state: { nextRunAtMs: dueAt },
      },
    ]);

    const cron = createCronService({
      storePath: store.storePath,
      enqueueSystemEvent,
      requestHeartbeatNow,
    });
    await cron.start();

    expect(enqueueSystemEvent).toHaveBeenCalledWith(
      "active tick",
      expect.objectContaining({ agentId: ACTIVE_WORKSPACE_AGENT_ID }),
    );
    expect(enqueueSystemEvent).not.toHaveBeenCalledWith(
      "inactive tick",
      expect.anything(),
    );

    cron.stop();
    await store.cleanup();
  });

  it("does not arm next wake when only inactive-workspace jobs exist", async () => {
    const store = await makeStorePath();
    const enqueueSystemEvent = vi.fn();
    const requestHeartbeatNow = vi.fn();
    const dueAt = Date.parse("2026-04-24T15:59:00.000Z");

    await writeStoreJobs(store.storePath, [
      {
        id: "inactive-only-job",
        agentId: INACTIVE_WORKSPACE_AGENT_ID,
        name: "inactive only",
        enabled: true,
        createdAtMs: dueAt - 60_000,
        updatedAtMs: dueAt - 60_000,
        schedule: { kind: "every", everyMs: 60_000, anchorMs: dueAt - 60_000 },
        sessionTarget: "main",
        wakeMode: "next-heartbeat",
        payload: { kind: "systemEvent", text: "inactive only tick" },
        state: { nextRunAtMs: dueAt },
      },
    ]);

    const cron = createCronService({
      storePath: store.storePath,
      enqueueSystemEvent,
      requestHeartbeatNow,
    });
    await cron.start();

    expect(enqueueSystemEvent).not.toHaveBeenCalled();
    const status = await cron.status();
    expect(status.nextWakeAtMs).toBeNull();

    cron.stop();
    await store.cleanup();
  });

  it("does not run workspace-scoped jobs when no active workspace is selected", async () => {
    vi.mocked(bustlyOAuthModule.readBustlyOAuthState).mockReturnValue(
      undefined as unknown as ReturnType<typeof bustlyOAuthModule.readBustlyOAuthState>,
    );

    const store = await makeStorePath();
    const enqueueSystemEvent = vi.fn();
    const requestHeartbeatNow = vi.fn();
    const dueAt = Date.parse("2026-04-24T15:59:00.000Z");

    await writeStoreJobs(store.storePath, [
      {
        id: "workspace-job-no-active",
        agentId: ACTIVE_WORKSPACE_AGENT_ID,
        name: "workspace only",
        enabled: true,
        createdAtMs: dueAt - 60_000,
        updatedAtMs: dueAt - 60_000,
        schedule: { kind: "every", everyMs: 60_000, anchorMs: dueAt - 60_000 },
        sessionTarget: "main",
        wakeMode: "next-heartbeat",
        payload: { kind: "systemEvent", text: "workspace tick" },
        state: { nextRunAtMs: dueAt },
      },
    ]);

    const cron = createCronService({
      storePath: store.storePath,
      enqueueSystemEvent,
      requestHeartbeatNow,
    });
    await cron.start();

    expect(enqueueSystemEvent).not.toHaveBeenCalled();
    const status = await cron.status();
    expect(status.nextWakeAtMs).toBeNull();

    cron.stop();
    await store.cleanup();
  });
});
