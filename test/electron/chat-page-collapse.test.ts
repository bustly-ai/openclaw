import { describe, expect, it } from "vitest";
import { collapseStreamingEvents } from "../../apps/electron/src/renderer/components/ChatPage/utils";
import type { TimelineNode } from "../../apps/electron/src/renderer/components/ChatPage/types";

describe("collapseStreamingEvents", () => {
  it("does not attach a new fold capsule to the previous turn before the current turn emits events", () => {
    const nodes: TimelineNode[] = [
      {
        kind: "text",
        key: "user-1",
        timestamp: 1,
        text: "first question",
        tone: "user",
      },
      {
        kind: "tool",
        key: "tool-1",
        timestamp: 2,
        mergeKey: "tool-1",
        summary: "tool 1",
        detail: "tool 1",
        hasOutput: true,
        completed: true,
        running: false,
      },
      {
        kind: "tool",
        key: "tool-2",
        timestamp: 3,
        mergeKey: "tool-2",
        summary: "tool 2",
        detail: "tool 2",
        hasOutput: true,
        completed: true,
        running: false,
      },
      {
        kind: "tool",
        key: "tool-3",
        timestamp: 4,
        mergeKey: "tool-3",
        summary: "tool 3",
        detail: "tool 3",
        hasOutput: true,
        completed: true,
        running: false,
      },
      {
        kind: "tool",
        key: "tool-4",
        timestamp: 5,
        mergeKey: "tool-4",
        summary: "tool 4",
        detail: "tool 4",
        hasOutput: true,
        completed: true,
        running: false,
      },
      {
        kind: "tool",
        key: "tool-5",
        timestamp: 6,
        mergeKey: "tool-5",
        summary: "tool 5",
        detail: "tool 5",
        hasOutput: true,
        completed: true,
        running: false,
      },
      {
        kind: "text",
        key: "assistant-final",
        timestamp: 7,
        text: "first answer",
        tone: "assistant",
        final: true,
      },
      {
        kind: "text",
        key: "user-2",
        timestamp: 8,
        text: "second question",
        tone: "user",
      },
    ];

    const result = collapseStreamingEvents(nodes, 5, true);

    expect(result).toEqual(nodes);
    expect(result.some((node) => node.kind === "streamFold")).toBe(false);
  });

  it("still collapses stream events once the current turn has emitted them", () => {
    const nodes: TimelineNode[] = [
      {
        kind: "text",
        key: "user-2",
        timestamp: 8,
        text: "second question",
        tone: "user",
      },
      {
        kind: "tool",
        key: "run-tool-1",
        timestamp: 9,
        mergeKey: "run-tool-1",
        summary: "tool 1",
        detail: "tool 1",
        hasOutput: true,
        completed: true,
        running: false,
      },
      {
        kind: "tool",
        key: "run-tool-2",
        timestamp: 10,
        mergeKey: "run-tool-2",
        summary: "tool 2",
        detail: "tool 2",
        hasOutput: true,
        completed: true,
        running: false,
      },
      {
        kind: "tool",
        key: "run-tool-3",
        timestamp: 11,
        mergeKey: "run-tool-3",
        summary: "tool 3",
        detail: "tool 3",
        hasOutput: true,
        completed: true,
        running: false,
      },
      {
        kind: "tool",
        key: "run-tool-4",
        timestamp: 12,
        mergeKey: "run-tool-4",
        summary: "tool 4",
        detail: "tool 4",
        hasOutput: true,
        completed: true,
        running: false,
      },
      {
        kind: "text",
        key: "assistant-live",
        timestamp: 13,
        text: "working",
        tone: "assistant",
        streaming: true,
        final: false,
      },
    ];

    const result = collapseStreamingEvents(nodes, 5, true);

    expect(result).toHaveLength(3);
    expect(result[1]).toMatchObject({
      kind: "streamFold",
      hiddenCount: 4,
    });
    expect((result[1] as Extract<TimelineNode, { kind: "streamFold" }>).items.map((item) => item.key)).toEqual([
      "run-tool-1",
      "run-tool-2",
      "run-tool-3",
      "run-tool-4",
    ]);
    expect(result[2]?.key).toBe("assistant-live");
  });

  it("never renders the fold capsule above the latest user message", () => {
    const nodes: TimelineNode[] = [
      {
        kind: "text",
        key: "older-user",
        timestamp: 1,
        text: "older question",
        tone: "user",
      },
      {
        kind: "tool",
        key: "older-tool-1",
        timestamp: 2,
        mergeKey: "older-tool-1",
        summary: "older tool 1",
        detail: "older tool 1",
        hasOutput: true,
        completed: true,
        running: false,
      },
      {
        kind: "tool",
        key: "older-tool-2",
        timestamp: 3,
        mergeKey: "older-tool-2",
        summary: "older tool 2",
        detail: "older tool 2",
        hasOutput: true,
        completed: true,
        running: false,
      },
      {
        kind: "tool",
        key: "older-tool-3",
        timestamp: 4,
        mergeKey: "older-tool-3",
        summary: "older tool 3",
        detail: "older tool 3",
        hasOutput: true,
        completed: true,
        running: false,
      },
      {
        kind: "tool",
        key: "older-tool-4",
        timestamp: 5,
        mergeKey: "older-tool-4",
        summary: "older tool 4",
        detail: "older tool 4",
        hasOutput: true,
        completed: true,
        running: false,
      },
      {
        kind: "text",
        key: "older-assistant",
        timestamp: 6,
        text: "older answer",
        tone: "assistant",
        final: true,
      },
      {
        kind: "text",
        key: "latest-user",
        timestamp: 7,
        text: "latest question",
        tone: "user",
      },
      {
        kind: "tool",
        key: "current-tool-1",
        timestamp: 8,
        mergeKey: "current-tool-1",
        summary: "current tool 1",
        detail: "current tool 1",
        hasOutput: true,
        completed: true,
        running: false,
      },
      {
        kind: "tool",
        key: "current-tool-2",
        timestamp: 9,
        mergeKey: "current-tool-2",
        summary: "current tool 2",
        detail: "current tool 2",
        hasOutput: true,
        completed: true,
        running: false,
      },
      {
        kind: "tool",
        key: "current-tool-3",
        timestamp: 10,
        mergeKey: "current-tool-3",
        summary: "current tool 3",
        detail: "current tool 3",
        hasOutput: true,
        completed: true,
        running: false,
      },
      {
        kind: "tool",
        key: "current-tool-4",
        timestamp: 11,
        mergeKey: "current-tool-4",
        summary: "current tool 4",
        detail: "current tool 4",
        hasOutput: true,
        completed: true,
        running: false,
      },
      {
        kind: "text",
        key: "current-thinking",
        timestamp: 12,
        text: "thinking",
        tone: "thinking",
        streaming: true,
      },
    ];

    const result = collapseStreamingEvents(nodes, 5, true);
    const latestUserIndex = result.findIndex((node) => node.key === "latest-user");
    const foldIndex = result.findIndex((node) => node.kind === "streamFold");

    expect(foldIndex).toBeGreaterThan(latestUserIndex);
    expect(result[foldIndex]).toMatchObject({
      kind: "streamFold",
      hiddenCount: 4,
    });
  });
});
