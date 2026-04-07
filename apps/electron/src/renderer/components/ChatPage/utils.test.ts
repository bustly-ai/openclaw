import { describe, expect, it } from "vitest";
import { collapseStreamingEvents } from "./utils";
import type { TimelineNode } from "./types";

function userNode(key: string, timestamp: number): TimelineNode {
  return {
    kind: "text",
    key,
    timestamp,
    text: key,
    tone: "user",
  };
}

function assistantNode(
  key: string,
  timestamp: number,
  options?: { streaming?: boolean },
): TimelineNode {
  return {
    kind: "text",
    key,
    timestamp,
    text: key,
    tone: "assistant",
    ...(options?.streaming ? { streaming: true } : {}),
  };
}

function toolNode(
  key: string,
  timestamp: number,
  options?: { running?: boolean },
): TimelineNode {
  return {
    kind: "tool",
    key,
    timestamp,
    mergeKey: key,
    summary: key,
    detail: key,
    hasOutput: false,
    completed: !options?.running,
    ...(options?.running ? { running: true } : {}),
  };
}

describe("collapseStreamingEvents", () => {
  it("keeps the first event and the latest two events visible in an ongoing fold capsule", () => {
    const nodes: TimelineNode[] = [
      userNode("user-1", 1),
      assistantNode("assistant-1", 2),
      toolNode("tool-1", 3),
      assistantNode("assistant-2", 4),
      toolNode("tool-2", 5),
      assistantNode("assistant-3", 6, { streaming: true }),
    ];

    const result = collapseStreamingEvents(nodes, 5, false);

    expect(result.map((node) => node.key)).toEqual([
      "user-1",
      "assistant-1",
      "stream-fold:tool-1",
      "tool-2",
      "assistant-3",
    ]);

    const foldNode = result[2];
    expect(foldNode?.kind).toBe("streamFold");
    if (foldNode?.kind !== "streamFold") {
      throw new Error("expected streamFold");
    }
    expect(foldNode.items.map((node) => node.key)).toEqual(["tool-1", "assistant-2"]);
  });

  it("still keeps the latest assistant text visible when newer tool events follow it", () => {
    const nodes: TimelineNode[] = [
      userNode("user-1", 1),
      assistantNode("assistant-1", 2),
      toolNode("tool-1", 3),
      assistantNode("assistant-2", 4, { streaming: true }),
      toolNode("tool-2", 5),
      toolNode("tool-3", 6, { running: true }),
    ];

    const result = collapseStreamingEvents(nodes, 5, false);

    expect(result.map((node) => node.key)).toEqual([
      "user-1",
      "assistant-1",
      "stream-fold:tool-1",
      "assistant-2",
      "tool-2",
      "tool-3",
    ]);

    const foldNode = result[2];
    expect(foldNode?.kind).toBe("streamFold");
    if (foldNode?.kind !== "streamFold") {
      throw new Error("expected streamFold");
    }
    expect(foldNode.items.map((node) => node.key)).toEqual(["tool-1"]);
  });
});
