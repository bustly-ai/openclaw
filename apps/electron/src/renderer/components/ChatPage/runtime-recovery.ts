export type RecoverableReconnectStatus = {
  runId: string;
};

export type RecoverableChatRole = "user" | "assistant" | "thinking" | "system";
export type RecoverableToolStatus = "running" | "completed" | "error";

export type RecoverableTimelineItem =
  | {
      kind: "text";
      id: string;
      runId?: string;
      role: RecoverableChatRole;
      streaming?: boolean;
      final?: boolean;
      sortSeq: number;
      timestamp: number;
    }
  | {
      kind: "tool";
      id: string;
      runId?: string;
      status: RecoverableToolStatus;
      sortSeq: number;
      timestamp: number;
    }
  | {
      kind: "error";
      id: string;
      runId?: string;
      sortSeq: number;
      timestamp: number;
    };

export type RecoverableSessionViewState = {
  sending: boolean;
  activeRunId: string | null;
  compactingRunId: string | null;
  reconnectStatus: RecoverableReconnectStatus | null;
};

type RecoverSessionRuntimeParams<T extends RecoverableSessionViewState> = {
  view: T;
  timeline: RecoverableTimelineItem[];
  pendingClientRunIds: ReadonlySet<string>;
};

type RecoverSessionRuntimeResult<T extends RecoverableSessionViewState> = {
  view: T;
  liveRunIds: Set<string>;
  pendingClientRunIds: Set<string>;
  terminalRunIds: Set<string>;
};

function collectTerminalRunIds(items: RecoverableTimelineItem[]): Set<string> {
  const terminalRunIds = new Set<string>();
  for (const item of items) {
    if (!item.runId) {
      continue;
    }
    if (item.kind === "error") {
      terminalRunIds.add(item.runId);
      continue;
    }
    if (item.kind === "text" && item.role === "assistant" && item.final === true) {
      terminalRunIds.add(item.runId);
    }
  }
  return terminalRunIds;
}

function collectLiveRunMeta(
  items: RecoverableTimelineItem[],
  terminalRunIds?: ReadonlySet<string>,
): Map<string, { sortSeq: number; timestamp: number }> {
  const liveRunMeta = new Map<string, { sortSeq: number; timestamp: number }>();
  for (const item of items) {
    if (!item.runId || terminalRunIds?.has(item.runId)) {
      continue;
    }
    const isLive =
      item.kind === "tool"
        ? item.status === "running"
        : item.kind === "text"
          ? item.streaming === true
          : false;
    if (!isLive) {
      continue;
    }
    const current = liveRunMeta.get(item.runId);
    if (
      !current ||
      item.sortSeq > current.sortSeq ||
      (item.sortSeq === current.sortSeq && item.timestamp >= current.timestamp)
    ) {
      liveRunMeta.set(item.runId, {
        sortSeq: item.sortSeq,
        timestamp: item.timestamp,
      });
    }
  }
  return liveRunMeta;
}

function pickLatestPendingRunId(pendingClientRunIds: ReadonlySet<string>): string | null {
  let latest: string | null = null;
  for (const runId of pendingClientRunIds) {
    latest = runId;
  }
  return latest;
}

export function recoverSessionViewState<T extends RecoverableSessionViewState>(
  params: RecoverSessionRuntimeParams<T>,
): RecoverSessionRuntimeResult<T> {
  const terminalRunIds = collectTerminalRunIds(params.timeline);
  const liveRunMeta = collectLiveRunMeta(params.timeline, terminalRunIds);
  const pendingClientRunIds = new Set(
    [...params.pendingClientRunIds].filter((runId) => runId && !terminalRunIds.has(runId)),
  );
  const liveRunIds = new Set<string>([...liveRunMeta.keys(), ...pendingClientRunIds]);

  let activeRunId: string | null = null;
  if (params.view.activeRunId && liveRunIds.has(params.view.activeRunId)) {
    activeRunId = params.view.activeRunId;
  } else {
    let latestLiveRunId: string | null = null;
    let latestLiveRunMeta: { sortSeq: number; timestamp: number } | null = null;
    for (const [runId, meta] of liveRunMeta) {
      if (
        !latestLiveRunMeta ||
        meta.sortSeq > latestLiveRunMeta.sortSeq ||
        (meta.sortSeq === latestLiveRunMeta.sortSeq &&
          meta.timestamp >= latestLiveRunMeta.timestamp)
      ) {
        latestLiveRunId = runId;
        latestLiveRunMeta = meta;
      }
    }
    activeRunId = latestLiveRunId ?? pickLatestPendingRunId(pendingClientRunIds);
  }

  return {
    view: {
      ...params.view,
      sending: false,
      activeRunId,
      compactingRunId: null,
      reconnectStatus: null,
    },
    liveRunIds,
    pendingClientRunIds,
    terminalRunIds,
  };
}

function hasUnsyncedLocalUserMessage(items: RecoverableTimelineItem[]): boolean {
  return items.some(
    (item) =>
      item.kind === "text" &&
      item.role === "user" &&
      !item.id.startsWith("history:"),
  );
}

function historyEndsInTerminalAssistant(items: RecoverableTimelineItem[]): boolean {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item.kind === "tool") {
      continue;
    }
    if (item.kind === "error") {
      return true;
    }
    if (item.role === "thinking") {
      continue;
    }
    if (item.role === "assistant") {
      return item.final === true;
    }
    if (item.role === "user") {
      return false;
    }
    if (item.role === "system") {
      continue;
    }
  }
  return false;
}

export function shouldDiscardRecoveredPendingRuns(params: {
  historyItems: RecoverableTimelineItem[];
  mergedTimeline: RecoverableTimelineItem[];
  pendingClientRunIds: ReadonlySet<string>;
}): boolean {
  if (params.pendingClientRunIds.size === 0) {
    return false;
  }
  if (hasUnsyncedLocalUserMessage(params.mergedTimeline)) {
    return false;
  }
  return historyEndsInTerminalAssistant(params.historyItems);
}
