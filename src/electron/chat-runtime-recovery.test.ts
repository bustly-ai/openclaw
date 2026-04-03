import { describe, expect, it } from "vitest";
import {
  recoverSessionViewState,
  shouldDiscardRecoveredPendingRuns,
  type RecoverableTimelineItem,
} from "../../apps/electron/src/renderer/components/ChatPage/runtime-recovery.js";

describe("recoverSessionViewState", () => {
  it("drops stale transient run indicators when no live artifact remains", () => {
    const recovered = recoverSessionViewState({
      view: {
        sending: true,
        activeRunId: "run-stale",
        compactingRunId: "run-compact",
        reconnectStatus: { runId: "run-stale" },
        draft: "keep me",
      },
      timeline: [
        {
          kind: "text",
          id: "history:assistant:1",
          runId: "run-stale",
          role: "assistant",
          final: true,
          sortSeq: 10,
          timestamp: 100,
        },
      ],
      pendingClientRunIds: new Set<string>(),
    });

    expect(recovered.view).toEqual({
      sending: false,
      activeRunId: null,
      compactingRunId: null,
      reconnectStatus: null,
      draft: "keep me",
    });
    expect(recovered.pendingClientRunIds).toEqual(new Set());
    expect(recovered.terminalRunIds).toEqual(new Set(["run-stale"]));
  });

  it("keeps the current run when local streaming artifacts still exist", () => {
    const recovered = recoverSessionViewState({
      view: {
        sending: false,
        activeRunId: "run-live",
        compactingRunId: null,
        reconnectStatus: { runId: "run-live" },
      },
      timeline: [
        {
          kind: "text",
          id: "history:thinking:1",
          runId: "run-live",
          role: "thinking",
          streaming: true,
          sortSeq: 42,
          timestamp: 500,
        },
      ],
      pendingClientRunIds: new Set<string>(),
    });

    expect(recovered.view.activeRunId).toBe("run-live");
    expect(recovered.liveRunIds).toEqual(new Set(["run-live"]));
    expect(recovered.view.reconnectStatus).toBeNull();
  });

  it("keeps unresolved pending client runs active until history catches up", () => {
    const recovered = recoverSessionViewState({
      view: {
        sending: true,
        activeRunId: "run-pending",
        compactingRunId: null,
        reconnectStatus: null,
      },
      timeline: [],
      pendingClientRunIds: new Set(["run-pending"]),
    });

    expect(recovered.view.activeRunId).toBe("run-pending");
    expect(recovered.pendingClientRunIds).toEqual(new Set(["run-pending"]));
  });

  it("drops stale pending runs when recovered history already ends in a final assistant", () => {
    const historyItems: RecoverableTimelineItem[] = [
      {
        kind: "text",
        id: "history:user:1",
        role: "user",
        sortSeq: 1,
        timestamp: 1,
      },
      {
        kind: "text",
        id: "history:assistant:2",
        role: "assistant",
        final: true,
        sortSeq: 2,
        timestamp: 2,
      },
    ];

    expect(
      shouldDiscardRecoveredPendingRuns({
        historyItems,
        mergedTimeline: historyItems,
        pendingClientRunIds: new Set(["run-pending"]),
      }),
    ).toBe(true);
  });

  it("keeps pending runs when there is still an unsynced local user turn", () => {
    const historyItems: RecoverableTimelineItem[] = [
      {
        kind: "text",
        id: "history:assistant:1",
        role: "assistant",
        final: true,
        sortSeq: 1,
        timestamp: 1,
      },
    ];
    const mergedTimeline: RecoverableTimelineItem[] = [
      ...historyItems,
      {
        kind: "text",
        id: "user-local-1",
        role: "user",
        sortSeq: 2,
        timestamp: 2,
      },
    ];

    expect(
      shouldDiscardRecoveredPendingRuns({
        historyItems,
        mergedTimeline,
        pendingClientRunIds: new Set(["run-pending"]),
      }),
    ).toBe(false);
  });
});
