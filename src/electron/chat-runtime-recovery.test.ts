import { describe, expect, it } from "vitest";
import { recoverSessionViewState } from "../../apps/electron/src/renderer/components/ChatPage/runtime-recovery";

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
});
