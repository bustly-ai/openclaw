export type HistoryMergeChatRole = "user" | "assistant" | "thinking" | "system";

export type HistoryMergeTextItem = {
  kind: "text";
  id: string;
  role: HistoryMergeChatRole;
  text: string;
  runId?: string;
  streaming?: boolean;
  final?: boolean;
};

export type HistoryMergeToolStatus = "running" | "completed" | "error";

export type HistoryMergeToolItem = {
  kind: "tool";
  id: string;
  toolCallId: string;
  runId?: string;
  status: HistoryMergeToolStatus;
};

export type HistoryMergeErrorItem = {
  kind: "error";
  id: string;
};

export type HistoryMergeItem = HistoryMergeTextItem | HistoryMergeToolItem | HistoryMergeErrorItem;

function normalizeComparableMessageText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function hasMatchingHistoryTextItem(
  items: HistoryMergeItem[],
  role: HistoryMergeChatRole,
  text: string,
): boolean {
  const comparable = normalizeComparableMessageText(text);
  if (!comparable) {
    return false;
  }
  return items.some((item) => {
    if (item.kind !== "text" || item.role !== role) {
      return false;
    }
    return normalizeComparableMessageText(item.text) === comparable;
  });
}

function hasMatchingHistoryToolItem(items: HistoryMergeItem[], toolCallId: string): boolean {
  return items.some((item) => item.kind === "tool" && item.toolCallId === toolCallId);
}

export function shouldPreserveLocalTimelineItem(params: {
  item: HistoryMergeItem;
  liveRunIds: Set<string>;
  historyItems: HistoryMergeItem[];
  preservePendingUserMessage: boolean;
}): boolean {
  const { item, liveRunIds, historyItems, preservePendingUserMessage } = params;
  if (item.kind === "error") {
    return true;
  }
  if (item.kind === "tool") {
    // Prefer persisted tool rows when history already caught up so stale local
    // spinners disappear after reconnect/gap recovery.
    if (hasMatchingHistoryToolItem(historyItems, item.toolCallId)) {
      return false;
    }
    return item.status === "running" || (item.runId ? liveRunIds.has(item.runId) : false);
  }
  if (item.role === "user") {
    return (
      preservePendingUserMessage &&
      !item.runId &&
      !item.id.startsWith("history:") &&
      !hasMatchingHistoryTextItem(historyItems, "user", item.text)
    );
  }
  if (!item.runId || !liveRunIds.has(item.runId)) {
    return false;
  }
  if (item.role === "thinking" || item.role === "system") {
    return true;
  }
  return item.role === "assistant" && (item.streaming === true || item.final !== true);
}
