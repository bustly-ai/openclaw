import { describe, expect, it, vi } from "vitest";
import { bustlyTasksHandlers } from "./bustly-tasks.js";
import * as embeddedRuns from "../../agents/pi-embedded-runner/runs.js";

describe("bustly.tasks.status", () => {
  it("reports no running tasks when no chat runs are active", () => {
    vi.spyOn(embeddedRuns, "getActiveEmbeddedRunCount").mockReturnValue(0);
    const respond = vi.fn();
    bustlyTasksHandlers["bustly.tasks.status"]({
      req: { type: "req", id: "req-1", method: "bustly.tasks.status" },
      params: {},
      client: null,
      isWebchatConnect: () => false,
      respond,
      context: {
        chatAbortControllers: new Map(),
        agentRunSeq: new Map(),
        dedupe: new Map(),
      },
    } as Parameters<(typeof bustlyTasksHandlers)["bustly.tasks.status"]>[0]);

    expect(respond).toHaveBeenCalledWith(
      true,
      {
        hasRunningTasks: false,
        runningCount: 0,
      },
      undefined,
    );
  });

  it("reports active tasks when chat runs are in progress", () => {
    vi.spyOn(embeddedRuns, "getActiveEmbeddedRunCount").mockReturnValue(0);
    const respond = vi.fn();
    bustlyTasksHandlers["bustly.tasks.status"]({
      req: { type: "req", id: "req-2", method: "bustly.tasks.status" },
      params: {},
      client: null,
      isWebchatConnect: () => false,
      respond,
      context: {
        chatAbortControllers: new Map([
          [
            "run-1",
            {
              controller: new AbortController(),
              sessionId: "session-1",
              sessionKey: "agent:main:main",
              startedAtMs: Date.now(),
              expiresAtMs: Date.now() + 60_000,
            },
          ],
        ]),
        agentRunSeq: new Map(),
        dedupe: new Map(),
      },
    } as Parameters<(typeof bustlyTasksHandlers)["bustly.tasks.status"]>[0]);

    expect(respond).toHaveBeenCalledWith(
      true,
      {
        hasRunningTasks: true,
        runningCount: 1,
      },
      undefined,
    );
  });

  it("falls back to active embedded run count when chat abort controllers are empty", () => {
    vi.spyOn(embeddedRuns, "getActiveEmbeddedRunCount").mockReturnValue(2);
    const respond = vi.fn();
    bustlyTasksHandlers["bustly.tasks.status"]({
      req: { type: "req", id: "req-3", method: "bustly.tasks.status" },
      params: {},
      client: null,
      isWebchatConnect: () => false,
      respond,
      context: {
        chatAbortControllers: new Map(),
        agentRunSeq: new Map(),
        dedupe: new Map(),
      },
    } as Parameters<(typeof bustlyTasksHandlers)["bustly.tasks.status"]>[0]);

    expect(respond).toHaveBeenCalledWith(
      true,
      {
        hasRunningTasks: true,
        runningCount: 2,
      },
      undefined,
    );
  });

  it("falls back to active agent run sequence count", () => {
    vi.spyOn(embeddedRuns, "getActiveEmbeddedRunCount").mockReturnValue(0);
    const respond = vi.fn();
    bustlyTasksHandlers["bustly.tasks.status"]({
      req: { type: "req", id: "req-4", method: "bustly.tasks.status" },
      params: {},
      client: null,
      isWebchatConnect: () => false,
      respond,
      context: {
        chatAbortControllers: new Map(),
        agentRunSeq: new Map([["run-1", 12]]),
        dedupe: new Map(),
      },
    } as Parameters<(typeof bustlyTasksHandlers)["bustly.tasks.status"]>[0]);

    expect(respond).toHaveBeenCalledWith(
      true,
      {
        hasRunningTasks: true,
        runningCount: 1,
      },
      undefined,
    );
  });

  it("counts accepted agent runs from dedupe entries", () => {
    vi.spyOn(embeddedRuns, "getActiveEmbeddedRunCount").mockReturnValue(0);
    const respond = vi.fn();
    bustlyTasksHandlers["bustly.tasks.status"]({
      req: { type: "req", id: "req-5", method: "bustly.tasks.status" },
      params: {},
      client: null,
      isWebchatConnect: () => false,
      respond,
      context: {
        chatAbortControllers: new Map(),
        agentRunSeq: new Map(),
        dedupe: new Map([
          ["agent:run-accepted", { ts: Date.now(), ok: true, payload: { status: "accepted" } }],
          ["agent:run-final", { ts: Date.now(), ok: true, payload: { status: "ok" } }],
          ["chat:run-1", { ts: Date.now(), ok: true, payload: { status: "started" } }],
        ]),
      },
    } as Parameters<(typeof bustlyTasksHandlers)["bustly.tasks.status"]>[0]);

    expect(respond).toHaveBeenCalledWith(
      true,
      {
        hasRunningTasks: true,
        runningCount: 1,
      },
      undefined,
    );
  });
});
