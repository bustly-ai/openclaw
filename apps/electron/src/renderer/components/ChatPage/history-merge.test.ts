import { describe, expect, it } from "vitest";
import { shouldPreserveLocalTimelineItem, type HistoryMergeItem } from "./history-merge";

function assistantItem(params: {
  id: string;
  text: string;
  runId?: string;
  streaming?: boolean;
  final?: boolean;
}): HistoryMergeItem {
  return {
    kind: "text",
    id: params.id,
    role: "assistant",
    text: params.text,
    runId: params.runId,
    streaming: params.streaming,
    final: params.final,
  };
}

describe("shouldPreserveLocalTimelineItem", () => {
  it("drops a local assistant stream when history already contains the same text for the same run", () => {
    expect(
      shouldPreserveLocalTimelineItem({
        item: assistantItem({
          id: "local-assistant",
          runId: "run-1",
          text: "没问题，我这就为您规划这套新品冷启动推广方案。",
          streaming: true,
          final: false,
        }),
        liveRunIds: new Set(["run-1"]),
        historyItems: [
          assistantItem({
            id: "history-assistant",
            runId: "run-1",
            text: "没问题，我这就为您规划这套新品冷启动推广方案。",
            final: true,
          }),
        ],
        preservePendingUserMessage: true,
      }),
    ).toBe(false);
  });

  it("keeps a local assistant stream when the matching history text belongs to a different run", () => {
    expect(
      shouldPreserveLocalTimelineItem({
        item: assistantItem({
          id: "local-assistant",
          runId: "run-2",
          text: "没问题，我这就为您规划这套新品冷启动推广方案。",
          streaming: true,
          final: false,
        }),
        liveRunIds: new Set(["run-2"]),
        historyItems: [
          assistantItem({
            id: "history-assistant",
            runId: "run-1",
            text: "没问题，我这就为您规划这套新品冷启动推广方案。",
            final: true,
          }),
        ],
        preservePendingUserMessage: true,
      }),
    ).toBe(true);
  });
});
