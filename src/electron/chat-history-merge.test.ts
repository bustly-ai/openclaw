import { describe, expect, it } from "vitest";
import { shouldPreserveLocalTimelineItem, type HistoryMergeItem } from "../../apps/electron/src/renderer/components/ChatPage/history-merge";

describe("shouldPreserveLocalTimelineItem", () => {
  it("drops stale running tools when history already contains the same tool call", () => {
    const item: HistoryMergeItem = {
      kind: "tool",
      id: "tool:call_1",
      toolCallId: "call_1",
      runId: "run-1",
      status: "running",
    };
    const historyItems: HistoryMergeItem[] = [
      {
        kind: "tool",
        id: "tool:call_1",
        toolCallId: "call_1",
        runId: "run-1",
        status: "completed",
      },
    ];

    expect(
      shouldPreserveLocalTimelineItem({
        item,
        historyItems,
        liveRunIds: new Set(["run-1"]),
        preservePendingUserMessage: true,
      }),
    ).toBe(false);
  });

  it("keeps a local running tool when history has not caught up yet", () => {
    const item: HistoryMergeItem = {
      kind: "tool",
      id: "tool:call_1",
      toolCallId: "call_1",
      runId: "run-1",
      status: "running",
    };

    expect(
      shouldPreserveLocalTimelineItem({
        item,
        historyItems: [],
        liveRunIds: new Set(["run-1"]),
        preservePendingUserMessage: true,
      }),
    ).toBe(true);
  });
});
